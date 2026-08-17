import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
    FRAGA_BESKRIVNING,
    build_mobile_notification,
    format_fraga_beskrivning,
    format_notification_message,
    format_notification_title,
    get_project_display_name,
} from '../../scripts/nabu_cursor_mobile_notification.mjs';
import {
    append_klar_summary,
    build_full_klar_message,
    build_fraga_event_payload,
    build_ha_event_payload,
    build_project_klar_message,
    resolve_ha_payload_typ,
    extract_response_summary,
    get_klar_summary,
    get_project_klar_message,
    get_task_label,
    get_webhook_beskrivning_from_message,
    parse_klar_message_parts,
} from '../../scripts/nabu_project_klar_message.mjs';
import { extract_concluding_summary, is_follow_up_prompt, repair_utf8_mojibake } from '../../scripts/nabu_response_summary.mjs';
import { normalize_ha_event_payload } from '../../scripts/nabu_ha_cursor_klar_event.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

describe('nabu_cursor_mobile_notification', () => {
    test('format_notification_title använder Cursor HH:mm', () => {
        const title = format_notification_title(new Date('2026-08-17T12:34:00+02:00'));
        expect(title).toMatch(/^Cursor \d{2}:\d{2}$/);
    });

    test('format_notification_message följer önskat format', () => {
        expect(format_notification_message('Leffe', 'Exporten är klar.')).toBe(
            'Nu är jag klar [Leffe]: Exporten är klar.',
        );
    });

    test('build_mobile_notification för fråga', () => {
        const payload = build_mobile_notification(REPO_ROOT, { typ: 'fraga' });
        expect(payload.projekt).toBe('Leffe');
        expect(payload.beskrivning).toBe(FRAGA_BESKRIVNING);
        expect(payload.message).toBe(`Nu är jag klar [Leffe]: ${FRAGA_BESKRIVNING}`);
        expect(payload.title).toMatch(/^Cursor fråga \d{2}:\d{2}$/);
    });

    test('format_notification_title skiljer fråga och klar', () => {
        const date = new Date('2026-08-17T14:10:00+02:00');
        expect(format_notification_title(date, 'klar')).toBe('Cursor 14:10');
        expect(format_notification_title(date, 'fraga')).toBe('Cursor fråga 14:10');
    });
});

describe('nabu_response_summary', () => {
    test('extract_concluding_summary hoppar över uppföljningsfrågor', () => {
        const text = [
            'Jag har fixat webhook-meddelandet.',
            '',
            'Säg till om du vill att jag sätter upp ett manuellt testscript du kan köra i kväll.',
        ].join('\n');
        expect(is_follow_up_prompt('Säg till om du vill att jag sätter upp ett test.')).toBe(true);
        expect(is_follow_up_prompt('Vill du kan jag ta en granskning från testservern?')).toBe(true);
        expect(extract_concluding_summary(text)).toBe('Jag har fixat webhook-meddelandet.');
    });

    test('repair_utf8_mojibake återställer felaktigt sparad svenska', () => {
        const broken = 'PDF-exporten anvÃ¤nder Aeonik frÃ¥n din PTS-bilaga.';
        expect(repair_utf8_mojibake(broken)).toBe('PDF-exporten använder Aeonik från din PTS-bilaga.');
    });
});

describe('nabu_project_klar_message', () => {
    test('sessionversion får Leffe-text', () => {
        expect(get_project_klar_message(REPO_ROOT)).toBe('Nu är jag klar med Leffe.');
        expect(get_project_display_name(REPO_ROOT)).toBe('Leffe');
    });

    test('parse_klar_message_parts plockar bara sammanfattning', () => {
        const message = 'Nu är jag klar med Home Assistant Fixade notisflödet.';
        expect(parse_klar_message_parts(message)).toEqual({
            projekt: 'Home Assistant',
            beskrivning: 'Fixade notisflödet.',
        });
        expect(get_webhook_beskrivning_from_message(message)).toBe('Fixade notisflödet.');
    });

    test('build_ha_event_payload skickar title och message', () => {
        const tmp_root = fs.mkdtempSync(path.join(os.tmpdir(), 'nabu-ha-payload-'));
        const state_dir = path.join(tmp_root, '.cursor', 'hooks', 'state');
        fs.mkdirSync(state_dir, { recursive: true });
        fs.writeFileSync(
            path.join(state_dir, 'last-response.txt'),
            'Detaljer.\n\nFixade webhook-meddelandet.',
            'utf8',
        );
        fs.writeFileSync(
            path.join(tmp_root, '.cursor', 'nabu_project_klar_message.txt'),
            'Nu är jag klar med Test.',
            'utf8',
        );
        const payload = build_ha_event_payload(tmp_root);
        expect(payload.title).toMatch(/^Cursor \d{2}:\d{2}$/);
        expect(payload.message).toBe('Nu är jag klar [Test]: Fixade webhook-meddelandet.');
        expect(payload.beskrivning).toBe('Fixade webhook-meddelandet.');
        fs.rmSync(tmp_root, { recursive: true, force: true });
    });

    test('format_fraga_beskrivning inkluderar sammanfattning', () => {
        expect(format_fraga_beskrivning('om planen ska godkännas')).toBe(
            'Du behöver svara på frågor om planen ska godkännas.',
        );
        expect(format_fraga_beskrivning('vilket exportformat som ska användas')).toBe(
            'Du behöver svara på frågor om vilket exportformat som ska användas.',
        );
        expect(format_fraga_beskrivning('')).toBe(FRAGA_BESKRIVNING);
    });

    test('build_fraga_event_payload använder frågetext', () => {
        const tmp_root = fs.mkdtempSync(path.join(os.tmpdir(), 'nabu-fraga-generic-'));
        const payload = build_fraga_event_payload(tmp_root);
        expect(payload.message).toBe(`Nu är jag klar [${payload.projekt}]: ${FRAGA_BESKRIVNING}`);
        fs.rmSync(tmp_root, { recursive: true, force: true });
    });

    test('build_fraga_event_payload inkluderar frågeämne', () => {
        const tmp_root = fs.mkdtempSync(path.join(os.tmpdir(), 'nabu-fraga-'));
        fs.mkdirSync(path.join(tmp_root, '.cursor'), { recursive: true });
        fs.writeFileSync(
            path.join(tmp_root, '.cursor', 'nabu_question_context.txt'),
            'om planen ska godkännas',
            'utf8',
        );
        const payload = build_fraga_event_payload(tmp_root);
        expect(payload.beskrivning).toBe('Du behöver svara på frågor om planen ska godkännas.');
        expect(payload.message).toContain('Du behöver svara på frågor om planen ska godkännas.');
        expect(payload.title).toMatch(/^Cursor fråga \d{2}:\d{2}$/);
        fs.rmSync(tmp_root, { recursive: true, force: true });
    });

    test('resolve_ha_payload_typ tolkar fraga utan tom argv på Windows', () => {
        expect(resolve_ha_payload_typ('fraga')).toBe('fraga');
        expect(resolve_ha_payload_typ(undefined)).toBe('klar');
        expect(resolve_ha_payload_typ('.cursor/nabu_flush_message.txt')).toBe('klar');
    });

    test('ha-payload CLI med fraga som fjärde argument', () => {
        const tmp_root = fs.mkdtempSync(path.join(os.tmpdir(), 'nabu-ha-cli-fraga-'));
        fs.mkdirSync(path.join(tmp_root, '.cursor'), { recursive: true });
        fs.writeFileSync(
            path.join(tmp_root, '.cursor', 'nabu_question_context.txt'),
            'om befintlig commit ska med vid push',
            'utf8',
        );
        const script = path.join(REPO_ROOT, 'scripts', 'nabu_project_klar_message.mjs');
        const result = spawnSync(process.execPath, [script, 'ha-payload', tmp_root, 'fraga'], {
            encoding: 'utf8',
        });
        expect(result.status).toBe(0);
        const payload = JSON.parse(result.stdout.trim());
        expect(payload.title).toMatch(/^Cursor fråga \d{2}:\d{2}$/);
        expect(payload.beskrivning).toContain('befintlig commit ska med vid push');
        fs.rmSync(tmp_root, { recursive: true, force: true });
    });

    test('build_full_klar_message utan projekttext inkluderar agentsammanfattning', () => {
        const tmp_root = fs.mkdtempSync(path.join(os.tmpdir(), 'nabu-klar-full-'));
        const state_dir = path.join(tmp_root, '.cursor', 'hooks', 'state');
        fs.mkdirSync(state_dir, { recursive: true });
        fs.writeFileSync(
            path.join(state_dir, 'last-response.txt'),
            'Detaljer här.\n\nFixade webhook-meddelandet.',
            'utf8',
        );
        fs.writeFileSync(
            path.join(tmp_root, '.cursor', 'nabu_task_context.txt'),
            'Uppdaterar klar-notis',
            'utf8',
        );
        expect(build_full_klar_message(tmp_root)).toBe(
            'Nu är jag klar — Fixade webhook-meddelandet.',
        );
        fs.rmSync(tmp_root, { recursive: true, force: true });
    });

    test('get_klar_summary faller tillbaka till uppgifts-etikett vid långt svar', () => {
        const tmp_root = fs.mkdtempSync(path.join(os.tmpdir(), 'nabu-klar-'));
        const state_dir = path.join(tmp_root, '.cursor', 'hooks', 'state');
        fs.mkdirSync(state_dir, { recursive: true });
        fs.writeFileSync(
            path.join(tmp_root, '.cursor', 'nabu_task_context.txt'),
            'Uppdaterar klar-notis',
            'utf8',
        );
        fs.writeFileSync(
            path.join(state_dir, 'last-response.txt'),
            '# Rubrik\n\n'.repeat(20) + 'Säg till om du vill att jag fortsätter?',
            'utf8',
        );
        expect(get_task_label(tmp_root)).toBe('Uppdaterar klar-notis');
        expect(get_klar_summary(tmp_root)).toBe('Uppdaterar klar-notis');
        fs.rmSync(tmp_root, { recursive: true, force: true });
    });

    test('normalize_ha_event_payload behåller title och message', () => {
        expect(normalize_ha_event_payload({
            title: 'Cursor 14:10',
            message: 'Nu är jag klar [Leffe]: Klar.',
            beskrivning: 'Klar.',
            projekt: 'Leffe',
        })).toEqual({
            title: 'Cursor 14:10',
            message: 'Nu är jag klar [Leffe]: Klar.',
            beskrivning: 'Klar.',
            projekt: 'Leffe',
        });
    });

    test('build CLI skriver UTF-8 med åäö till fil', () => {
        const tmp_root = fs.mkdtempSync(path.join(os.tmpdir(), 'nabu-klar-utf8-'));
        fs.mkdirSync(path.join(tmp_root, '.cursor'), { recursive: true });
        const out_file = path.join(tmp_root, 'out.txt');
        fs.writeFileSync(
            path.join(tmp_root, '.cursor', 'nabu_project_klar_message.txt'),
            'Nu är jag klar med Test.',
            'utf8',
        );
        const result = spawnSync(
            process.execPath,
            [path.join(REPO_ROOT, 'scripts', 'nabu_project_klar_message.mjs'), 'build', tmp_root, out_file],
            { encoding: 'utf8' },
        );
        expect(result.status).toBe(0);
        const bytes = fs.readFileSync(out_file);
        expect(bytes.includes(Buffer.from('är', 'utf8'))).toBe(true);
        fs.rmSync(tmp_root, { recursive: true, force: true });
    });
});

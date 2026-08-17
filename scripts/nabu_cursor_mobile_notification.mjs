/**
 * Gemensamt mobilnotisformat för Cursor via Home Assistant Companion.
 * Titel: Cursor HH:mm
 * Text: Nu är jag klar [projekt]: [beskrivning]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES_FILE = path.join(__dirname, 'nabu_project_klar_messages.json');
const STOCKHOLM_TZ = 'Europe/Stockholm';
export const FRAGA_BESKRIVNING = 'Du behöver svara på frågor.';

/**
 * @param {string} [question_summary]
 * @returns {string}
 */
export function format_fraga_beskrivning(question_summary) {
    const summary = (question_summary ?? '').trim();
    if (!summary) {
        return FRAGA_BESKRIVNING;
    }
    if (/^om\s/i.test(summary)) {
        return `Du behöver svara på frågor ${summary}.`;
    }
    return `Du behöver svara på frågor om ${summary}.`;
}

/**
 * @returns {string}
 */
export function format_notification_time(date = new Date()) {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: STOCKHOLM_TZ,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
}

/**
 * @returns {string}
 */
export function format_notification_title(date = new Date(), typ = 'klar') {
    const time = format_notification_time(date);
    if (typ === 'fraga') {
        return `Cursor fråga ${time}`;
    }
    return `Cursor ${time}`;
}

/**
 * @param {string} projekt
 * @param {string} beskrivning
 * @returns {string}
 */
export function format_notification_message(projekt, beskrivning) {
    const project_label = projekt.trim() || 'Cursor';
    const body = beskrivning.trim() || 'Agenten är klar';
    return `Nu är jag klar [${project_label}]: ${body}`;
}

/**
 * @param {string} repo_root
 * @returns {string}
 */
export function get_project_display_name(repo_root) {
    const basename = path.basename(path.resolve(repo_root));
    if (fs.existsSync(MESSAGES_FILE)) {
        try {
            const map = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
            const project_msg = map[basename];
            if (typeof project_msg === 'string') {
                const match = project_msg.trim().match(/^Nu är jag klar med (.+?)[.]?$/);
                if (match) {
                    return match[1].trim();
                }
            }
        } catch {
            // Ignorera ogiltig JSON.
        }
    }
    const local_file = path.join(repo_root, '.cursor', 'nabu_project_klar_message.txt');
    if (fs.existsSync(local_file)) {
        const local = fs.readFileSync(local_file, 'utf8').trim();
        const match = local.match(/^Nu är jag klar med (.+?)[.]?$/);
        if (match) {
            return match[1].trim();
        }
    }
    return basename;
}

/**
 * @param {string} repo_root
 * @param {{ beskrivning?: string | null, typ?: 'klar' | 'fraga', date?: Date }} [options]
 * @returns {{ title: string, message: string, projekt: string, beskrivning: string }}
 */
export function build_mobile_notification(repo_root, options = {}) {
    const typ = options.typ === 'fraga' ? 'fraga' : 'klar';
    const projekt = get_project_display_name(repo_root);
    const beskrivning = typ === 'fraga'
        ? (options.beskrivning?.trim() || FRAGA_BESKRIVNING)
        : (options.beskrivning?.trim() || 'Agenten är klar');
    const date = options.date ?? new Date();
    return {
        title: format_notification_title(date, typ),
        message: format_notification_message(projekt, beskrivning),
        projekt,
        beskrivning,
        typ,
    };
}

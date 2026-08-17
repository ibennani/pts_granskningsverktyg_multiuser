import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    extract_ask_question_summary,
    save_question_summary,
    truncate_question_summary,
} from '../../scripts/nabu_fraga_notify.mjs';
import { get_question_summary } from '../../scripts/nabu_project_klar_message.mjs';

describe('nabu_fraga_notify', () => {
    test('extract_ask_question_summary läser första prompten', () => {
        const summary = extract_ask_question_summary({
            tool_input: {
                questions: [
                    {
                        id: 'overlap',
                        prompt: 'Hur ska överlappande filer hanteras vid push?',
                        options: [{ id: 'a', label: 'Ta med' }],
                    },
                ],
            },
        });
        expect(summary).toBe('Hur ska överlappande filer hanteras vid push?');
    });

    test('extract_ask_question_summary returnerar null utan frågor', () => {
        expect(extract_ask_question_summary({ tool_input: { questions: [] } })).toBeNull();
        expect(extract_ask_question_summary({})).toBeNull();
    });

    test('truncate_question_summary begränsar längd', () => {
        const long = 'a'.repeat(250);
        expect(truncate_question_summary(long).length).toBeLessThanOrEqual(200);
        expect(truncate_question_summary(long).endsWith('…')).toBe(true);
    });

    test('save_question_summary skriver till nabu_question_context.txt', () => {
        const tmp_root = fs.mkdtempSync(path.join(os.tmpdir(), 'nabu-fraga-save-'));
        save_question_summary(tmp_root, 'om planen ska godkännas');
        expect(get_question_summary(tmp_root)).toBe('om planen ska godkännas');
        fs.rmSync(tmp_root, { recursive: true, force: true });
    });
});

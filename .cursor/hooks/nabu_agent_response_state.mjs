/**
 * Sparar och extraherar agentsvarstext för klar-notis via stop-hook.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const STATE_DIR = path.join(REPO_ROOT, '.cursor', 'hooks', 'state');
export const STATE_FILE = path.join(STATE_DIR, 'last-response.txt');
export const GENERIC_BESKRIVNING = 'Öppna Cursor och läs senaste svaret.';

/**
 * @param {string} raw
 */
export function save_agent_response(raw) {
    if (!raw.trim()) {
        return;
    }
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        return;
    }
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text) {
        return;
    }
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, text, 'utf8');
}

/**
 * @returns {string | null}
 */
export function extract_beskrivning() {
    if (!fs.existsSync(STATE_FILE)) {
        return null;
    }
    let text = fs.readFileSync(STATE_FILE, 'utf8').trim();
    if (!text) {
        return null;
    }
    text = text.replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
    const match = text.match(/^(.{1,220}?[.!?])(?:\s|$)/);
    if (match) {
        return match[1];
    }
    return text.slice(0, 200);
}

/**
 * @param {string} beskrivning
 * @returns {string}
 */
export function build_done_message(beskrivning) {
    const em = '\u2014';
    if (beskrivning.trim().length > 0) {
        return `Nu är jag klar ${em} ${beskrivning.trim()}`;
    }
    return 'Nu är jag klar';
}

/**
 * Projekt-specifik klar-notis per arbetsmapp (repo-rotnamn), med agentsammanfattning sist.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    extract_concluding_summary,
    is_unsuitable_summary,
    response_looks_like_agent_completion,
    trim_summary,
} from './nabu_response_summary.mjs';
import {
    build_mobile_notification,
    format_fraga_beskrivning,
    get_project_display_name,
} from './nabu_cursor_mobile_notification.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES_FILE = path.join(__dirname, 'nabu_project_klar_messages.json');
const KLAR_PREFIX = 'Nu är jag klar';
const EM_DASH = '\u2014';

/**
 * @returns {string[]}
 */
function get_known_project_suffixes() {
    /** @type {string[]} */
    const suffixes = [];
    if (fs.existsSync(MESSAGES_FILE)) {
        try {
            const map = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
            for (const value of Object.values(map)) {
                if (typeof value !== 'string') {
                    continue;
                }
                const trimmed = value.trim();
                if (!trimmed.startsWith(`${KLAR_PREFIX} med `)) {
                    continue;
                }
                suffixes.push(trimmed.slice(`${KLAR_PREFIX} med `.length).trim());
            }
        } catch {
            // Ignorera ogiltig JSON.
        }
    }
    return [...new Set(suffixes)].sort((a, b) => b.length - a.length);
}

/**
 * @param {string} repo_root
 * @returns {string | null}
 */
export function get_project_klar_message(repo_root) {
    const basename = path.basename(path.resolve(repo_root));
    if (fs.existsSync(MESSAGES_FILE)) {
        try {
            const map = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
            const from_map = map[basename];
            if (typeof from_map === 'string' && from_map.trim().length > 0) {
                return from_map.trim();
            }
        } catch {
            // Ogiltig JSON — fall tillbaka till lokal fil.
        }
    }
    const local_file = path.join(repo_root, '.cursor', 'nabu_project_klar_message.txt');
    if (fs.existsSync(local_file)) {
        const local = fs.readFileSync(local_file, 'utf8').trim();
        if (local.length > 0) {
            return local;
        }
    }
    return null;
}

/**
 * @param {string} repo_root
 * @returns {string | null}
 */
export { get_project_display_name };

/**
 * @param {string} repo_root
 * @returns {string | null}
 */
export function extract_response_summary(repo_root) {
    const state_file = path.join(repo_root, '.cursor', 'hooks', 'state', 'last-response.txt');
    if (!fs.existsSync(state_file)) {
        return null;
    }
    const text = fs.readFileSync(state_file, 'utf8');
    return extract_concluding_summary(text);
}

/**
 * @param {string} repo_root
 * @returns {string | null}
 */
export function get_task_label(repo_root) {
    const from_env = process.env.NABU_TASK_LABEL?.trim();
    if (from_env) {
        return trim_summary(from_env);
    }
    const task_path = path.join(repo_root, '.cursor', 'nabu_task_context.txt');
    if (!fs.existsSync(task_path)) {
        return null;
    }
    return trim_summary(fs.readFileSync(task_path, 'utf8'));
}

/**
 * @param {string} repo_root
 * @returns {string | null}
 */
export function get_klar_summary(repo_root) {
    const state_file = path.join(repo_root, '.cursor', 'hooks', 'state', 'last-response.txt');
    const raw_text = fs.existsSync(state_file) ? fs.readFileSync(state_file, 'utf8') : '';
    const task_label = get_task_label(repo_root);

    const from_response = extract_concluding_summary(raw_text);
    if (from_response && !is_unsuitable_summary(from_response)) {
        return from_response;
    }

    if (!response_looks_like_agent_completion(raw_text)) {
        return task_label;
    }

    return task_label;
}

/**
 * @param {string} prefix
 * @param {string | null} summary
 * @returns {string}
 */
export function append_klar_summary(prefix, summary) {
    const base = prefix.trim();
    const tail = summary?.trim() || '';
    if (!tail) {
        return base;
    }
    if (base.endsWith('.') || base.endsWith('!') || base.endsWith('?')) {
        return `${base} ${tail}`.trim();
    }
    return `${base} ${tail}`.trim();
}

/**
 * @param {string | null} task_label
 * @returns {string}
 */
export function build_default_klar_prefix(task_label) {
    const task = task_label?.trim() || '';
    if (task.length > 0) {
        return `${KLAR_PREFIX} ${EM_DASH} ${task}`;
    }
    return KLAR_PREFIX;
}

/**
 * @param {string} repo_root
 * @returns {string}
 */
export function build_full_klar_message(repo_root) {
    const project_msg = get_project_klar_message(repo_root);
    const response_summary = extract_response_summary(repo_root);
    const task_label = get_task_label(repo_root);

    if (project_msg) {
        return append_klar_summary(project_msg, response_summary || task_label);
    }

    const summary = response_summary || task_label;
    if (summary) {
        return `${KLAR_PREFIX} ${EM_DASH} ${summary}`;
    }
    return KLAR_PREFIX;
}

/**
 * @param {string} repo_root
 * @returns {string | null}
 */
export function build_project_klar_message(repo_root) {
    const project_msg = get_project_klar_message(repo_root);
    if (!project_msg) {
        return null;
    }
    return append_klar_summary(project_msg, get_klar_summary(repo_root));
}

/**
 * @param {string} message
 * @returns {{ projekt: string | null, beskrivning: string }}
 */
export function parse_klar_message_parts(message) {
    const fraga_prefix = 'Du måste svara på frågor om ';
    if (message.startsWith(fraga_prefix)) {
        return { projekt: null, beskrivning: message };
    }
    if (!message.startsWith(KLAR_PREFIX)) {
        return { projekt: null, beskrivning: message };
    }

    const tail = message.slice(KLAR_PREFIX.length).trim();
    if (tail.startsWith('med ')) {
        const rest = tail.slice(4).trim();
        const dot_match = rest.match(/^(.+?)[.]\s+(.+)$/s);
        if (dot_match) {
            return {
                projekt: dot_match[1].trim(),
                beskrivning: dot_match[2].trim(),
            };
        }
        for (const suffix of get_known_project_suffixes()) {
            if (rest === suffix) {
                return { projekt: suffix.replace(/\.$/, '').trim(), beskrivning: 'Agenten är klar' };
            }
            if (rest.startsWith(suffix)) {
                const beskrivning = rest.slice(suffix.length).trim();
                return {
                    projekt: suffix.replace(/\.$/, '').trim(),
                    beskrivning: beskrivning || 'Agenten är klar',
                };
            }
        }
        return { projekt: rest.replace(/\.$/, '').trim(), beskrivning: 'Agenten är klar' };
    }

    if (tail.startsWith(EM_DASH)) {
        return { projekt: null, beskrivning: tail.slice(1).trim() || 'Agenten är klar' };
    }

    if (tail.length > 0) {
        return { projekt: null, beskrivning: tail };
    }
    return { projekt: null, beskrivning: 'Agenten är klar' };
}

/**
 * @param {string} message
 * @returns {string}
 */
export function get_webhook_beskrivning_from_message(message) {
    return parse_klar_message_parts(message).beskrivning;
}

/**
 * @param {string} repo_root
 * @param {string} [message]
 * @returns {{ title: string, message: string, projekt: string, beskrivning: string }}
 */
export function build_ha_event_payload(repo_root, message = null) {
    let beskrivning = get_klar_summary(repo_root);
    if (!beskrivning && message) {
        const parts = parse_klar_message_parts(message);
        beskrivning = parts.beskrivning;
        if (!beskrivning || beskrivning === KLAR_PREFIX) {
            beskrivning = null;
        }
    }
    return build_mobile_notification(repo_root, {
        beskrivning: beskrivning || 'Agenten är klar',
        typ: 'klar',
    });
}

/**
 * @param {string} repo_root
 * @returns {string | null}
 */
export function get_question_summary(repo_root) {
    const from_env = process.env.NABU_QUESTION_SUMMARY?.trim();
    if (from_env) {
        return from_env;
    }
    const question_path = path.join(repo_root, '.cursor', 'nabu_question_context.txt');
    if (!fs.existsSync(question_path)) {
        return null;
    }
    const from_file = fs.readFileSync(question_path, 'utf8').trim();
    return from_file.length > 0 ? from_file : null;
}

/**
 * @param {string} repo_root
 * @returns {{ title: string, message: string, projekt: string, beskrivning: string }}
 */
export function build_fraga_event_payload(repo_root) {
    const beskrivning = format_fraga_beskrivning(get_question_summary(repo_root));
    return build_mobile_notification(repo_root, { beskrivning, typ: 'fraga' });
}

/**
 * @param {string} [message_file]
 * @returns {'klar' | 'fraga'}
 */
export function resolve_ha_payload_typ(message_file) {
    return message_file === 'fraga' ? 'fraga' : 'klar';
}

/**
 * @param {string} [message_file]
 * @returns {string | null}
 */
export function resolve_ha_payload_message_file(message_file) {
    if (!message_file || message_file === 'fraga') {
        return null;
    }
    return message_file;
}

const is_main = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (is_main && process.argv[2] === 'build') {
    const repo_root = process.argv[3] || path.resolve(__dirname, '..');
    const message = build_full_klar_message(repo_root);
    const out_file = process.argv[4];
    if (out_file) {
        const out_path = path.resolve(out_file);
        fs.mkdirSync(path.dirname(out_path), { recursive: true });
        fs.writeFileSync(out_path, message, 'utf8');
    } else {
        process.stdout.write(message);
    }
} else if (is_main && process.argv[2] === 'ha-payload') {
    const repo_root = process.argv[3] || path.resolve(__dirname, '..');
    const message_file_arg = process.argv[4];
    const typ = resolve_ha_payload_typ(message_file_arg);
    if (typ === 'fraga') {
        process.stdout.write(`${JSON.stringify(build_fraga_event_payload(repo_root))}\n`);
    } else {
        const message_file = resolve_ha_payload_message_file(message_file_arg);
        const legacy_message = message_file && fs.existsSync(message_file)
            ? fs.readFileSync(message_file, 'utf8').trim()
            : null;
        process.stdout.write(`${JSON.stringify(build_ha_event_payload(repo_root, legacy_message))}\n`);
    }
}

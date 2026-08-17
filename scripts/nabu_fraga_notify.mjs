/**
 * Skickar fråge-notis till mobil när Cursor väntar på svar (AskQuestion).
 */

import fs from 'node:fs';
import path from 'node:path';
import { build_fraga_event_payload, get_question_summary } from './nabu_project_klar_message.mjs';
import { send_cursor_agent_klar_event } from './nabu_ha_cursor_klar_event.mjs';
import {
    append_debug_log,
    mark_notify_sent,
    was_notify_sent_recently,
    NOTIFY_DEDUP_MS,
} from './nabu_work_state.mjs';

const MAX_SUMMARY_LENGTH = 200;

/**
 * @param {string} text
 * @returns {string}
 */
export function truncate_question_summary(text) {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (trimmed.length <= MAX_SUMMARY_LENGTH) {
        return trimmed;
    }
    return `${trimmed.slice(0, MAX_SUMMARY_LENGTH - 1).trimEnd()}…`;
}

/**
 * @param {unknown} hook_input
 * @returns {string | null}
 */
export function extract_ask_question_summary(hook_input) {
    if (!hook_input || typeof hook_input !== 'object') {
        return null;
    }
    const input = /** @type {Record<string, unknown>} */ (hook_input);
    const tool_input = input.tool_input ?? input.toolInput ?? input.input;
    if (!tool_input || typeof tool_input !== 'object') {
        return null;
    }
    const questions = /** @type {{ questions?: unknown }} */ (tool_input).questions;
    if (!Array.isArray(questions) || questions.length === 0) {
        return null;
    }
    const first = questions[0];
    if (!first || typeof first !== 'object') {
        return null;
    }
    const prompt = /** @type {{ prompt?: string }} */ (first).prompt;
    if (typeof prompt !== 'string' || !prompt.trim()) {
        return null;
    }
    return truncate_question_summary(prompt);
}

/**
 * @param {string} repo_root
 * @param {string} summary
 */
export function save_question_summary(repo_root, summary) {
    const trimmed = truncate_question_summary(summary);
    if (!trimmed) {
        return;
    }
    const cursor_dir = path.join(repo_root, '.cursor');
    fs.mkdirSync(cursor_dir, { recursive: true });
    fs.writeFileSync(
        path.join(cursor_dir, 'nabu_question_context.txt'),
        trimmed,
        'utf8',
    );
}

/**
 * @param {string} repo_root
 * @param {{ summary?: string | null, skip_dedup?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
export async function send_fraga_notification(repo_root, options = {}) {
    if (!options.skip_dedup && was_notify_sent_recently(NOTIFY_DEDUP_MS, repo_root)) {
        append_debug_log('fraga_skipped_dedup', {}, repo_root);
        return false;
    }

    const existing = get_question_summary(repo_root);
    const summary = options.summary?.trim() || existing;
    if (!summary && !existing) {
        append_debug_log('fraga_skipped_no_summary', {}, repo_root);
        return false;
    }
    if (options.summary?.trim() && options.summary.trim() !== existing) {
        save_question_summary(repo_root, options.summary);
    }

    const payload = build_fraga_event_payload(repo_root);
    const sent = await send_cursor_agent_klar_event(payload);
    if (sent) {
        mark_notify_sent(repo_root);
        append_debug_log('fraga_sent', { beskrivning: payload.beskrivning }, repo_root);
    } else {
        append_debug_log('fraga_send_failed', {}, repo_root);
    }
    return sent;
}

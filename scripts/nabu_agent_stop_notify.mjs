/**
 * Skickar klar-notis från Cursor stop-hook när agenten avslutats.
 */

import {
    NOTIFY_DEDUP_MS,
    append_debug_log,
    mark_notify_sent,
    prepare_agent_stop_notify,
    read_state,
    try_flush,
    was_notify_sent_recently,
} from './nabu_work_state.mjs';
import { send_cursor_agent_klar_event } from './nabu_ha_cursor_klar_event.mjs';
import { build_ha_event_payload } from './nabu_project_klar_message.mjs';

export const GENERIC_BESKRIVNING = 'Öppna Cursor och läs senaste svaret.';

/**
 * @param {string} repo_root
 * @param {{ title: string, message: string, beskrivning: string }} payload
 * @returns {Promise<boolean>}
 */
async function send_stop_payload(repo_root, payload) {
    const sent = await send_cursor_agent_klar_event(payload);
    if (sent) {
        mark_notify_sent(repo_root);
    }
    return sent;
}

/**
 * @param {string} repo_root
 * @returns {Promise<boolean>}
 */
export async function send_agent_stop_klar_notify(repo_root) {
    const payload = build_ha_event_payload(repo_root);
    if (!payload.beskrivning || payload.beskrivning === GENERIC_BESKRIVNING) {
        append_debug_log('agent_stop_skipped_no_summary', {}, repo_root);
        return false;
    }
    const sent = await send_stop_payload(repo_root, payload);
    if (sent) {
        append_debug_log('agent_stop_sent', { beskrivning: payload.beskrivning }, repo_root);
    }
    return sent;
}

/**
 * @param {string} repo_root
 * @param {Record<string, unknown>} hook_input
 * @returns {Promise<boolean>}
 */
export async function handle_agent_stop_notify(repo_root, hook_input) {
    const status = typeof hook_input.status === 'string' ? hook_input.status : 'completed';
    if (status !== 'completed') {
        append_debug_log('agent_stop_skipped_status', { status }, repo_root);
        return false;
    }

    if (was_notify_sent_recently(NOTIFY_DEDUP_MS, repo_root)) {
        append_debug_log('agent_stop_skipped_dedup', {}, repo_root);
        return false;
    }

    const state = read_state(repo_root);
    if (state.notify_requested) {
        prepare_agent_stop_notify(repo_root);
        const flush = try_flush(repo_root);
        if (flush.sent) {
            return send_agent_stop_klar_notify(repo_root);
        }
        append_debug_log('agent_stop_flush_pending', { reason: flush.reason ?? null }, repo_root);
    }

    return send_agent_stop_klar_notify(repo_root);
}

/**
 * Skickar klar-notis när agenten slutar utan att notify_done.cmd redan hanterat det.
 */

import {
    NOTIFY_DEDUP_MS,
    mark_notify_sent,
    read_state,
    was_notify_sent_recently,
} from '../../scripts/nabu_work_state.mjs';
import { send_cursor_agent_klar_event } from '../../scripts/nabu_ha_cursor_klar_event.mjs';
import {
    extract_beskrivning,
    GENERIC_BESKRIVNING,
} from './nabu_agent_response_state.mjs';
import { read_hook_input } from './nabu_hook_common.mjs';

if (process.env.CURSOR_AGENT) {
    process.exit(0);
}

const hook_input = read_hook_input();
const status = typeof hook_input.status === 'string' ? hook_input.status : 'completed';
if (status !== 'completed') {
    process.exit(0);
}

if (was_notify_sent_recently(NOTIFY_DEDUP_MS)) {
    process.exit(0);
}

const state = read_state();
if (state.notify_requested) {
    process.exit(0);
}

const beskrivning = extract_beskrivning();
if (!beskrivning || beskrivning === GENERIC_BESKRIVNING) {
    process.exit(0);
}

const sent = await send_cursor_agent_klar_event(beskrivning);
if (sent) {
    mark_notify_sent();
}

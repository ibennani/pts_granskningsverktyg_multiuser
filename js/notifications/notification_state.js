/**
 * @file Tillstånd för globala notiser: fingeravtryck och deduplicering av vanliga meddelanden
 * efter att användaren stängt samma notis.
 */

/**
 * @typedef {Object} NotificationDedupeState
 * @property {string|null} regular_message_block_fp
 * @property {string|null} last_regular_shown_fp
 */

/**
 * @returns {NotificationDedupeState}
 */
export function create_notification_dedupe_state() {
    return {
        regular_message_block_fp: null,
        last_regular_shown_fp: null
    };
}

/**
 * @param {string} message
 * @param {string} [type]
 * @returns {string}
 */
export function fingerprint_regular_message(message, type) {
    const t = type && String(type).trim() !== '' ? String(type).trim() : 'info';
    const m = typeof message === 'string' ? message.trim() : '';
    return `${t}|${m}`;
}

/**
 * Uppdaterar blockering vid visning av vanlig notis; returnerar true om visning ska hoppas över.
 * @param {NotificationDedupeState} state
 * @param {string} message
 * @param {string} [type]
 * @returns {boolean}
 */
export function should_skip_regular_message_display(state, message, type) {
    if (!message || message.trim() === '') {
        return false;
    }
    const fp = fingerprint_regular_message(message, type);
    if (state.regular_message_block_fp && fp === state.regular_message_block_fp) {
        return true;
    }
    if (state.regular_message_block_fp && fp !== state.regular_message_block_fp) {
        state.regular_message_block_fp = null;
    }
    return false;
}

/**
 * @param {NotificationDedupeState} state
 * @param {string} message
 * @param {string} [type]
 */
export function mark_regular_message_shown(state, message, type) {
    state.last_regular_shown_fp = fingerprint_regular_message(message, type);
}

/**
 * Vid rensning av vanlig notis: spara fingeravtryck som block om notisen var synlig.
 * @param {NotificationDedupeState} state
 * @param {boolean} was_visible
 */
export function apply_clear_regular_message(state, was_visible) {
    if (was_visible && state.last_regular_shown_fp) {
        state.regular_message_block_fp = state.last_regular_shown_fp;
    }
    state.last_regular_shown_fp = null;
}

/**
 * @param {NotificationDedupeState} state
 */
export function reset_notification_dedupe_state(state) {
    state.regular_message_block_fp = null;
    state.last_regular_shown_fp = null;
}

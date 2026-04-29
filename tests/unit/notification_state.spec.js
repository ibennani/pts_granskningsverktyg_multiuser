/**
 * @jest-environment jsdom
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    create_notification_dedupe_state,
    fingerprint_regular_message,
    should_skip_regular_message_display,
    mark_regular_message_shown,
    apply_clear_regular_message,
    reset_notification_dedupe_state
} from '../../js/notifications/notification_state.js';

describe('notification_state', () => {
    let state;

    beforeEach(() => {
        state = create_notification_dedupe_state();
    });

    test('fingerprint_regular_message normaliserar typ och trimmar meddelande', () => {
        expect(fingerprint_regular_message('  x  ', 'info')).toBe('info|x');
        expect(fingerprint_regular_message('x', '')).toBe('info|x');
        expect(fingerprint_regular_message('x', 'warning')).toBe('warning|x');
    });

    test('should_skip efter block samma fp', () => {
        mark_regular_message_shown(state, 'A', 'info');
        apply_clear_regular_message(state, true);
        expect(state.regular_message_block_fp).toBe('info|A');
        expect(should_skip_regular_message_display(state, 'A', 'info')).toBe(true);
    });

    test('should_skip false efter annan notis visats', () => {
        mark_regular_message_shown(state, 'A', 'info');
        apply_clear_regular_message(state, true);
        expect(should_skip_regular_message_display(state, 'B', 'warning')).toBe(false);
        expect(state.regular_message_block_fp).toBeNull();
    });

    test('reset_notification_dedupe_state nollställer allt', () => {
        mark_regular_message_shown(state, 'A', 'info');
        apply_clear_regular_message(state, true);
        reset_notification_dedupe_state(state);
        expect(state.regular_message_block_fp).toBeNull();
        expect(state.last_regular_shown_fp).toBeNull();
    });
});

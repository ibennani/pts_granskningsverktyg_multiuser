/**
 * @fileoverview Tester för synk av statusknappars active-klass och aria-pressed.
 */

import { ChecklistHandler } from '../../js/components/requirement_audit/ChecklistHandler.js';

describe('ChecklistHandler statusknapp-synk', () => {
    test('uppdaterar aria-pressed när klassen stämmer men aria-pressed är fel', () => {
        const button = document.createElement('button');
        button.setAttribute('aria-pressed', 'true');

        ChecklistHandler._apply_status_button_active_state(
            button,
            false,
            { check_id: 'check_a', pc_id: 'pc_1', action: 'set-pc-passed' },
            { skip_if_unchanged: true }
        );

        expect(button.classList.contains('active')).toBe(false);
        expect(button.getAttribute('aria-pressed')).toBe('false');
    });
});

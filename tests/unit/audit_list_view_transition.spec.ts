/**
 * @fileoverview Enhetstester för granskningslistans växlingsanimation.
 */

import { jest, describe, test, expect } from '@jest/globals';
import {
    clear_audit_lists_transition_classes,
    run_audit_lists_toggle_animation,
    AUDIT_LIST_TOGGLE_TRANSITION_MS
} from '../../js/logic/audit_list_view_transition.ts';

describe('audit_list_view_transition', () => {
    test('AUDIT_LIST_TOGGLE_TRANSITION_MS är halva totala listväxlingstiden', () => {
        expect(AUDIT_LIST_TOGGLE_TRANSITION_MS).toBe(250);
    });

    test('clear_audit_lists_transition_classes tar bort opacity-klasser', () => {
        const container = document.createElement('div');
        container.classList.add(
            'audit-lists--transition-exit',
            'audit-lists--transition-enter-start'
        );

        clear_audit_lists_transition_classes(container);

        expect(container.classList.contains('audit-lists--transition-exit')).toBe(false);
        expect(container.classList.contains('audit-lists--transition-enter-start')).toBe(false);
    });

    test('run_audit_lists_toggle_animation lämnar inte kvar exit-klass efter render', async () => {
        const container = document.createElement('div');
        container.className = 'audit-audits-sections-container';
        document.body.appendChild(container);

        const run_render = jest.fn(() => {
            container.innerHTML = '<section>Lista</section>';
        });

        await run_audit_lists_toggle_animation(() => container, run_render);

        expect(run_render).toHaveBeenCalledTimes(1);
        expect(container.classList.contains('audit-lists--transition-exit')).toBe(false);
        expect(container.classList.contains('audit-lists--transition-enter-start')).toBe(false);
        expect(container.textContent).toContain('Lista');

        document.body.removeChild(container);
    });
});

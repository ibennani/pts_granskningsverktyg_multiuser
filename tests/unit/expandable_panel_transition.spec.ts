/**
 * Tester för expandable_panel_transition.ts
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
    EXPANDABLE_PANEL_EXPANDED_CLASS,
    animate_expandable_panel,
    apply_instant_expanded_panel_state,
    prefers_reduced_motion
} from '../../js/utils/expandable_panel_transition.ts';

describe('expandable_panel_transition', () => {
    let panel;
    let host;

    beforeEach(() => {
        document.body.innerHTML = '';
        host = document.createElement('div');
        panel = document.createElement('div');
        panel.className = 'expandable-panel';
        host.appendChild(panel);
        document.body.appendChild(host);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('apply_instant_expanded_panel_state visar expanderad panel utan hidden', () => {
        apply_instant_expanded_panel_state(panel, host, true);
        expect(host.hidden).toBe(false);
        expect(panel.classList.contains(EXPANDABLE_PANEL_EXPANDED_CLASS)).toBe(true);
    });

    test('apply_instant_expanded_panel_state döljer kollapsad panel', () => {
        apply_instant_expanded_panel_state(panel, host, false);
        expect(host.hidden).toBe(true);
        expect(panel.classList.contains(EXPANDABLE_PANEL_EXPANDED_CLASS)).toBe(false);
    });

    test('animate_expandable_panel sätter hidden efter kollaps', async () => {
        apply_instant_expanded_panel_state(panel, host, true);

        const match_media = window.matchMedia;
        window.matchMedia = () => ({ matches: true });

        await animate_expandable_panel(panel, host, false);

        expect(host.hidden).toBe(true);
        expect(panel.classList.contains(EXPANDABLE_PANEL_EXPANDED_CLASS)).toBe(false);

        window.matchMedia = match_media;
    });

    test('animate_expandable_panel expanderar utan hidden', async () => {
        host.hidden = true;
        const match_media = window.matchMedia;
        window.matchMedia = () => ({ matches: true });

        await animate_expandable_panel(panel, host, true);

        expect(host.hidden).toBe(false);
        expect(panel.classList.contains(EXPANDABLE_PANEL_EXPANDED_CLASS)).toBe(true);

        window.matchMedia = match_media;
    });

    test('prefers_reduced_motion returnerar boolean', () => {
        expect(typeof prefers_reduced_motion()).toBe('boolean');
    });
});

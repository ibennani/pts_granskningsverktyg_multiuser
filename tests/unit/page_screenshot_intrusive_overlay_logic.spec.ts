/**
 * @fileoverview Enhetstester för störande overlay-regler vid skärmdump.
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_intrusive_overlay_dismiss_config,
    build_intrusive_overlay_hide_config,
    element_text_suggests_consent_exclusion,
    element_text_suggests_intrusive_overlay,
    get_intrusive_close_label_priority,
    is_intrusive_close_button_label,
    is_intrusive_reject_button_label,
} from '../../server/services/page_screenshot_intrusive_overlay_logic.ts';

describe('page_screenshot_intrusive_overlay_logic', () => {
    test('element_text_suggests_intrusive_overlay känner igen medlems-popup', () => {
        expect(element_text_suggests_intrusive_overlay('Bli medlem – få 10% på ditt nästa köp')).toBe(true);
        expect(element_text_suggests_intrusive_overlay('Get 10% off your next purchase')).toBe(true);
    });

    test('element_text_suggests_intrusive_overlay känner igen nyhetsbrev', () => {
        expect(element_text_suggests_intrusive_overlay('Skriv upp dig på vårt nyhetsbrev')).toBe(true);
        expect(element_text_suggests_intrusive_overlay('Subscribe to our newsletter')).toBe(true);
    });

    test('element_text_suggests_intrusive_overlay exkluderar cookie-text', () => {
        expect(element_text_suggests_intrusive_overlay('Vi använder cookies på webbplatsen.')).toBe(false);
        expect(element_text_suggests_consent_exclusion('Vi använder cookies på webbplatsen.')).toBe(true);
    });

    test('is_intrusive_close_button_label känner igen stäng-knappar', () => {
        expect(is_intrusive_close_button_label('Stäng')).toBe(true);
        expect(is_intrusive_close_button_label('Nej tack')).toBe(true);
        expect(is_intrusive_close_button_label('Close')).toBe(true);
    });

    test('is_intrusive_reject_button_label blockerar prenumerera', () => {
        expect(is_intrusive_reject_button_label('Prenumerera')).toBe(true);
        expect(is_intrusive_reject_button_label('Subscribe now')).toBe(true);
        expect(is_intrusive_close_button_label('Prenumerera')).toBe(false);
    });

    test('get_intrusive_close_label_priority rankar nej tack högre', () => {
        expect(get_intrusive_close_label_priority('Nej tack')).toBe(3);
        expect(get_intrusive_close_label_priority('Stäng')).toBe(2);
    });

    test('build_intrusive_overlay configs inkluderar selectors', () => {
        const dismiss = build_intrusive_overlay_dismiss_config();
        const hide = build_intrusive_overlay_hide_config();
        expect(dismiss.close_selectors.length).toBeGreaterThan(3);
        expect(dismiss.container_selectors).toContain('[role="dialog"]');
        expect(dismiss.shadow_host_selectors).toContain('triggerbee-widget');
        expect(hide.hide_selectors).toContain('#intercom-container');
        expect(dismiss.overlay_detection.context_keywords).toContain('nyhetsbrev');
    });
});

/**
 * @fileoverview Enhetstester för cookie-banner-regler vid skärmdump.
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_cookie_banner_hide_config,
    button_label_requires_consent_context,
    element_text_suggests_consent,
    get_cookie_accept_label_priority,
    is_cookie_accept_all_button_label,
    is_cookie_accept_button_label,
    is_cookie_reject_button_label,
} from '../../server/services/page_screenshot_cookie_consent_logic.ts';

describe('page_screenshot_cookie_consent_logic', () => {
    test('is_cookie_accept_button_label känner igen svenska acceptera-knappar', () => {
        expect(is_cookie_accept_button_label('Godkänn alla')).toBe(true);
        expect(is_cookie_accept_button_label('Acceptera cookies')).toBe(true);
        expect(is_cookie_accept_button_label('Tillåt alla')).toBe(true);
    });

    test('is_cookie_accept_all_button_label skiljer accept all från generisk accept', () => {
        expect(is_cookie_accept_all_button_label('Godkänn alla')).toBe(true);
        expect(is_cookie_accept_all_button_label('Godkänn alla cookies')).toBe(true);
        expect(is_cookie_accept_button_label('Godkänn')).toBe(true);
        expect(is_cookie_accept_all_button_label('Godkänn')).toBe(false);
    });

    test('get_cookie_accept_label_priority rankar accept all högre', () => {
        expect(get_cookie_accept_label_priority('Accept all')).toBe(2);
        expect(get_cookie_accept_label_priority('Accept')).toBe(1);
        expect(get_cookie_accept_label_priority('Avvisa')).toBe(0);
    });

    test('is_cookie_accept_button_label känner igen engelska accept-knappar', () => {
        expect(is_cookie_accept_button_label('Accept all')).toBe(true);
        expect(is_cookie_accept_button_label('Allow all cookies')).toBe(true);
    });

    test('is_cookie_reject_button_label identifierar avvisning', () => {
        expect(is_cookie_reject_button_label('Avvisa alla')).toBe(true);
        expect(is_cookie_reject_button_label('Reject all')).toBe(true);
        expect(is_cookie_reject_button_label('Endast nödvändiga')).toBe(true);
    });

    test('build_cookie_banner_hide_config inkluderar container-selectors', () => {
        const config = build_cookie_banner_hide_config();
        expect(config.hide_selectors).toContain('#CybotCookiebotDialog');
        expect(config.hide_selectors).toContain('[id^="sp_message_container_"]');
        expect(config.hide_selectors.length).toBeGreaterThan(10);
        expect(config.overlay_detection).toBeDefined();
        expect(config.container_selectors.length).toBeGreaterThan(5);
    });

    test('element_text_suggests_consent skiljer cookie från nyhetsbrev', () => {
        expect(element_text_suggests_consent('Vi använder kakor på webbplatsen.')).toBe(true);
        expect(element_text_suggests_consent('Prenumerera på nyhetsbrev')).toBe(false);
    });

    test('button_label_requires_consent_context flaggar generiska knappar', () => {
        expect(button_label_requires_consent_context('OK')).toBe(true);
        expect(button_label_requires_consent_context('Acceptera alla')).toBe(false);
    });

    test('is_cookie_accept_button_label klickar inte avvisning', () => {
        expect(is_cookie_accept_button_label('Avvisa alla')).toBe(false);
        expect(is_cookie_accept_button_label('Reject all')).toBe(false);
    });
});

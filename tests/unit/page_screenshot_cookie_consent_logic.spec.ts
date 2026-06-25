/**
 * @fileoverview Enhetstester för cookie-banner-regler vid skärmdump.
 */
import { describe, test, expect } from '@jest/globals';
import {
    is_cookie_accept_button_label,
    is_cookie_reject_button_label,
} from '../../server/services/page_screenshot_cookie_consent_logic.ts';

describe('page_screenshot_cookie_consent_logic', () => {
    test('is_cookie_accept_button_label känner igen svenska acceptera-knappar', () => {
        expect(is_cookie_accept_button_label('Godkänn alla')).toBe(true);
        expect(is_cookie_accept_button_label('Acceptera cookies')).toBe(true);
        expect(is_cookie_accept_button_label('Tillåt alla')).toBe(true);
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

    test('is_cookie_accept_button_label klickar inte avvisning', () => {
        expect(is_cookie_accept_button_label('Avvisa alla')).toBe(false);
        expect(is_cookie_accept_button_label('Reject all')).toBe(false);
    });
});

/**
 * @fileoverview Enhetstester för CMP-mönsterfamiljer vid skärmdump.
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_cmp_accept_button_selectors,
    build_overlay_detection_config,
    button_label_requires_consent_context,
    element_text_suggests_consent,
    hostname_matches_cmp_network_substring,
    hostname_matches_cmp_vendor_suffix,
    matches_cmp_storage_cookie_name,
    matches_cmp_storage_local_storage_key,
    pathname_matches_cmp_network_substring,
} from '../../server/services/page_screenshot_cmp_pattern_families.ts';

describe('page_screenshot_cmp_pattern_families', () => {
    test('hostname_matches_cmp_vendor_suffix känner igen Cookiebot', () => {
        expect(hostname_matches_cmp_vendor_suffix('consent.cookiebot.com')).toBe(true);
    });

    test('hostname_matches_cmp_network_substring fångar okänd consent-domän', () => {
        expect(hostname_matches_cmp_network_substring('cdn.example-consent.io')).toBe(true);
        expect(hostname_matches_cmp_network_substring('www.pts.se')).toBe(false);
    });

    test('pathname_matches_cmp_network_substring fångar consent-sökvägar', () => {
        expect(pathname_matches_cmp_network_substring('/assets/consent/bundle.js')).toBe(true);
        expect(pathname_matches_cmp_network_substring('/assets/app.js')).toBe(false);
    });

    test('element_text_suggests_consent känner igen cookie-text', () => {
        expect(element_text_suggests_consent('Vi använder cookies för att förbättra upplevelsen.')).toBe(true);
        expect(element_text_suggests_consent('Prenumerera på vårt nyhetsbrev')).toBe(false);
    });

    test('button_label_requires_consent_context för generiska knappar', () => {
        expect(button_label_requires_consent_context('Fortsätt')).toBe(true);
        expect(button_label_requires_consent_context('Godkänn alla')).toBe(false);
    });

    test('matches_cmp_storage_cookie_name fångar pattern-baserade namn', () => {
        expect(matches_cmp_storage_cookie_name('sp_consent')).toBe(true);
        expect(matches_cmp_storage_cookie_name('euconsent-v2')).toBe(true);
        expect(matches_cmp_storage_cookie_name('session_id')).toBe(false);
    });

    test('matches_cmp_storage_local_storage_key fångar consent-nycklar', () => {
        expect(matches_cmp_storage_local_storage_key('user_consent_settings')).toBe(true);
        expect(matches_cmp_storage_local_storage_key('unrelated')).toBe(false);
    });

    test('build_overlay_detection_config innehåller trösklar', () => {
        const config = build_overlay_detection_config();
        expect(config.min_z_index).toBeGreaterThan(0);
        expect(config.consent_context_keywords.length).toBeGreaterThan(3);
    });

    test('build_cmp_accept_button_selectors inkluderar Schibsted-selectors', () => {
        const selectors = build_cmp_accept_button_selectors();
        expect(selectors).toContain('button.sp_choice_type_11');
    });
});

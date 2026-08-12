/**
 * @fileoverview Enhetstester för nya CMP-leverantörspaket.
 */
import { describe, test, expect } from '@jest/globals';
import { should_block_cmp_request } from '../../server/services/page_screenshot_cmp_block_logic.ts';
import {
    build_cmp_accept_button_selectors,
    hostname_matches_cmp_vendor_suffix,
    matches_cmp_storage_cookie_name,
} from '../../server/services/page_screenshot_cmp_pattern_families.ts';
import { termly_vendor } from '../../server/services/cmp/cmp_vendors/registry.ts';
import { iubenda_vendor } from '../../server/services/cmp/cmp_vendors/registry.ts';
import { complianz_vendor } from '../../server/services/cmp/cmp_vendors/registry.ts';
import { borlabs_vendor } from '../../server/services/cmp/cmp_vendors/registry.ts';
import { cookiefirst_vendor } from '../../server/services/cmp/cmp_vendors/registry.ts';
import { tarteaucitron_vendor } from '../../server/services/cmp/cmp_vendors/registry.ts';
import { commanders_act_vendor } from '../../server/services/cmp/cmp_vendors/registry.ts';
import { cookieyes_vendor } from '../../server/services/cmp/cmp_vendors/registry.ts';

describe('cmp vendor packages', () => {
    test('Termly nätverk och selectors', () => {
        expect(hostname_matches_cmp_vendor_suffix('cdn.termly.io')).toBe(true);
        expect(
            should_block_cmp_request('https://cdn.termly.io/v1/embed.min.js', 'script')
        ).toBe(true);
        const selectors = build_cmp_accept_button_selectors();
        for (const selector of termly_vendor.accept_button_selectors ?? []) {
            expect(selectors).toContain(selector);
        }
    });

    test('iubenda nätverk och selectors', () => {
        expect(hostname_matches_cmp_vendor_suffix('cdn.iubenda.com')).toBe(true);
        expect(
            should_block_cmp_request('https://cdn.iubenda.com/cs/iubenda_cs.js', 'script')
        ).toBe(true);
        const selectors = build_cmp_accept_button_selectors();
        for (const selector of iubenda_vendor.accept_button_selectors ?? []) {
            expect(selectors).toContain(selector);
        }
        expect(matches_cmp_storage_cookie_name('_iub_cs-12345678')).toBe(true);
    });

    test('Complianz nätverk och storage', () => {
        expect(hostname_matches_cmp_vendor_suffix('cdn.complianz.io')).toBe(true);
        expect(matches_cmp_storage_cookie_name('cmplz_consent_status')).toBe(true);
        const selectors = build_cmp_accept_button_selectors();
        expect(selectors).toContain('.cmplz-accept');
    });

    test('Borlabs nätverk och storage', () => {
        expect(hostname_matches_cmp_vendor_suffix('cookie.borlabs.io')).toBe(true);
        expect(matches_cmp_storage_cookie_name('borlabsCookie')).toBe(true);
        const selectors = build_cmp_accept_button_selectors();
        for (const selector of borlabs_vendor.accept_button_selectors ?? []) {
            expect(selectors).toContain(selector);
        }
    });

    test('CookieFirst nätverk och selectors', () => {
        expect(hostname_matches_cmp_vendor_suffix('consent.cookiefirst.com')).toBe(true);
        const selectors = build_cmp_accept_button_selectors();
        for (const selector of cookiefirst_vendor.accept_button_selectors ?? []) {
            expect(selectors).toContain(selector);
        }
    });

    test('Tarteaucitron nätverk och selectors', () => {
        expect(hostname_matches_cmp_vendor_suffix('cdn.tarteaucitron.io')).toBe(true);
        const selectors = build_cmp_accept_button_selectors();
        for (const selector of tarteaucitron_vendor.accept_button_selectors ?? []) {
            expect(selectors).toContain(selector);
        }
    });

    test('Commanders Act nätverk och selectors', () => {
        expect(hostname_matches_cmp_vendor_suffix('cdn.trustcommander.net')).toBe(true);
        expect(
            should_block_cmp_request('https://cdn.tagcommander.com/tc.js', 'script')
        ).toBe(true);
        const selectors = build_cmp_accept_button_selectors();
        for (const selector of commanders_act_vendor.accept_button_selectors ?? []) {
            expect(selectors).toContain(selector);
        }
    });

    test('CookieYes förstärkt stöd', () => {
        const selectors = build_cmp_accept_button_selectors();
        for (const selector of cookieyes_vendor.accept_button_selectors ?? []) {
            expect(selectors).toContain(selector);
        }
        expect(matches_cmp_storage_cookie_name('cookieyes-consent')).toBe(true);
    });
});

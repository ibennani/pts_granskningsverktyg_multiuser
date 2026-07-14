/**
 * @fileoverview Enhetstester för domän-cache av CMP-samtycke.
 */
import { describe, test, expect } from '@jest/globals';
import {
    filter_cmp_cookies,
    filter_cmp_local_storage,
    get_registrable_domain,
    has_usable_consent_snapshot,
    is_consent_cache_entry_expired,
    merge_consent_snapshots,
} from '../../server/services/page_screenshot_consent_cache_logic.ts';

describe('page_screenshot_consent_cache_logic', () => {
    test('get_registrable_domain tar bort www', () => {
        expect(get_registrable_domain('https://www.pts.se/sida')).toBe('pts.se');
        expect(get_registrable_domain('https://PTS.SE/')).toBe('pts.se');
    });

    test('filter_cmp_cookies behåller bara whitelist', () => {
        const filtered = filter_cmp_cookies([
            { name: 'CookieConsent', value: 'abc', domain: '.pts.se', path: '/' },
            { name: 'session_id', value: 'secret', domain: '.pts.se', path: '/' },
        ]);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].name).toBe('CookieConsent');
    });

    test('filter_cmp_local_storage behåller bara whitelist', () => {
        const filtered = filter_cmp_local_storage({
            didomi_token: 'token',
            unrelated: 'value',
        });
        expect(filtered).toEqual({ didomi_token: 'token' });
    });

    test('filter_cmp_cookies fångar pattern-baserade cookie-namn', () => {
        const filtered = filter_cmp_cookies([
            { name: 'sp_consent', value: 'yes', domain: '.example.se', path: '/' },
            { name: 'session_id', value: 'secret', domain: '.example.se', path: '/' },
        ]);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].name).toBe('sp_consent');
    });

    test('filter_cmp_local_storage fångar pattern-baserade nycklar', () => {
        const filtered = filter_cmp_local_storage({
            user_consent_settings: '{"ok":true}',
            unrelated: 'value',
        });
        expect(filtered).toEqual({ user_consent_settings: '{"ok":true}' });
    });

    test('merge_consent_snapshots slår ihop cookies och localStorage', () => {
        const seed = {
            domain: 'pts.se',
            updated_at: '2026-01-01T00:00:00.000Z',
            source: 'manual' as const,
            cookies: [{ name: 'CookieConsent', value: 'a', domain: '.pts.se', path: '/' }],
            local_storage: {},
        };
        const learned = {
            domain: 'pts.se',
            updated_at: '2026-07-01T00:00:00.000Z',
            source: 'learned' as const,
            cookies: [{ name: 'OptanonConsent', value: 'b', domain: '.pts.se', path: '/' }],
            local_storage: { klaro: '{}' },
        };
        const merged = merge_consent_snapshots(seed, learned);
        expect(merged.cookies).toHaveLength(2);
        expect(merged.local_storage).toEqual({ klaro: '{}' });
        expect(merged.source).toBe('merged');
    });

    test('has_usable_consent_snapshot returnerar false för utgången post', () => {
        const expired = {
            domain: 'pts.se',
            updated_at: '2020-01-01T00:00:00.000Z',
            source: 'learned' as const,
            cookies: [{ name: 'CookieConsent', value: 'x', domain: '.pts.se', path: '/' }],
            local_storage: {},
        };
        expect(is_consent_cache_entry_expired(expired, 90, Date.parse('2026-07-14T00:00:00.000Z'))).toBe(true);
        expect(has_usable_consent_snapshot(expired)).toBe(false);
    });
});

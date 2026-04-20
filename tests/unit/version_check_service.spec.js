import { describe, test, expect, afterEach } from '@jest/globals';
import { build_reload_url, get_build_info_fetch_options } from '../../js/logic/version_check_service.js';

describe('version_check_service', () => {
    test('build_reload_url bevarar path + query + hash och lägger till __reload', () => {
        const href = `${window.location.origin}/v2/a?tab=stickprov#obs-7`;
        const out = build_reload_url(href, 123);
        expect(out).toBe('/v2/a?tab=stickprov&__reload=123#obs-7');
    });

    test('build_reload_url ersätter befintlig __reload om den redan finns', () => {
        const href = `${window.location.origin}/v2/a?tab=1&__reload=1#x`;
        const out = build_reload_url(href, 999);
        expect(out).toBe('/v2/a?tab=1&__reload=999#x');
    });

    test('get_build_info_fetch_options använder alltid no-store', () => {
        expect(get_build_info_fetch_options()).toEqual({ cache: 'no-store' });
    });
});


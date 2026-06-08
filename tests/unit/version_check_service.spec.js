import { describe, test, expect } from '@jest/globals';
import { get_build_info_fetch_options, is_remote_timestamp_newer } from '../../js/logic/version_check_service.js';
import { build_reload_url } from '../../js/utils/build_reload_url.js';

describe('version_check_service', () => {
    test('build_reload_url re-export fungerar via utils', () => {
        const href = `${window.location.origin}/v2/?x=1#y`;
        expect(build_reload_url(href, 42)).toBe('/v2/?x=1&__reload=42#y');
    });

    test('get_build_info_fetch_options använder alltid no-store', () => {
        expect(get_build_info_fetch_options()).toEqual({ cache: 'no-store' });
    });

    test('is_remote_timestamp_newer returnerar true när servern är nyare', () => {
        expect(is_remote_timestamp_newer('2026-04-21T09:07:00.000Z', '2026-04-21T15:17:01.304Z')).toBe(true);
    });

    test('is_remote_timestamp_newer returnerar false när värden saknas eller är lika/gamla', () => {
        expect(is_remote_timestamp_newer(null, '2026-04-21T15:17:01.304Z')).toBe(false);
        expect(is_remote_timestamp_newer('2026-04-21T15:17:01.304Z', null)).toBe(false);
        expect(is_remote_timestamp_newer('2026-04-21T15:17:01.304Z', '2026-04-21T15:17:01.304Z')).toBe(false);
        expect(is_remote_timestamp_newer('2026-04-21T15:17:01.304Z', '2026-04-21T09:07:00.000Z')).toBe(false);
    });
});


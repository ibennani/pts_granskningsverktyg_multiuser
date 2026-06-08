import { describe, test, expect } from '@jest/globals';
import { build_reload_url } from '../../js/utils/build_reload_url.js';

describe('build_reload_url', () => {
    test('bevarar path + query + hash och lägger till __reload', () => {
        const href = `${window.location.origin}/v2/a?tab=stickprov#obs-7`;
        const out = build_reload_url(href, 123);
        expect(out).toBe('/v2/a?tab=stickprov&__reload=123#obs-7');
    });

    test('ersätter befintlig __reload om den redan finns', () => {
        const href = `${window.location.origin}/v2/a?tab=1&__reload=1#x`;
        const out = build_reload_url(href, 999);
        expect(out).toBe('/v2/a?tab=1&__reload=999#x');
    });
});

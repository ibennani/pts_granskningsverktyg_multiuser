/**
 * @fileoverview Enhetstester för råladdning av Puppeteer browser_scripts.
 * @jest-environment jsdom
 */
import { describe, test, expect } from '@jest/globals';
import { browser_dismiss_cookie_banners, browser_find_cookie_overlay_roots, browser_is_cookie_banner_visible, browser_hide_cookie_banners_for_screenshot, browser_find_intrusive_overlay_roots, browser_is_intrusive_overlay_visible } from '../../server/services/page_screenshot_browser_scripts_loader.js';
import { build_intrusive_overlay_dismiss_config } from '../../server/services/page_screenshot_intrusive_overlay_logic.ts';

describe('page_screenshot_browser_scripts_loader', () => {
    test('laddar browser_scripts utan tsx __name-injektion', () => {
        const source = browser_dismiss_cookie_banners.toString();
        expect(source.includes('__name')).toBe(false);
        expect(source.startsWith('function browser_dismiss_cookie_banners')).toBe(true);
    });

    test('laddar browser_is_cookie_banner_visible', () => {
        const source = browser_is_cookie_banner_visible.toString();
        expect(source.startsWith('function browser_is_cookie_banner_visible')).toBe(true);
    });

    test('laddar browser_hide_cookie_banners_for_screenshot', () => {
        const source = browser_hide_cookie_banners_for_screenshot.toString();
        expect(source.startsWith('function browser_hide_cookie_banners_for_screenshot')).toBe(true);
    });

    test('laddar browser_find_cookie_overlay_roots', () => {
        const source = browser_find_cookie_overlay_roots.toString();
        expect(source.includes('__name')).toBe(false);
        expect(source.startsWith('function browser_find_cookie_overlay_roots')).toBe(true);
    });

    test('browser_is_intrusive_overlay_visible använder samma roots som find', () => {
        const dismiss_config = build_intrusive_overlay_dismiss_config();
        document.body.innerHTML = '<main><p>Sortiment Erbjudanden Magazine community</p></main>';
        expect(browser_find_intrusive_overlay_roots(dismiss_config).length).toBe(0);
        expect(browser_is_intrusive_overlay_visible(dismiss_config)).toBe(false);
    });
});

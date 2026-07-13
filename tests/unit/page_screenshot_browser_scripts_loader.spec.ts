/**
 * @fileoverview Enhetstester för råladdning av Puppeteer browser_scripts.
 */
import { describe, test, expect } from '@jest/globals';
import { browser_dismiss_cookie_banners } from '../../server/services/page_screenshot_browser_scripts_loader.js';

describe('page_screenshot_browser_scripts_loader', () => {
    test('laddar browser_scripts utan tsx __name-injektion', () => {
        const source = browser_dismiss_cookie_banners.toString();
        expect(source.includes('__name')).toBe(false);
        expect(source.startsWith('function browser_dismiss_cookie_banners')).toBe(true);
    });
});

/**
 * @fileoverview Försöker stänga cookie-banners via Puppeteer före skärmdump.
 */

import type { Page } from 'puppeteer';
import { browser_dismiss_cookie_banners } from './page_screenshot_browser_scripts.js';
import { build_cookie_banner_dismiss_config } from './page_screenshot_cookie_consent_logic.js';

const POST_DISMISS_SETTLE_MS = 700;
const MAX_DISMISS_ATTEMPTS = 2;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Klickar på vanliga «acceptera»-knappar om en cookie-banner syns.
 * @returns true om minst ett klick gjordes
 */
export async function dismiss_cookie_banners_before_screenshot(page: Page): Promise<boolean> {
    const config = build_cookie_banner_dismiss_config();
    let clicked = false;

    for (let attempt = 0; attempt < MAX_DISMISS_ATTEMPTS; attempt++) {
        const did_click = await page.evaluate(browser_dismiss_cookie_banners, config);
        if (did_click) {
            clicked = true;
            await delay(POST_DISMISS_SETTLE_MS);
        } else {
            break;
        }
    }

    return clicked;
}

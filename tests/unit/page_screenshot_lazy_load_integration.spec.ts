/**
 * @fileoverview Integrationstest: lazy-bilder laddas före skärmdump.
 * @jest-environment node
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';
import {
    launch_capture_browser,
    prepare_capture_page,
    navigate_for_screenshot_capture,
    capture_viewport_png_with_adjustments,
} from '../../server/services/page_capture_session.ts';

async function count_broken_visible_images(page: Page): Promise<number> {
    return page.evaluate(() => {
        let count = 0;
        for (const img of document.images) {
            const rect = img.getBoundingClientRect();
            if (rect.width > 40 && rect.height > 40 && img.naturalWidth < 2) {
                count += 1;
            }
        }
        return count;
    });
}

describe('page_screenshot_lazy_load integration', () => {
    let browser: Awaited<ReturnType<typeof launch_capture_browser>>;

    beforeAll(async () => {
        browser = await launch_capture_browser();
    }, 60_000);

    afterAll(async () => {
        if (browser) await browser.close();
    }, 30_000);

    test('apohem produktsida har inga synliga trasiga bilder efter capture', async () => {
        const page = await browser.newPage();
        try {
            await prepare_capture_page(page);
            const url = 'https://www.apohem.se/harvard/bjorn-axen-salt-water-spray-150-ml';
            await navigate_for_screenshot_capture(page, url, 60_000);
            await capture_viewport_png_with_adjustments(page, url);
            const broken = await count_broken_visible_images(page);
            expect(broken).toBe(0);
        } finally {
            await page.close();
        }
    }, 120_000);
});

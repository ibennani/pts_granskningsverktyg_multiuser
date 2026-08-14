/**
 * @fileoverview Integrationstester för störande overlay-dismiss mot fixtures.
 * @jest-environment node
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';
import { start_overlay_fixture_server } from './overlay_fixture_server.ts';
import {
    dismiss_intrusive_overlays_before_screenshot,
    hide_intrusive_overlays_visually_for_screenshot,
    is_intrusive_overlay_visible,
} from '../../server/services/page_screenshot_intrusive_overlay.ts';

let fixture_server: Awaited<ReturnType<typeof start_overlay_fixture_server>>;

beforeAll(async () => {
    fixture_server = await start_overlay_fixture_server();
}, 30_000);

afterAll(async () => {
    if (fixture_server) await fixture_server.close();
}, 15_000);

async function with_page(fn: (page: Page) => Promise<void>): Promise<void> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
        await fn(page);
    } finally {
        await browser.close();
    }
}

describe('intrusive overlay integration fixtures', () => {
    test('nyhetsbrev-modal kan dismissas', async () => {
        await with_page(async (page) => {
            await page.goto(`${fixture_server.base_url}/newsletter.html`, { waitUntil: 'load' });
            expect(await is_intrusive_overlay_visible(page)).toBe(true);
            const result = await dismiss_intrusive_overlays_before_screenshot(page, {
                wait_for_overlay: true,
            });
            expect(result.clicked).toBe(true);
            await hide_intrusive_overlays_visually_for_screenshot(page);
            expect(await is_intrusive_overlay_visible(page)).toBe(false);
        });
    }, 90_000);

    test('chatt-widget kan döljas utan klick', async () => {
        await with_page(async (page) => {
            await page.goto(`${fixture_server.base_url}/chat-widget.html`, { waitUntil: 'load' });
            expect(await is_intrusive_overlay_visible(page)).toBe(true);
            const hidden = await hide_intrusive_overlays_visually_for_screenshot(page);
            expect(hidden).toBeGreaterThan(0);
            expect(await is_intrusive_overlay_visible(page)).toBe(false);
        });
    }, 90_000);

    test('app-popup kan dismissas med not now', async () => {
        await with_page(async (page) => {
            await page.goto(`${fixture_server.base_url}/app-popup.html`, { waitUntil: 'load' });
            expect(await is_intrusive_overlay_visible(page)).toBe(true);
            const result = await dismiss_intrusive_overlays_before_screenshot(page, {
                wait_for_overlay: true,
            });
            expect(result.clicked).toBe(true);
            await hide_intrusive_overlays_visually_for_screenshot(page);
            expect(await is_intrusive_overlay_visible(page)).toBe(false);
        });
    }, 90_000);

    test('fördröjd medlems-popup med ikon-stäng kan döljas', async () => {
        await with_page(async (page) => {
            await page.goto(`${fixture_server.base_url}/membership-popup.html`, { waitUntil: 'load' });
            expect(await is_intrusive_overlay_visible(page)).toBe(false);
            await new Promise((resolve) => setTimeout(resolve, 3600));
            expect(await is_intrusive_overlay_visible(page)).toBe(true);
            const result = await dismiss_intrusive_overlays_before_screenshot(page, {
                wait_for_overlay: true,
            });
            expect(result.clicked).toBe(true);
            await hide_intrusive_overlays_visually_for_screenshot(page);
            expect(await is_intrusive_overlay_visible(page)).toBe(false);
        });
    }, 90_000);

    test('e-handelsstartsida med kampanjer döljer inte huvudinnehåll', async () => {
        await with_page(async (page) => {
            await page.goto(`${fixture_server.base_url}/ecommerce-home.html`, { waitUntil: 'load' });
            const main_text_before = await page.$eval('main', (el) => (el.textContent || '').trim());
            expect(main_text_before.length).toBeGreaterThan(20);

            const hidden = await hide_intrusive_overlays_visually_for_screenshot(page);
            expect(hidden).toBeLessThanOrEqual(2);

            const main_visible = await page.$eval('main', (el) => {
                const style = window.getComputedStyle(el);
                return style.visibility !== 'hidden' && style.display !== 'none';
            });
            expect(main_visible).toBe(true);

            const scroll_h = await page.evaluate(() =>
                Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
            );
            expect(scroll_h).toBeGreaterThan(600);
        });
    }, 90_000);
});

/**
 * @fileoverview Integrationstester för CMP-dismiss mot fixtures.
 * @jest-environment node
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';
import { start_cmp_fixture_server } from './cmp_fixture_server.ts';
import {
    dismiss_cookie_banners_before_screenshot,
    hide_cookie_banners_visually_for_screenshot,
    is_cookie_banner_visible,
} from '../../server/services/page_screenshot_cookie_consent.ts';
import { enable_cmp_request_block_for_screenshot } from '../../server/services/page_screenshot_cmp_block.ts';

let fixture_server: Awaited<ReturnType<typeof start_cmp_fixture_server>>;

beforeAll(async () => {
    fixture_server = await start_cmp_fixture_server();
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

describe('cmp integration fixtures', () => {
    test('Termly-banner kan dismissas', async () => {
        await with_page(async (page) => {
            await enable_cmp_request_block_for_screenshot(page);
            await page.goto(`${fixture_server.base_url}/termly.html`, { waitUntil: 'load' });
            expect(await is_cookie_banner_visible(page)).toBe(true);
            const result = await dismiss_cookie_banners_before_screenshot(page, {
                wait_for_banner: true,
            });
            expect(result.clicked).toBe(true);
            await hide_cookie_banners_visually_for_screenshot(page);
            expect(await is_cookie_banner_visible(page)).toBe(false);
        });
    }, 60_000);

    test('iubenda-banner kan dismissas', async () => {
        await with_page(async (page) => {
            await enable_cmp_request_block_for_screenshot(page);
            await page.goto(`${fixture_server.base_url}/iubenda.html`, { waitUntil: 'load' });
            const result = await dismiss_cookie_banners_before_screenshot(page, {
                wait_for_banner: true,
            });
            expect(result.clicked).toBe(true);
            await hide_cookie_banners_visually_for_screenshot(page);
            expect(await is_cookie_banner_visible(page)).toBe(false);
        });
    }, 60_000);

    test('Complianz-banner kan dismissas', async () => {
        await with_page(async (page) => {
            await enable_cmp_request_block_for_screenshot(page);
            await page.goto(`${fixture_server.base_url}/complianz.html`, { waitUntil: 'load' });
            const result = await dismiss_cookie_banners_before_screenshot(page, {
                wait_for_banner: true,
            });
            expect(result.clicked).toBe(true);
            await hide_cookie_banners_visually_for_screenshot(page);
            expect(await is_cookie_banner_visible(page)).toBe(false);
        });
    }, 60_000);

    test('CookieFirst-banner kan dismissas', async () => {
        await with_page(async (page) => {
            await enable_cmp_request_block_for_screenshot(page);
            await page.goto(`${fixture_server.base_url}/cookiefirst.html`, { waitUntil: 'load' });
            const result = await dismiss_cookie_banners_before_screenshot(page, {
                wait_for_banner: true,
            });
            expect(result.clicked).toBe(true);
            await hide_cookie_banners_visually_for_screenshot(page);
            expect(await is_cookie_banner_visible(page)).toBe(false);
        });
    }, 60_000);
});

/**
 * @fileoverview Tar skärmavbilder (viewport-bredd, max 3× höjd) med Puppeteer/Chromium.
 */
import puppeteer, { type Browser, type Page } from 'puppeteer';
import {
    auto_scroll_lazy_content,
    read_document_scroll_height,
    scroll_to_top,
    settle_after_lazy_load,
} from './page_screenshot_lazy_load.js';
import {
    assert_acceptable_navigation_status,
    configure_stealth_page,
    page_has_renderable_content,
    PUPPETEER_LAUNCH_ARGS,
} from './page_screenshot_stealth.js';
import { dismiss_cookie_banners_before_screenshot } from './page_screenshot_cookie_consent.js';
import { compute_screenshot_clip_height_css } from './page_screenshot_capture_height.js';

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const DEVICE_SCALE_FACTOR = 2;
const NAVIGATION_TIMEOUT_MS = 30_000;

export type CapturePageScreenshotInput = {
    url: string;
    timeout_ms?: number;
};

export type CapturePageScreenshotResult = {
    png_buffer: Buffer;
    page_title: string;
};

async function read_page_title(page: Page): Promise<string> {
    const title = await page.title();
    const trimmed = String(title || '').trim();
    return trimmed || 'sida';
}

async function prepare_page(page: Page): Promise<void> {
    await configure_stealth_page(page);
    await page.setViewport({
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
}

async function navigate_and_validate(page: Page, url: string, timeout_ms: number): Promise<void> {
    const response = await page.goto(url, {
        waitUntil: 'load',
        timeout: timeout_ms,
    });

    if (!response) {
        throw new Error('Ingen svar från sidan');
    }

    const status = response.status();
    const has_content = await page_has_renderable_content(page);
    assert_acceptable_navigation_status(status, has_content);
}

async function capture_full_page_png(page: Page): Promise<{ png_buffer: Buffer; page_title: string }> {
    await dismiss_cookie_banners_before_screenshot(page);
    await auto_scroll_lazy_content(page);
    await settle_after_lazy_load(page);
    await scroll_to_top(page);
    await dismiss_cookie_banners_before_screenshot(page);

    const page_title = await read_page_title(page);
    const scroll_height_css = await read_document_scroll_height(page);
    const capture_height_css = compute_screenshot_clip_height_css(scroll_height_css, VIEWPORT_WIDTH);

    await page.setViewport({
        width: VIEWPORT_WIDTH,
        height: capture_height_css,
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
    await scroll_to_top(page);

    const png_buffer = Buffer.from(
        await page.screenshot({
            type: 'png',
            fullPage: false,
        })
    );

    return { png_buffer, page_title };
}

/**
 * Navigerar till URL och returnerar sidans dokumenttitel (ingen skärmdump).
 */
export async function fetch_page_title_from_url(
    input: CapturePageScreenshotInput
): Promise<{ page_title: string }> {
    const { url, timeout_ms = NAVIGATION_TIMEOUT_MS } = input;
    let browser: Browser | undefined;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: PUPPETEER_LAUNCH_ARGS,
        });
        const page = await browser.newPage();
        await prepare_page(page);
        await navigate_and_validate(page, url, timeout_ms);
        const page_title = await read_page_title(page);
        return { page_title };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Navigerar till URL, laddar lazy content och returnerar en PNG (max höjd 3× bredd).
 */
export async function capture_page_screenshot(
    input: CapturePageScreenshotInput
): Promise<CapturePageScreenshotResult> {
    const { url, timeout_ms = NAVIGATION_TIMEOUT_MS } = input;
    let browser: Browser | undefined;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: PUPPETEER_LAUNCH_ARGS,
        });
        const page = await browser.newPage();
        await prepare_page(page);
        await navigate_and_validate(page, url, timeout_ms);
        return await capture_full_page_png(page);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

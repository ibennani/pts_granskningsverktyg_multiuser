/**
 * @fileoverview Scroll och väntelogik för att ladda lazy content före fullPage-skärmdump.
 */

import type { Page } from 'puppeteer';
import {
    browser_auto_scroll_lazy_content,
    browser_read_document_scroll_height,
    browser_scroll_to_top,
    browser_wait_for_lazy_images,
} from './page_screenshot_browser_scripts_loader.js';

export const LAZY_SCROLL_STEP_PX = 400;
export const LAZY_SCROLL_PAUSE_MS = 150;
export const LAZY_SCROLL_MAX_PASSES = 6;
export const LAZY_SCROLL_STABLE_PASSES = 2;
export const POST_LAZY_LOAD_SETTLE_MS = 1200;
export const LAZY_IMAGE_WAIT_MS = 3000;

export type LazyLoadScrollPassResult = {
    pass_index: number;
    height_before: number;
    height_after: number;
    stable_passes: number;
};

/**
 * Avgör om fler scroll-pass behövs när sidhöjden slutat växa.
 */
export function should_continue_lazy_load_passes(
    stable_passes: number,
    pass_index: number,
    max_passes: number,
    stable_passes_needed: number
): boolean {
    if (pass_index >= max_passes) return false;
    return stable_passes < stable_passes_needed;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Scrollar stegvis genom sidan och kör flera pass tills höjden stabiliserats.
 */
export async function auto_scroll_lazy_content(page: Page): Promise<void> {
    await page.evaluate(browser_auto_scroll_lazy_content, {
        step_px: LAZY_SCROLL_STEP_PX,
        pause_ms: LAZY_SCROLL_PAUSE_MS,
        max_passes: LAZY_SCROLL_MAX_PASSES,
        stable_passes_needed: LAZY_SCROLL_STABLE_PASSES,
    });
}

/**
 * Väntar kort på att synliga bilder ska laddas efter scroll.
 */
export async function wait_for_lazy_images(page: Page, timeout_ms: number): Promise<void> {
    await page.evaluate(browser_wait_for_lazy_images, timeout_ms);
}

export async function settle_after_lazy_load(page: Page): Promise<void> {
    await wait_for_lazy_images(page, LAZY_IMAGE_WAIT_MS);
    await delay(POST_LAZY_LOAD_SETTLE_MS);
    try {
        await page.waitForNetworkIdle({ idleTime: 400, timeout: 5000 });
    } catch {
        // Sidor med websocket/polling — fortsätt ändå
    }
}

export async function scroll_to_top(page: Page): Promise<void> {
    await page.evaluate(browser_scroll_to_top);
}

/** Läser dokumentets scrollHeight i sidans kontext (för capture-höjd). */
export async function read_document_scroll_height(page: Page): Promise<number> {
    const height = await page.evaluate(browser_read_document_scroll_height);
    return typeof height === 'number' && Number.isFinite(height) ? height : 0;
}

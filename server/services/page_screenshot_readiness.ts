/**
 * @fileoverview Väntar på meningsfullt huvudinnehåll före skärmdump.
 */
import type { Page } from 'puppeteer';
import { browser_read_main_content_lengths } from './page_screenshot_browser_scripts_loader.js';

export const MAIN_CONTENT_MIN_TEXT_LENGTH = 40;
export const MAIN_CONTENT_READY_TIMEOUT_MS = 5000;
export const MAIN_CONTENT_READY_POLL_MS = 250;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Returnerar true om main/article eller body har tillräckligt med synlig text.
 */
export function page_has_main_content_text(
    main_lengths: number[] | undefined,
    body_text_length: number,
    min_length = MAIN_CONTENT_MIN_TEXT_LENGTH
): boolean {
    if (Array.isArray(main_lengths) && main_lengths.some((length) => length >= min_length)) {
        return true;
    }
    return body_text_length >= min_length;
}

/**
 * Poll:ar tills huvudinnehåll verkar renderat eller timeout.
 */
export async function wait_for_screenshot_content_ready(page: Page): Promise<void> {
    const deadline = Date.now() + MAIN_CONTENT_READY_TIMEOUT_MS;

    while (Date.now() < deadline) {
        const lengths = await page.evaluate(browser_read_main_content_lengths);
        if (page_has_main_content_text(lengths.main_lengths, lengths.body_text_length)) {
            return;
        }

        await delay(MAIN_CONTENT_READY_POLL_MS);
    }
}

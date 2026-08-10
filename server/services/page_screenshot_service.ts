/**
 * @fileoverview Tar skärmavbilder (viewport-bredd, max 3× höjd) med Puppeteer/Chromium.
 */
import {
    launch_capture_browser,
    prepare_capture_page,
    navigate_and_validate_capture_page,
    navigate_for_screenshot_capture,
    capture_viewport_png_with_adjustments,
    read_capture_page_title,
    CAPTURE_NAVIGATION_TIMEOUT_MS,
} from './page_capture_session.js';

export type CapturePageScreenshotInput = {
    url: string;
    timeout_ms?: number;
};

export type CapturePageScreenshotResult = {
    png_buffer: Buffer;
    page_title: string;
};

/**
 * Navigerar till URL och returnerar sidans dokumenttitel (ingen skärmdump).
 */
export async function fetch_page_title_from_url(
    input: CapturePageScreenshotInput
): Promise<{ page_title: string }> {
    const { url, timeout_ms = CAPTURE_NAVIGATION_TIMEOUT_MS } = input;
    const browser = await launch_capture_browser();
    try {
        const page = await browser.newPage();
        await prepare_capture_page(page);
        await navigate_and_validate_capture_page(page, url, timeout_ms);
        const page_title = await read_capture_page_title(page);
        return { page_title };
    } finally {
        await browser.close();
    }
}

/**
 * Navigerar till URL, laddar lazy content och returnerar en PNG (max höjd 3× bredd).
 */
export async function capture_page_screenshot(
    input: CapturePageScreenshotInput
): Promise<CapturePageScreenshotResult> {
    const { url, timeout_ms = CAPTURE_NAVIGATION_TIMEOUT_MS } = input;
    const browser = await launch_capture_browser();
    try {
        const page = await browser.newPage();
        await prepare_capture_page(page);
        await navigate_for_screenshot_capture(page, url, timeout_ms);
        const result = await capture_viewport_png_with_adjustments(page, url);
        return { png_buffer: result.png_buffer, page_title: result.page_title };
    } finally {
        await browser.close();
    }
}

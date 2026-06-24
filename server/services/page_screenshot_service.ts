/**
 * @fileoverview Tar fullsidsskärmdumpar (topp till botten) med Puppeteer/Chromium.
 */
import puppeteer, { type Browser, type Page } from 'puppeteer';

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const DEVICE_SCALE_FACTOR = 2;
const SCROLL_STEP_PX = 150;
const SCROLL_PAUSE_MS = 100;
const POST_SCROLL_SETTLE_MS = 500;
const NAVIGATION_TIMEOUT_MS = 30_000;

export type CapturePageScreenshotInput = {
    url: string;
    timeout_ms?: number;
};

export type CapturePageScreenshotResult = {
    png_buffer: Buffer;
    page_title: string;
};

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function auto_scroll_page(page: Page): Promise<void> {
    await page.evaluate(async (step_px: number, pause_ms: number) => {
        await new Promise<void>((resolve) => {
            let total_height = 0;
            const timer = window.setInterval(() => {
                const scroll_height = document.body?.scrollHeight ?? document.documentElement.scrollHeight;
                window.scrollBy(0, step_px);
                total_height += step_px;
                if (total_height >= scroll_height) {
                    window.clearInterval(timer);
                    resolve();
                }
            }, pause_ms);
        });
    }, SCROLL_STEP_PX, SCROLL_PAUSE_MS);
}

async function scroll_to_top(page: Page): Promise<void> {
    await page.evaluate(() => {
        window.scrollTo(0, 0);
    });
}

async function read_page_title(page: Page): Promise<string> {
    const title = await page.title();
    const trimmed = String(title || '').trim();
    return trimmed || 'sida';
}

/**
 * Navigerar till URL, laddar lazy content och returnerar en fullPage PNG.
 */
export async function capture_page_screenshot(
    input: CapturePageScreenshotInput
): Promise<CapturePageScreenshotResult> {
    const { url, timeout_ms = NAVIGATION_TIMEOUT_MS } = input;
    let browser: Browser | undefined;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
        await page.setViewport({
            width: VIEWPORT_WIDTH,
            height: VIEWPORT_HEIGHT,
            deviceScaleFactor: DEVICE_SCALE_FACTOR,
        });

        const response = await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: timeout_ms,
        });

        if (!response) {
            throw new Error('Ingen svar från sidan');
        }

        const status = response.status();
        if (status >= 400) {
            throw new Error(`Sidan svarade med HTTP ${status}`);
        }

        await auto_scroll_page(page);
        await delay(POST_SCROLL_SETTLE_MS);
        await scroll_to_top(page);

        const page_title = await read_page_title(page);
        const png_buffer = Buffer.from(
            await page.screenshot({
                type: 'png',
                fullPage: true,
            })
        );

        return { png_buffer, page_title };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

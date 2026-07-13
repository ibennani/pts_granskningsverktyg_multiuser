/**
 * @fileoverview Gör Puppeteer-sidor mer lika en vanlig Chrome-webbläsare (mot bot-block).
 */
import type { Page } from 'puppeteer';
import {
    browser_hide_webdriver_flag,
    browser_page_has_renderable_content,
} from './page_screenshot_browser_scripts_loader.js';

export const CHROME_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const PUPPETEER_LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
];

/**
 * Sätter user agent, språk och döljer navigator.webdriver.
 */
export async function configure_stealth_page(page: Page): Promise<void> {
    await page.setUserAgent(CHROME_USER_AGENT);
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });
    await page.evaluateOnNewDocument(browser_hide_webdriver_flag);
}

/**
 * True om sidan verkar ha renderat innehåll trots HTTP-fel (t.ex. vissa 403-svar).
 */
export async function page_has_renderable_content(page: Page): Promise<boolean> {
    return page.evaluate(browser_page_has_renderable_content);
}

/**
 * Kastar om HTTP-status inte går att acceptera för skärmdump.
 */
export function assert_acceptable_navigation_status(status: number, has_content: boolean): void {
    if (status < 400) return;
    if ((status === 401 || status === 403) && has_content) return;
    throw new Error(`Sidan svarade med HTTP ${status}`);
}

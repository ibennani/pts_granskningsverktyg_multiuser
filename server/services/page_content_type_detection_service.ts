/**
 * @fileoverview Detekterar innehållstyper på en webbsida via Puppeteer DOM-analys.
 */
import puppeteer, { type Browser, type Page } from 'puppeteer';
import {
    auto_scroll_lazy_content,
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
import {
    get_serializable_detection_rules,
    map_dom_hits_to_content_type_ids,
    type SerializableDetectionRule,
} from './page_content_type_detection_rules.js';

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const DEVICE_SCALE_FACTOR = 2;
const NAVIGATION_TIMEOUT_MS = 30_000;

export type DetectPageContentTypesInput = {
    url: string;
    allowed_content_type_ids: string[];
    timeout_ms?: number;
};

export type DetectPageContentTypesResult = {
    detected_content_type_ids: string[];
    triggered_signals: string[];
};

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

async function prepare_page_content(page: Page): Promise<void> {
    await dismiss_cookie_banners_before_screenshot(page, { wait_for_banner: false });
    await auto_scroll_lazy_content(page);
    await settle_after_lazy_load(page);
    await scroll_to_top(page);
    await dismiss_cookie_banners_before_screenshot(page, { wait_for_banner: false });
}

const COMMON_CONTENT_MARKER_SELECTOR =
    'form, table, nav, main, img, video, audio, [role="navigation"], [role="table"], [role="main"]';

/** Väntar kort på vanliga innehållselement (SPA) utan att avbryta om inget hittas. */
async function wait_for_common_content_markers(page: Page): Promise<void> {
    try {
        await page.waitForSelector(COMMON_CONTENT_MARKER_SELECTOR, { timeout: 5000 });
    } catch {
        // Sidor utan dessa element — fortsätt ändå.
    }
}

async function collect_triggered_signals(
    page: Page,
    rules: SerializableDetectionRule[]
): Promise<string[]> {
    return page.evaluate((eval_rules: SerializableDetectionRule[]) => {
        const triggered: string[] = [];
        for (const rule of eval_rules) {
            let found = false;
            for (const selector of rule.selectors) {
                try {
                    if (document.querySelector(selector)) {
                        found = true;
                        break;
                    }
                } catch {
                    // Ogiltig selector — hoppa över.
                }
            }
            if (found && !triggered.includes(rule.signal)) {
                triggered.push(rule.signal);
            }
        }
        return triggered;
    }, rules);
}

/**
 * Navigerar till URL och returnerar detekterade innehållstyp-ID:n från regelfilen.
 */
export async function detect_page_content_types(
    input: DetectPageContentTypesInput
): Promise<DetectPageContentTypesResult> {
    const { url, allowed_content_type_ids, timeout_ms = NAVIGATION_TIMEOUT_MS } = input;
    const sanitized_allowed = [...new Set(
        allowed_content_type_ids.map((id) => String(id || '').trim()).filter(Boolean)
    )];

    if (sanitized_allowed.length === 0) {
        return { detected_content_type_ids: [], triggered_signals: [] };
    }

    let browser: Browser | undefined;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: PUPPETEER_LAUNCH_ARGS,
        });
        const page = await browser.newPage();
        await prepare_page(page);
        await navigate_and_validate(page, url, timeout_ms);
        await prepare_page_content(page);
        await wait_for_common_content_markers(page);

        const rules = get_serializable_detection_rules();
        const triggered_signals = await collect_triggered_signals(page, rules);
        const detected_content_type_ids = map_dom_hits_to_content_type_ids(
            sanitized_allowed,
            triggered_signals
        );

        return { detected_content_type_ids, triggered_signals };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

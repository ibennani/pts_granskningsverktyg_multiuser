/**
 * @fileoverview Försöker stänga cookie-banners via Puppeteer före skärmdump.
 */

import type { Frame, Page } from 'puppeteer';
import {
    browser_dismiss_cookie_banners,
    browser_hide_cookie_banners_for_screenshot,
    browser_is_cookie_banner_visible,
} from './page_screenshot_browser_scripts_loader.js';
import {
    build_cookie_banner_dismiss_config,
    build_cookie_banner_hide_config,
    COOKIE_ACCEPT_BUTTON_SELECTORS,
} from './page_screenshot_cookie_consent_logic.js';

const POST_DISMISS_SETTLE_MS = 700;
const MAX_DISMISS_ATTEMPTS = 4;
const BANNER_WAIT_TIMEOUT_MS = 3500;
const BANNER_GONE_TIMEOUT_MS = 5000;
const BANNER_POLL_MS = 250;
const CONSENT_SETTLE_MS = 300;

export type DismissCookieBannerResult = {
    clicked: boolean;
    banner_gone: boolean;
    matched_selector: string | null;
};

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function get_banner_visibility_config() {
    const config = build_cookie_banner_dismiss_config();
    return { container_selectors: config.container_selectors };
}

function get_search_frames(page: Page): Array<Frame | Page> {
    if (typeof page.frames === 'function') {
        return page.frames();
    }
    if (typeof page.mainFrame === 'function') {
        return [page.mainFrame()];
    }
    return [page];
}

export async function is_cookie_banner_visible(page: Page): Promise<boolean> {
    const config = get_banner_visibility_config();
    for (const frame of get_search_frames(page)) {
        try {
            const visible = await frame.evaluate(
                browser_is_cookie_banner_visible as (config: ReturnType<typeof get_banner_visibility_config>) => boolean,
                config
            );
            if (visible === true) return true;
        } catch {
            // Cross-origin frame — hoppa över.
        }
    }
    return false;
}

async function wait_for_cookie_banner(page: Page, timeout_ms: number): Promise<boolean> {
    const deadline = Date.now() + timeout_ms;
    while (Date.now() < deadline) {
        if (await is_cookie_banner_visible(page)) {
            return true;
        }
        await delay(BANNER_POLL_MS);
    }
    return false;
}

export async function wait_until_cookie_banner_gone(page: Page, timeout_ms: number): Promise<boolean> {
    const deadline = Date.now() + timeout_ms;
    while (Date.now() < deadline) {
        if (!(await is_cookie_banner_visible(page))) {
            return true;
        }
        await delay(BANNER_POLL_MS);
    }
    return !(await is_cookie_banner_visible(page));
}

async function click_selector_in_frames(page: Page, selector: string): Promise<boolean> {
    for (const frame of get_search_frames(page)) {
        try {
            const handle = await frame.$(selector);
            if (!handle) continue;
            const box = await handle.boundingBox();
            if (!box || box.width < 4 || box.height < 4) continue;
            await handle.click();
            return true;
        } catch {
            // Nästa frame.
        }
    }
    return false;
}

async function click_accept_via_native_selectors(page: Page): Promise<string | null> {
    for (const selector of COOKIE_ACCEPT_BUTTON_SELECTORS) {
        const clicked = await click_selector_in_frames(page, selector);
        if (clicked) return selector;
    }
    return null;
}

async function try_dismiss_once(page: Page): Promise<{ clicked: boolean; matched_selector: string | null }> {
    const native_selector = await click_accept_via_native_selectors(page);
    if (native_selector) {
        return { clicked: true, matched_selector: native_selector };
    }

    const config = build_cookie_banner_dismiss_config();
    for (const frame of get_search_frames(page)) {
        try {
            const did_click = await frame.evaluate(
                browser_dismiss_cookie_banners as (
                    dismiss_config: ReturnType<typeof build_cookie_banner_dismiss_config>
                ) => boolean,
                config
            );
            if (did_click === true) {
                return { clicked: true, matched_selector: 'evaluate:text-match' };
            }
        } catch {
            // Cross-origin frame — hoppa över.
        }
    }
    return { clicked: false, matched_selector: null };
}

/**
 * Klickar på vanliga «acceptera»-knappar om en cookie-banner syns.
 */
export async function dismiss_cookie_banners_before_screenshot(
    page: Page,
    options: { wait_for_banner?: boolean } = {}
): Promise<DismissCookieBannerResult> {
    const wait_for_banner = options.wait_for_banner !== false;
    if (wait_for_banner) {
        await wait_for_cookie_banner(page, BANNER_WAIT_TIMEOUT_MS);
    } else if (!(await is_cookie_banner_visible(page))) {
        return { clicked: false, banner_gone: true, matched_selector: null };
    }

    let clicked = false;
    let matched_selector: string | null = null;

    for (let attempt = 0; attempt < MAX_DISMISS_ATTEMPTS; attempt++) {
        if (!(await is_cookie_banner_visible(page))) {
            break;
        }

        const attempt_result = await try_dismiss_once(page);
        if (attempt_result.clicked) {
            clicked = true;
            matched_selector = attempt_result.matched_selector;
            await delay(POST_DISMISS_SETTLE_MS);
        } else {
            await delay(BANNER_POLL_MS);
        }
    }

    const banner_gone = await wait_until_cookie_banner_gone(page, BANNER_GONE_TIMEOUT_MS);
    return { clicked, banner_gone, matched_selector };
}

export async function settle_after_consent_apply(page: Page): Promise<void> {
    await delay(CONSENT_SETTLE_MS);
}

/**
 * Döljer cookie-banner visuellt i alla frames — garanterar ren skärmdump utan manuell seed.
 */
export async function hide_cookie_banners_visually_for_screenshot(page: Page): Promise<number> {
    const config = build_cookie_banner_hide_config();
    let hidden_total = 0;

    for (const frame of get_search_frames(page)) {
        try {
            const hidden_in_frame = await frame.evaluate(
                browser_hide_cookie_banners_for_screenshot as (
                    hide_config: ReturnType<typeof build_cookie_banner_hide_config>
                ) => number,
                config
            );
            if (typeof hidden_in_frame === 'number' && hidden_in_frame > 0) {
                hidden_total += hidden_in_frame;
            }
        } catch {
            // Cross-origin frame — hoppa över.
        }
    }

    return hidden_total;
}
/**
 * @fileoverview Försöker stänga störande overlays via Puppeteer före skärmdump.
 */

import type { Frame, Page } from 'puppeteer';
import { ensure_intrusive_overlay_scripts_on_page } from './page_screenshot_browser_scripts_loader.js';
import {
    build_intrusive_overlay_dismiss_config,
    build_intrusive_overlay_hide_config,
} from './page_screenshot_intrusive_overlay_logic.js';

const POST_DISMISS_SETTLE_MS = 700;
const MAX_DISMISS_ATTEMPTS = 4;
const OVERLAY_WAIT_TIMEOUT_MS = 3500;
const OVERLAY_GONE_TIMEOUT_MS = 5000;
const OVERLAY_POLL_MS = 250;

export type DismissIntrusiveOverlayResult = {
    clicked: boolean;
    overlay_gone: boolean;
    matched_selector: string | null;
};

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function get_overlay_visibility_config() {
    return build_intrusive_overlay_dismiss_config();
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

export async function is_intrusive_overlay_visible(page: Page): Promise<boolean> {
    await ensure_intrusive_overlay_scripts_on_page(page);
    const config = get_overlay_visibility_config();
    for (const frame of get_search_frames(page)) {
        try {
            const visible = await frame.evaluate((visibility_config) => {
                const api = globalThis.__gv_intrusive_overlay;
                if (!api) return false;
                return api.visible(visibility_config) === true;
            }, config);
            if (visible === true) return true;
        } catch {
            // Cross-origin frame — hoppa över.
        }
    }
    return false;
}

async function wait_for_intrusive_overlay(page: Page, timeout_ms: number): Promise<boolean> {
    const deadline = Date.now() + timeout_ms;
    while (Date.now() < deadline) {
        if (await is_intrusive_overlay_visible(page)) {
            return true;
        }
        await delay(OVERLAY_POLL_MS);
    }
    return false;
}

export async function wait_until_intrusive_overlay_gone(page: Page, timeout_ms: number): Promise<boolean> {
    const deadline = Date.now() + timeout_ms;
    while (Date.now() < deadline) {
        if (!(await is_intrusive_overlay_visible(page))) {
            return true;
        }
        await delay(OVERLAY_POLL_MS);
    }
    return !(await is_intrusive_overlay_visible(page));
}

async function try_dismiss_once(page: Page): Promise<{ clicked: boolean; matched_selector: string | null }> {
    await ensure_intrusive_overlay_scripts_on_page(page);
    const config = build_intrusive_overlay_dismiss_config();
    for (const frame of get_search_frames(page)) {
        try {
            const did_click = await frame.evaluate((dismiss_config) => {
                const api = globalThis.__gv_intrusive_overlay;
                if (!api) return false;
                return api.dismiss(dismiss_config) === true;
            }, config);
            if (did_click === true) {
                return { clicked: true, matched_selector: 'evaluate:intrusive-dismiss' };
            }
        } catch {
            // Cross-origin frame — hoppa över.
        }
    }
    return { clicked: false, matched_selector: null };
}

/**
 * Klickar på stäng-knappar för störande overlays om de syns.
 */
export async function dismiss_intrusive_overlays_before_screenshot(
    page: Page,
    options: { wait_for_overlay?: boolean } = {}
): Promise<DismissIntrusiveOverlayResult> {
    const wait_for_overlay = options.wait_for_overlay !== false;
    if (wait_for_overlay) {
        await wait_for_intrusive_overlay(page, OVERLAY_WAIT_TIMEOUT_MS);
    } else if (!(await is_intrusive_overlay_visible(page))) {
        return { clicked: false, overlay_gone: true, matched_selector: null };
    }

    let clicked = false;
    let matched_selector: string | null = null;

    for (let attempt = 0; attempt < MAX_DISMISS_ATTEMPTS; attempt++) {
        if (!(await is_intrusive_overlay_visible(page))) {
            break;
        }

        const attempt_result = await try_dismiss_once(page);
        if (attempt_result.clicked) {
            clicked = true;
            matched_selector = attempt_result.matched_selector;
            await delay(POST_DISMISS_SETTLE_MS);
        } else {
            await delay(OVERLAY_POLL_MS);
        }
    }

    const overlay_gone = await wait_until_intrusive_overlay_gone(page, OVERLAY_GONE_TIMEOUT_MS);
    return { clicked, overlay_gone, matched_selector };
}

/**
 * Döljer störande overlays visuellt i alla frames — sista steg före skärmdump.
 */
export async function hide_intrusive_overlays_visually_for_screenshot(page: Page): Promise<number> {
    await ensure_intrusive_overlay_scripts_on_page(page);
    const config = build_intrusive_overlay_hide_config();
    let hidden_total = 0;

    for (const frame of get_search_frames(page)) {
        try {
            const hidden_in_frame = await frame.evaluate((hide_config) => {
                const api = globalThis.__gv_intrusive_overlay;
                if (!api) return 0;
                const hidden = api.hide(hide_config);
                return typeof hidden === 'number' ? hidden : 0;
            }, config);
            if (typeof hidden_in_frame === 'number' && hidden_in_frame > 0) {
                hidden_total += hidden_in_frame;
            }
        } catch {
            // Cross-origin frame — hoppa över.
        }
    }

    return hidden_total;
}

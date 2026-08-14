/**
 * @fileoverview Försöker stänga störande overlays via Puppeteer före skärmdump.
 */

import type { Frame, Page } from 'puppeteer';
import { ensure_intrusive_overlay_scripts_on_page } from './page_screenshot_browser_scripts_loader.js';
import {
    build_intrusive_overlay_dismiss_config,
    build_intrusive_overlay_hide_config,
} from './page_screenshot_intrusive_overlay_logic.js';
import {
    learn_overlay_hints_from_dismiss,
    load_overlay_hints_for_domain,
} from './page_screenshot_intrusive_overlay_cache.js';
import type { OverlayDismissLearnedHint } from './page_screenshot_intrusive_overlay_cache_logic.js';

const POST_DISMISS_SETTLE_MS = 700;
const MAX_DISMISS_ATTEMPTS = 4;
const OVERLAY_WAIT_TIMEOUT_MS = 3500;
const OVERLAY_GONE_TIMEOUT_MS = 5000;
const OVERLAY_POLL_MS = 250;

export type DismissIntrusiveOverlayResult = {
    clicked: boolean;
    overlay_gone: boolean;
    matched_selector: string | null;
    dismiss_hint: OverlayDismissLearnedHint | null;
};

type DismissEvaluateResult = {
    clicked?: boolean;
    hint?: OverlayDismissLearnedHint | null;
};

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
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

async function build_dismiss_config_for_url(url?: string | null) {
    const domain_hints = url ? await load_overlay_hints_for_domain(url) : null;
    return build_intrusive_overlay_dismiss_config(domain_hints);
}

async function build_hide_config_for_url(url?: string | null) {
    const domain_hints = url ? await load_overlay_hints_for_domain(url) : null;
    return build_intrusive_overlay_hide_config(domain_hints);
}

export async function is_intrusive_overlay_visible(
    page: Page,
    options: { url?: string } = {}
): Promise<boolean> {
    await ensure_intrusive_overlay_scripts_on_page(page);
    const config = await build_dismiss_config_for_url(options.url);
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

async function wait_for_intrusive_overlay(
    page: Page,
    timeout_ms: number,
    url?: string
): Promise<boolean> {
    const deadline = Date.now() + timeout_ms;
    while (Date.now() < deadline) {
        if (await is_intrusive_overlay_visible(page, { url })) {
            return true;
        }
        await delay(OVERLAY_POLL_MS);
    }
    return false;
}

async function wait_until_intrusive_overlay_gone(
    page: Page,
    timeout_ms: number,
    url?: string
): Promise<boolean> {
    const deadline = Date.now() + timeout_ms;
    while (Date.now() < deadline) {
        if (!(await is_intrusive_overlay_visible(page, { url }))) {
            return true;
        }
        await delay(OVERLAY_POLL_MS);
    }
    return !(await is_intrusive_overlay_visible(page, { url }));
}

async function try_esc_dismiss(page: Page): Promise<void> {
    try {
        await page.keyboard.press('Escape');
    } catch {
        // Ignorera om sidan saknar fokus.
    }
}

async function try_dismiss_once(
    page: Page,
    config: ReturnType<typeof build_intrusive_overlay_dismiss_config>
): Promise<{ clicked: boolean; hint: OverlayDismissLearnedHint | null }> {
    await ensure_intrusive_overlay_scripts_on_page(page);
    for (const frame of get_search_frames(page)) {
        try {
            const result = await frame.evaluate((dismiss_config) => {
                const api = globalThis.__gv_intrusive_overlay;
                if (!api) return { clicked: false, hint: null };
                const dismiss_result = api.dismiss(dismiss_config);
                if (dismiss_result && typeof dismiss_result === 'object') {
                    return dismiss_result;
                }
                if (dismiss_result === true) {
                    return { clicked: true, hint: null };
                }
                return { clicked: false, hint: null };
            }, config);
            const parsed = result as DismissEvaluateResult;
            if (parsed?.clicked === true) {
                return {
                    clicked: true,
                    hint: parsed.hint ?? null,
                };
            }
        } catch {
            // Cross-origin frame — hoppa över.
        }
    }
    return { clicked: false, hint: null };
}

/**
 * Klickar på stäng-knappar för störande overlays om de syns.
 */
export async function dismiss_intrusive_overlays_before_screenshot(
    page: Page,
    options: { wait_for_overlay?: boolean; url?: string } = {}
): Promise<DismissIntrusiveOverlayResult> {
    const url = options.url;
    const dismiss_config = await build_dismiss_config_for_url(url);
    const wait_for_overlay = options.wait_for_overlay !== false;
    if (wait_for_overlay) {
        await wait_for_intrusive_overlay(page, OVERLAY_WAIT_TIMEOUT_MS, url);
    } else if (!(await is_intrusive_overlay_visible(page, { url }))) {
        return { clicked: false, overlay_gone: true, matched_selector: null, dismiss_hint: null };
    }

    let clicked = false;
    let matched_selector: string | null = null;
    let dismiss_hint: OverlayDismissLearnedHint | null = null;

    for (let attempt = 0; attempt < MAX_DISMISS_ATTEMPTS; attempt++) {
        if (!(await is_intrusive_overlay_visible(page, { url }))) {
            break;
        }

        const attempt_result = await try_dismiss_once(page, dismiss_config);
        if (attempt_result.clicked) {
            clicked = true;
            matched_selector = attempt_result.hint?.value ?? 'evaluate:intrusive-dismiss';
            dismiss_hint = attempt_result.hint;
            await delay(POST_DISMISS_SETTLE_MS);
        } else {
            await delay(OVERLAY_POLL_MS);
        }
    }

    if (await is_intrusive_overlay_visible(page, { url })) {
        await try_esc_dismiss(page);
        await delay(POST_DISMISS_SETTLE_MS);
        clicked = true;
    }

    let overlay_gone = await wait_until_intrusive_overlay_gone(page, OVERLAY_GONE_TIMEOUT_MS, url);
    if (!overlay_gone) {
        await hide_intrusive_overlays_visually_for_screenshot(page, { url });
        overlay_gone = !(await is_intrusive_overlay_visible(page, { url }));
        return {
            clicked,
            overlay_gone,
            matched_selector,
            dismiss_hint,
        };
    }

    if (clicked && dismiss_hint && url && overlay_gone) {
        await learn_overlay_hints_from_dismiss(url, dismiss_hint);
    }

    return { clicked, overlay_gone, matched_selector, dismiss_hint };
}

/**
 * Döljer störande overlays visuellt i alla frames — sista steg före skärmdump.
 */
export async function hide_intrusive_overlays_visually_for_screenshot(
    page: Page,
    options: { url?: string } = {}
): Promise<number> {
    await ensure_intrusive_overlay_scripts_on_page(page);
    const config = await build_hide_config_for_url(options.url);
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

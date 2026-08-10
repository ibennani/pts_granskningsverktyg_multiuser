/**
 * @fileoverview Gemensam Chromium-session för skärmdump och snapshot-capture.
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
import {
    dismiss_cookie_banners_before_screenshot,
    hide_cookie_banners_visually_for_screenshot,
    is_cookie_banner_visible,
    settle_after_consent_apply,
} from './page_screenshot_cookie_consent.js';
import { compute_screenshot_clip_height_css } from './page_screenshot_capture_height.js';
import {
    enable_cmp_request_block_for_screenshot,
    read_cmp_blocked_count,
} from './page_screenshot_cmp_block.js';
import {
    apply_consent_cookies,
    apply_consent_local_storage,
    learn_consent_from_page,
    load_consent_for_domain,
} from './page_screenshot_consent_cache.js';

export const CAPTURE_VIEWPORT_WIDTH = 1280;
export const CAPTURE_VIEWPORT_HEIGHT = 800;
export const CAPTURE_DEVICE_SCALE_FACTOR = 2;
export const CAPTURE_NAVIGATION_TIMEOUT_MS = 30_000;

export type CapturePageScreenshotInput = {
    url: string;
    timeout_ms?: number;
};

export type CaptureAdjustments = {
    consentApplied: boolean;
    cookieBannerClicked: boolean;
    cookieBannerElementsHidden: number;
    cmpRequestsBlocked: number;
    lazyLoadScrollPerformed: boolean;
};

export async function launch_capture_browser(): Promise<Browser> {
    return puppeteer.launch({
        headless: true,
        args: PUPPETEER_LAUNCH_ARGS,
    });
}

export async function prepare_capture_page(page: Page): Promise<void> {
    await configure_stealth_page(page);
    await page.setViewport({
        width: CAPTURE_VIEWPORT_WIDTH,
        height: CAPTURE_VIEWPORT_HEIGHT,
        deviceScaleFactor: CAPTURE_DEVICE_SCALE_FACTOR,
    });
}

export async function read_capture_page_title(page: Page): Promise<string> {
    const title = await page.title();
    const trimmed = String(title || '').trim();
    return trimmed || 'sida';
}

export async function navigate_and_validate_capture_page(
    page: Page,
    url: string,
    timeout_ms: number
): Promise<void> {
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

export async function navigate_for_screenshot_capture(
    page: Page,
    url: string,
    timeout_ms: number
): Promise<void> {
    await enable_cmp_request_block_for_screenshot(page);
    const consent = await load_consent_for_domain(url);
    await apply_consent_cookies(page, consent);
    await navigate_and_validate_capture_page(page, url, timeout_ms);
    await apply_consent_local_storage(page, consent);
    await settle_after_consent_apply(page);
}

async function ensure_banner_dismissed(
    page: Page,
    options: { wait_for_banner?: boolean } = {}
): Promise<{ banner_gone: boolean; clicked: boolean }> {
    const result = await dismiss_cookie_banners_before_screenshot(page, options);
    return { banner_gone: result.banner_gone, clicked: result.clicked };
}

export async function capture_viewport_png_with_adjustments(
    page: Page,
    url: string
): Promise<{ png_buffer: Buffer; page_title: string; adjustments: CaptureAdjustments }> {
    let dismiss_state = await ensure_banner_dismissed(page, { wait_for_banner: true });

    await auto_scroll_lazy_content(page);
    await settle_after_lazy_load(page);
    await scroll_to_top(page);

    dismiss_state = await ensure_banner_dismissed(page, { wait_for_banner: false });

    const page_title = await read_capture_page_title(page);
    const scroll_height_css = await read_document_scroll_height(page);
    const capture_height_css = compute_screenshot_clip_height_css(
        scroll_height_css,
        CAPTURE_VIEWPORT_WIDTH
    );

    await page.setViewport({
        width: CAPTURE_VIEWPORT_WIDTH,
        height: capture_height_css,
        deviceScaleFactor: CAPTURE_DEVICE_SCALE_FACTOR,
    });
    await scroll_to_top(page);

    if (!dismiss_state.banner_gone || (await is_cookie_banner_visible(page))) {
        dismiss_state = await ensure_banner_dismissed(page, { wait_for_banner: false });
    }

    const hidden_count = await hide_cookie_banners_visually_for_screenshot(page);
    await settle_after_consent_apply(page);

    if (dismiss_state.clicked || dismiss_state.banner_gone) {
        await learn_consent_from_page(page, url);
    }

    const blocked_count = read_cmp_blocked_count(page);
    const png_buffer = Buffer.from(
        await page.screenshot({
            type: 'png',
            fullPage: false,
        })
    );

    return {
        png_buffer,
        page_title,
        adjustments: {
            consentApplied: true,
            cookieBannerClicked: dismiss_state.clicked,
            cookieBannerElementsHidden: hidden_count,
            cmpRequestsBlocked: blocked_count,
            lazyLoadScrollPerformed: true,
        },
    };
}

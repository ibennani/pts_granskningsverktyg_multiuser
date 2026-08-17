/**
 * @fileoverview Gemensam Chromium-session för skärmdump och snapshot-capture.
 */
import puppeteer, { type Browser, type Page } from 'puppeteer';
import {
    auto_scroll_lazy_content,
    read_document_scroll_height,
    scroll_to_top,
    settle_after_lazy_load,
    prepare_and_wait_for_visible_images,
    finalize_images_for_fullpage_screenshot,
} from './page_screenshot_lazy_load.js';
import { get_snapshot_post_navigation_settle_ms, get_snapshot_pre_screenshot_intrusive_wait_ms } from '../snapshots/audit_snapshot_config.js';
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
import {
    dismiss_intrusive_overlays_before_screenshot,
    hide_intrusive_overlays_visually_for_screenshot,
    is_intrusive_overlay_visible,
} from './page_screenshot_intrusive_overlay.js';
import {
    compute_screenshot_clip_height_css,
    compute_full_document_screenshot_height_css,
    crop_png_to_max_css_height,
} from './page_screenshot_capture_height.js';
import { wait_for_screenshot_content_ready } from './page_screenshot_readiness.js';
import { get_snapshot_full_page_max_height_css } from '../snapshots/audit_snapshot_config.js';
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
export const CAPTURE_NAVIGATION_TIMEOUT_MS = 90_000;
export const CAPTURE_PAGE_DEFAULT_TIMEOUT_MS = 120_000;
export const CAPTURE_BROWSER_PROTOCOL_TIMEOUT_MS = 900_000;
export const FULLPAGE_SCREENSHOT_FALLBACK_SCROLL_HEIGHT_CSS = 8_000;

export type CapturePageScreenshotInput = {
    url: string;
    timeout_ms?: number;
};

export type CaptureAdjustments = {
    consentApplied: boolean;
    cookieBannerClicked: boolean;
    cookieBannerElementsHidden: number;
    cookieBannerVisibleAfterCapture: boolean;
    intrusiveOverlayClicked: boolean;
    intrusiveOverlayElementsHidden: number;
    intrusiveOverlayVisibleAfterCapture: boolean;
    cmpRequestsBlocked: number;
    lazyLoadScrollPerformed: boolean;
};

export async function launch_capture_browser(): Promise<Browser> {
    return puppeteer.launch({
        headless: true,
        args: [...PUPPETEER_LAUNCH_ARGS, '--window-size=1280,800'],
        protocolTimeout: CAPTURE_BROWSER_PROTOCOL_TIMEOUT_MS,
    });
}

export async function prepare_capture_page(page: Page): Promise<void> {
    await configure_stealth_page(page);
    if (typeof page.setDefaultNavigationTimeout === 'function') {
        page.setDefaultNavigationTimeout(CAPTURE_NAVIGATION_TIMEOUT_MS);
    }
    if (typeof page.setDefaultTimeout === 'function') {
        page.setDefaultTimeout(CAPTURE_PAGE_DEFAULT_TIMEOUT_MS);
    }
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
        waitUntil: 'domcontentloaded',
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
    await apply_cached_consent_and_settle(page, consent);
}

/** Ren navigation för initial cookieobservation (ingen CMP-blockering, cookies eller localStorage). */
export async function navigate_for_clean_consent_observation(
    page: Page,
    url: string,
    timeout_ms: number
): Promise<void> {
    await navigate_and_validate_capture_page(page, url, timeout_ms);
    try {
        await page.waitForNetworkIdle({ idleTime: 300, timeout: 5000 });
    } catch {
        // fortsätt
    }
}

/** @deprecated Använd navigate_for_clean_consent_observation på separat observationspage. */
export async function navigate_for_initial_consent_observation(
    page: Page,
    url: string,
    timeout_ms: number
): Promise<void> {
    await navigate_for_clean_consent_observation(page, url, timeout_ms);
}

/** Applicerar cached consent efter initial observation, utan reload. */
export async function apply_cached_consent_and_settle(
    page: Page,
    consent: Awaited<ReturnType<typeof load_consent_for_domain>>
): Promise<void> {
    await apply_consent_local_storage(page, consent);
    await settle_after_consent_apply(page);
    await settle_after_initial_navigation(page);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/** Kort väntan efter första laddning så nätverkskroppar kan hämtas före scroll. */
export async function settle_after_initial_navigation(page: Page): Promise<void> {
    try {
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 10_000 });
    } catch {
        // Sidor med websocket eller polling — fortsätt ändå
    }
    await delay(get_snapshot_post_navigation_settle_ms());
}

async function ensure_banner_dismissed(
    page: Page,
    options: { wait_for_banner?: boolean } = {}
): Promise<{ banner_gone: boolean; clicked: boolean }> {
    const result = await dismiss_cookie_banners_before_screenshot(page, options);
    return { banner_gone: result.banner_gone, clicked: result.clicked };
}

async function ensure_intrusive_overlays_dismissed(
    page: Page,
    url: string,
    options: { wait_for_overlay?: boolean } = {}
): Promise<{ overlay_gone: boolean; clicked: boolean }> {
    const result = await dismiss_intrusive_overlays_before_screenshot(page, { ...options, url });
    return { overlay_gone: result.overlay_gone, clicked: result.clicked };
}

export type CaptureScreenshotHeightMode = 'viewport_capped' | 'full_document';

export async function capture_viewport_png_with_adjustments(
    page: Page,
    url: string,
    options: { height_mode?: CaptureScreenshotHeightMode } = {}
): Promise<{ png_buffer: Buffer; page_title: string; adjustments: CaptureAdjustments }> {
    let dismiss_state = await ensure_banner_dismissed(page, { wait_for_banner: true });
    let overlay_state = await ensure_intrusive_overlays_dismissed(page, url, { wait_for_overlay: true });

    await auto_scroll_lazy_content(page);
    await settle_after_lazy_load(page);
    await scroll_to_top(page);

    dismiss_state = await ensure_banner_dismissed(page, { wait_for_banner: false });
    overlay_state = await ensure_intrusive_overlays_dismissed(page, url, { wait_for_overlay: false });

    const page_title = await read_capture_page_title(page);
    const scroll_height_css = await read_document_scroll_height(page);
    const height_mode = options.height_mode ?? 'viewport_capped';
    const max_capture_height_css =
        height_mode === 'full_document'
            ? compute_full_document_screenshot_height_css(
                  scroll_height_css,
                  get_snapshot_full_page_max_height_css()
              )
            : compute_screenshot_clip_height_css(scroll_height_css, CAPTURE_VIEWPORT_WIDTH);
    const use_clip_instead_of_fullpage =
        height_mode === 'viewport_capped' && scroll_height_css > FULLPAGE_SCREENSHOT_FALLBACK_SCROLL_HEIGHT_CSS;

    if (!dismiss_state.banner_gone || (await is_cookie_banner_visible(page))) {
        dismiss_state = await ensure_banner_dismissed(page, { wait_for_banner: false });
    }

    await delay(get_snapshot_pre_screenshot_intrusive_wait_ms());

    if (!overlay_state.overlay_gone || (await is_intrusive_overlay_visible(page, { url }))) {
        overlay_state = await ensure_intrusive_overlays_dismissed(page, url, { wait_for_overlay: false });
    }

    const hidden_count = await hide_cookie_banners_visually_for_screenshot(page);
    let intrusive_hidden_count = await hide_intrusive_overlays_visually_for_screenshot(page, { url });
    if (await is_intrusive_overlay_visible(page, { url })) {
        intrusive_hidden_count += await hide_intrusive_overlays_visually_for_screenshot(page, { url });
    }
    await settle_after_consent_apply(page);

    if (dismiss_state.clicked || dismiss_state.banner_gone) {
        await learn_consent_from_page(page, url);
    }

    const blocked_count = read_cmp_blocked_count(page);
    await hide_intrusive_overlays_visually_for_screenshot(page, { url });

    const banner_still_visible = await is_cookie_banner_visible(page);
    const overlay_still_visible = await is_intrusive_overlay_visible(page, { url });

    await page.setViewport({
        width: CAPTURE_VIEWPORT_WIDTH,
        height: CAPTURE_VIEWPORT_HEIGHT,
        deviceScaleFactor: CAPTURE_DEVICE_SCALE_FACTOR,
    });
    await scroll_to_top(page);
    await wait_for_screenshot_content_ready(page);
    await prepare_and_wait_for_visible_images(page);
    await scroll_to_top(page);
    if (!use_clip_instead_of_fullpage) {
        await finalize_images_for_fullpage_screenshot(page);
        await scroll_to_top(page);
    }

    let capture_title = page_title;
    if (/application error|access denied/i.test(capture_title)) {
        try {
            await page.reload({ waitUntil: 'domcontentloaded', timeout: CAPTURE_NAVIGATION_TIMEOUT_MS });
            await settle_after_initial_navigation(page);
            await hide_cookie_banners_visually_for_screenshot(page);
            await hide_intrusive_overlays_visually_for_screenshot(page, { url });
            await scroll_to_top(page);
            await wait_for_screenshot_content_ready(page);
            capture_title = await read_capture_page_title(page);
        } catch {
            // Behåll ursprunglig titel om reload misslyckas.
        }
    }

    let screenshot_height_css = Math.min(
        Math.max(scroll_height_css, CAPTURE_VIEWPORT_HEIGHT),
        max_capture_height_css
    );
    if (screenshot_height_css < 100) {
        screenshot_height_css = max_capture_height_css;
    }
    const raw_png_buffer = Buffer.from(
        await page.screenshot(
            use_clip_instead_of_fullpage
                ? {
                      type: 'png',
                      clip: {
                          x: 0,
                          y: 0,
                          width: CAPTURE_VIEWPORT_WIDTH,
                          height: screenshot_height_css,
                      },
                  }
                : {
                      type: 'png',
                      fullPage: true,
                  }
        )
    );
    const png_buffer = use_clip_instead_of_fullpage
        ? raw_png_buffer
        : await crop_png_to_max_css_height(
              raw_png_buffer,
              max_capture_height_css,
              CAPTURE_DEVICE_SCALE_FACTOR
          );

    return {
        png_buffer,
        page_title: capture_title,
        adjustments: {
            consentApplied: true,
            cookieBannerClicked: dismiss_state.clicked,
            cookieBannerElementsHidden: hidden_count,
            cookieBannerVisibleAfterCapture: banner_still_visible,
            intrusiveOverlayClicked: overlay_state.clicked,
            intrusiveOverlayElementsHidden: intrusive_hidden_count,
            intrusiveOverlayVisibleAfterCapture: overlay_still_visible,
            cmpRequestsBlocked: blocked_count,
            lazyLoadScrollPerformed: true,
        },
    };
}

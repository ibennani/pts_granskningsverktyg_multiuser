/**
 * @fileoverview Dold aria-live-status för automatisk URL-skärmdump (endast skärmläsare).
 */

export type UrlScreenshotLiveStatus = 'idle' | 'capturing' | 'success' | 'failed';

export const URL_SCREENSHOT_LIVE_REGION_SELECTOR = '[data-url-screenshot-live-status]';

const LIVE_STATUS_I18N_KEY: Record<Exclude<UrlScreenshotLiveStatus, 'idle'>, string> = {
    capturing: 'sample_screenshot_live_capturing',
    success: 'sample_screenshot_live_success',
    failed: 'sample_screenshot_live_failed',
};

export function find_url_screenshot_live_region(btn: HTMLButtonElement): HTMLElement | null {
    const region = btn.querySelector(URL_SCREENSHOT_LIVE_REGION_SELECTOR);
    return region instanceof HTMLElement ? region : null;
}

/**
 * Uppdaterar dold live-region i bifoga-media-knappen.
 * Capturing annonseras via synlig knapptext; här används success/failed/idle.
 */
export function set_sample_url_screenshot_live_status(
    btn: HTMLButtonElement | null,
    status: UrlScreenshotLiveStatus,
    t: (key: string, params?: Record<string, unknown>) => string
): void {
    if (!btn) return;
    if (status === 'capturing') {
        return;
    }
    const region = find_url_screenshot_live_region(btn);
    if (!region) return;
    region.textContent = status === 'idle' ? '' : t(LIVE_STATUS_I18N_KEY[status]);
}

export function create_url_screenshot_live_region(Helpers: {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
}): HTMLElement {
    return Helpers.create_element('span', {
        class_name: 'visually-hidden',
        attributes: {
            'aria-live': 'polite',
            'aria-atomic': 'true',
            'data-url-screenshot-live-status': 'true',
        },
    });
}

/**
 * @fileoverview Viewport-baseline för snapshot-analys (1280×800, DPR 2).
 */
import type { Page } from 'puppeteer';
import {
    CAPTURE_DEVICE_SCALE_FACTOR,
    CAPTURE_VIEWPORT_HEIGHT,
    CAPTURE_VIEWPORT_WIDTH,
} from '../../services/page_capture_session.js';

export type ViewportState = {
    width: number;
    height: number;
    deviceScaleFactor: number;
};

export function get_baseline_viewport(): ViewportState {
    return {
        width: CAPTURE_VIEWPORT_WIDTH,
        height: CAPTURE_VIEWPORT_HEIGHT,
        deviceScaleFactor: CAPTURE_DEVICE_SCALE_FACTOR,
    };
}

export async function read_current_viewport(page: Page): Promise<ViewportState> {
    const vp = page.viewport();
    if (vp) {
        return {
            width: vp.width,
            height: vp.height,
            deviceScaleFactor: vp.deviceScaleFactor ?? CAPTURE_DEVICE_SCALE_FACTOR,
        };
    }
    return get_baseline_viewport();
}

export async function restore_baseline_viewport(page: Page): Promise<void> {
    const baseline = get_baseline_viewport();
    await page.setViewport(baseline);
}

export async function with_baseline_viewport<T>(
    page: Page,
    fn: () => Promise<T>
): Promise<T> {
    const before = await read_current_viewport(page);
    try {
        await restore_baseline_viewport(page);
        return await fn();
    } finally {
        await page.setViewport(before);
    }
}

/**
 * @fileoverview Scroll och väntelogik för att ladda lazy content före fullPage-skärmdump.
 */

import type { Page } from 'puppeteer';

export const LAZY_SCROLL_STEP_PX = 400;
export const LAZY_SCROLL_PAUSE_MS = 150;
export const LAZY_SCROLL_MAX_PASSES = 6;
export const LAZY_SCROLL_STABLE_PASSES = 2;
export const POST_LAZY_LOAD_SETTLE_MS = 1200;
export const LAZY_IMAGE_WAIT_MS = 3000;

export type LazyLoadScrollPassResult = {
    pass_index: number;
    height_before: number;
    height_after: number;
    stable_passes: number;
};

/**
 * Avgör om fler scroll-pass behövs när sidhöjden slutat växa.
 */
export function should_continue_lazy_load_passes(
    stable_passes: number,
    pass_index: number,
    max_passes: number,
    stable_passes_needed: number
): boolean {
    if (pass_index >= max_passes) return false;
    return stable_passes < stable_passes_needed;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Scrollar stegvis genom sidan och kör flera pass tills höjden stabiliserats.
 */
export async function auto_scroll_lazy_content(page: Page): Promise<void> {
    await page.evaluate(
        async (config: {
            step_px: number;
            pause_ms: number;
            max_passes: number;
            stable_passes_needed: number;
        }) => {
            const sleep = (ms: number) =>
                new Promise<void>((resolve) => {
                    window.setTimeout(resolve, ms);
                });

            const read_scroll_height = (): number =>
                Math.max(
                    document.body?.scrollHeight ?? 0,
                    document.documentElement?.scrollHeight ?? 0
                );

            const scroll_window_to = async (y: number, pause_ms: number): Promise<void> => {
                window.scrollTo(0, y);
                window.dispatchEvent(new Event('scroll'));
                await sleep(pause_ms);
            };

            const scroll_nested_containers = async (pause_ms: number): Promise<void> => {
                const selectors = ['main', '[role="main"]', '#main', '#content', '.main-content'];
                for (const selector of selectors) {
                    document.querySelectorAll(selector).forEach((node) => {
                        if (!(node instanceof HTMLElement)) return;
                        if (node.scrollHeight > node.clientHeight + 4) {
                            node.scrollTop = node.scrollHeight;
                        }
                    });
                }
                await sleep(pause_ms);
            };

            let stable_passes = 0;
            let last_height = read_scroll_height();

            for (let pass = 0; pass < config.max_passes && stable_passes < config.stable_passes_needed; pass++) {
                let y = 0;
                let height = read_scroll_height();

                while (y < height) {
                    await scroll_window_to(y, config.pause_ms);
                    y += config.step_px;
                    const expanded = read_scroll_height();
                    if (expanded > height) {
                        height = expanded;
                        stable_passes = 0;
                    }
                }

                await scroll_window_to(height, config.pause_ms);
                await scroll_nested_containers(config.pause_ms);

                const height_after = read_scroll_height();
                if (height_after <= last_height) {
                    stable_passes += 1;
                } else {
                    stable_passes = 0;
                    last_height = height_after;
                }
            }
        },
        {
            step_px: LAZY_SCROLL_STEP_PX,
            pause_ms: LAZY_SCROLL_PAUSE_MS,
            max_passes: LAZY_SCROLL_MAX_PASSES,
            stable_passes_needed: LAZY_SCROLL_STABLE_PASSES,
        }
    );
}

/**
 * Väntar kort på att synliga bilder ska laddas efter scroll.
 */
export async function wait_for_lazy_images(page: Page, timeout_ms: number): Promise<void> {
    await page.evaluate(async (max_wait_ms: number) => {
        const pending = Array.from(document.images).filter((img) => !img.complete);
        if (pending.length === 0) return;

        await Promise.race([
            Promise.all(
                pending.map(
                    (img) =>
                        new Promise<void>((resolve) => {
                            img.addEventListener('load', () => resolve(), { once: true });
                            img.addEventListener('error', () => resolve(), { once: true });
                        })
                )
            ),
            new Promise<void>((resolve) => {
                window.setTimeout(resolve, max_wait_ms);
            }),
        ]);
    }, timeout_ms);
}

export async function settle_after_lazy_load(page: Page): Promise<void> {
    await wait_for_lazy_images(page, LAZY_IMAGE_WAIT_MS);
    await delay(POST_LAZY_LOAD_SETTLE_MS);
    try {
        await page.waitForNetworkIdle({ idleTime: 400, timeout: 5000 });
    } catch {
        // Sidor med websocket/polling — fortsätt ändå
    }
}

export async function scroll_to_top(page: Page): Promise<void> {
    await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelectorAll('main, [role="main"], #main, #content, .main-content').forEach((node) => {
            if (node instanceof HTMLElement) {
                node.scrollTop = 0;
            }
        });
    });
}

/**
 * @fileoverview Blockerar CMP-nätverksanrop via Puppeteer — endast skärmdump.
 */

import type { Page } from 'puppeteer';
import { should_block_cmp_request } from './page_screenshot_cmp_block_logic.js';

const blocked_counts = new WeakMap<Page, number>();

/**
 * Aktiverar request interception och blockerar kända CMP-domäner/script.
 */
export async function enable_cmp_request_block_for_screenshot(page: Page): Promise<void> {
    blocked_counts.set(page, 0);

    await page.setRequestInterception(true);
    page.on('request', (request) => {
        const resource_type = request.resourceType();
        const url = request.url();

        if (should_block_cmp_request(url, resource_type)) {
            const current = blocked_counts.get(page) ?? 0;
            blocked_counts.set(page, current + 1);
            void request.abort('blockedbyclient');
            return;
        }

        void request.continue();
    });
}

export function read_cmp_blocked_count(page: Page): number {
    return blocked_counts.get(page) ?? 0;
}

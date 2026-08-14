#!/usr/bin/env node
/**
 * Verifierar apohem.se-skärmdump efter overlay-fix.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { capture_page_screenshot } from '../server/services/page_screenshot_service.ts';
import {
    launch_capture_browser,
    prepare_capture_page,
    navigate_for_screenshot_capture,
    capture_viewport_png_with_adjustments,
} from '../server/services/page_capture_session.ts';
import { read_document_scroll_height } from '../server/services/page_screenshot_lazy_load.ts';
import { build_intrusive_overlay_hide_config } from '../server/services/page_screenshot_intrusive_overlay_logic.ts';
import { ensure_intrusive_overlay_scripts_on_page } from '../server/services/page_screenshot_browser_scripts_loader.ts';

const url = 'https://www.apohem.se/';
const out_dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cursor');

const browser = await launch_capture_browser();
const page = await browser.newPage();
await prepare_capture_page(page);
await navigate_for_screenshot_capture(page, url, 60000);

const scroll_before = await read_document_scroll_height(page);
const main_before = await page.$eval('main', (el) => ({
    visibility: window.getComputedStyle(el).visibility,
    height: el.getBoundingClientRect().height,
    text_len: (el.innerText || '').replace(/\s+/g, ' ').trim().length,
}));

const capture = await capture_viewport_png_with_adjustments(page, url);
const scroll_after = await read_document_scroll_height(page);
const main_after = await page.$eval('main', (el) => ({
    visibility: window.getComputedStyle(el).visibility,
    height: el.getBoundingClientRect().height,
    text_len: (el.innerText || '').replace(/\s+/g, ' ').trim().length,
}));

await ensure_intrusive_overlay_scripts_on_page(page);
const roots_after = await page.evaluate((cfg) => {
    const api = globalThis.__gv_intrusive_overlay;
    return (api?.find?.(cfg) || []).length;
}, build_intrusive_overlay_hide_config());

const out_path = path.join(out_dir, 'apohem_fixed_capture.png');
fs.writeFileSync(out_path, capture.png_buffer);

const report = {
    ok:
        scroll_after > 2000 &&
        main_after.visibility !== 'hidden' &&
        main_after.height > 500 &&
        capture.adjustments.intrusiveOverlayElementsHidden < 10,
    scroll_before,
    scroll_after,
    main_before,
    main_after,
    adjustments: capture.adjustments,
    png_bytes: capture.png_buffer.length,
    overlay_roots_after_capture: roots_after,
    out_path,
};

console.log(JSON.stringify(report, null, 2));
await browser.close();
if (!report.ok) process.exit(1);

/**
 * @fileoverview Laddar Puppeteer browser_scripts från rå källfil utan tsx/esbuild __name-transform.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'page_screenshot_browser_scripts.js'
);

const BROWSER_SCRIPT_EXPORT_NAMES = [
    'browser_read_document_scroll_height',
    'browser_auto_scroll_lazy_content',
    'browser_wait_for_lazy_images',
    'browser_scroll_to_top',
    'browser_page_has_renderable_content',
    'browser_hide_webdriver_flag',
    'browser_dismiss_cookie_banners',
    'browser_find_cookie_overlay_roots',
    'browser_is_cookie_banner_visible',
    'browser_hide_cookie_banners_for_screenshot',
] as const;

type BrowserScriptExportName = (typeof BROWSER_SCRIPT_EXPORT_NAMES)[number];

type BrowserScriptFn = (...args: any[]) => any;

type BrowserScriptsModule = {
    [K in BrowserScriptExportName]: BrowserScriptFn;
};

let cached_scripts: BrowserScriptsModule | null = null;

/**
 * Bygger modulobjekt via Function-konstruktor så funktionerna inte transformerats av tsx.
 */
function load_raw_browser_scripts(): BrowserScriptsModule {
    if (cached_scripts) {
        return cached_scripts;
    }

    const source = readFileSync(SCRIPTS_PATH, 'utf8');
    const without_exports = source.replace(/^export /gm, '');
    const return_object = BROWSER_SCRIPT_EXPORT_NAMES.join(', ');
    const factory = new Function(`${without_exports}\nreturn { ${return_object} };`);
    cached_scripts = factory() as BrowserScriptsModule;
    return cached_scripts;
}

const scripts = load_raw_browser_scripts();

export const browser_read_document_scroll_height = scripts.browser_read_document_scroll_height;
export const browser_auto_scroll_lazy_content = scripts.browser_auto_scroll_lazy_content;
export const browser_wait_for_lazy_images = scripts.browser_wait_for_lazy_images;
export const browser_scroll_to_top = scripts.browser_scroll_to_top;
export const browser_page_has_renderable_content = scripts.browser_page_has_renderable_content;
export const browser_hide_webdriver_flag = scripts.browser_hide_webdriver_flag;
export const browser_dismiss_cookie_banners = scripts.browser_dismiss_cookie_banners;
export const browser_find_cookie_overlay_roots = scripts.browser_find_cookie_overlay_roots;
export const browser_is_cookie_banner_visible = scripts.browser_is_cookie_banner_visible;
export const browser_hide_cookie_banners_for_screenshot = scripts.browser_hide_cookie_banners_for_screenshot;

/**
 * @fileoverview Laddar Puppeteer browser_scripts från rå källfil utan tsx/esbuild __name-transform.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'puppeteer';

const SCRIPTS_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'page_screenshot_browser_scripts.js'
);

const BROWSER_SCRIPT_EXPORT_NAMES = [
    'browser_read_document_scroll_height',
    'browser_auto_scroll_lazy_content',
    'browser_prepare_lazy_images_for_screenshot',
    'browser_wait_for_lazy_images',
    'browser_scroll_to_top',
    'browser_page_has_renderable_content',
    'browser_read_main_content_lengths',
    'browser_hide_webdriver_flag',
    'browser_dismiss_cookie_banners',
    'browser_find_cookie_overlay_roots',
    'browser_is_cookie_banner_visible',
    'browser_hide_cookie_banners_for_screenshot',
    'browser_find_intrusive_overlay_roots',
    'browser_dismiss_intrusive_overlays',
    'browser_is_intrusive_overlay_visible',
    'browser_hide_intrusive_overlays_for_screenshot',
] as const;

type BrowserScriptExportName = (typeof BROWSER_SCRIPT_EXPORT_NAMES)[number];

type BrowserScriptFn = (...args: any[]) => any;

type BrowserScriptsModule = {
    [K in BrowserScriptExportName]: BrowserScriptFn;
};

let cached_scripts: BrowserScriptsModule | null = null;
let cached_intrusive_overlay_bundle_source: string | null = null;

/**
 * Källkod för störande overlay-funktioner (utan export) för injektion i sidan.
 */
export function get_intrusive_overlay_bundle_source(): string {
    if (cached_intrusive_overlay_bundle_source) {
        return cached_intrusive_overlay_bundle_source;
    }

    const source = readFileSync(SCRIPTS_PATH, 'utf8');
    const marker = 'function is_icon_only_close_button';
    const start = source.indexOf(marker);
    if (start < 0) {
        throw new Error('Saknar is_icon_only_close_button i page_screenshot_browser_scripts.js');
    }
    cached_intrusive_overlay_bundle_source = source.slice(start).replace(/^export /gm, '');
    return cached_intrusive_overlay_bundle_source;
}

declare global {
    // eslint-disable-next-line no-var
    var __gv_intrusive_overlay: {
        find: BrowserScriptFn;
        dismiss: BrowserScriptFn;
        visible: BrowserScriptFn;
        hide: BrowserScriptFn;
    } | undefined;
}

/**
 * Gör overlay-hjälpfunktioner tillgängliga i sidans JS-kontext (krävs för page.evaluate).
 */
export async function ensure_intrusive_overlay_scripts_on_page(page: Page): Promise<void> {
    const bundle_source = get_intrusive_overlay_bundle_source();
    await page.evaluate((src) => {
        if (globalThis.__gv_intrusive_overlay) {
            return;
        }
        const factory = new Function(
            `${src}\nreturn {\n` +
                'find: browser_find_intrusive_overlay_roots,\n' +
                'dismiss: browser_dismiss_intrusive_overlays,\n' +
                'visible: browser_is_intrusive_overlay_visible,\n' +
                'hide: browser_hide_intrusive_overlays_for_screenshot,\n' +
                '};'
        );
        globalThis.__gv_intrusive_overlay = factory();
    }, bundle_source);
}

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
export const browser_prepare_lazy_images_for_screenshot =
    scripts.browser_prepare_lazy_images_for_screenshot;
export const browser_wait_for_lazy_images = scripts.browser_wait_for_lazy_images;
export const browser_scroll_to_top = scripts.browser_scroll_to_top;
export const browser_page_has_renderable_content = scripts.browser_page_has_renderable_content;
export const browser_read_main_content_lengths = scripts.browser_read_main_content_lengths;
export const browser_hide_webdriver_flag = scripts.browser_hide_webdriver_flag;
export const browser_dismiss_cookie_banners = scripts.browser_dismiss_cookie_banners;
export const browser_find_cookie_overlay_roots = scripts.browser_find_cookie_overlay_roots;
export const browser_is_cookie_banner_visible = scripts.browser_is_cookie_banner_visible;
export const browser_hide_cookie_banners_for_screenshot = scripts.browser_hide_cookie_banners_for_screenshot;
export const browser_find_intrusive_overlay_roots = scripts.browser_find_intrusive_overlay_roots;
export const browser_dismiss_intrusive_overlays = scripts.browser_dismiss_intrusive_overlays;
export const browser_is_intrusive_overlay_visible = scripts.browser_is_intrusive_overlay_visible;
export const browser_hide_intrusive_overlays_for_screenshot = scripts.browser_hide_intrusive_overlays_for_screenshot;

/**
 * @fileoverview Laddar Bilaga 1 TOC browser_scripts från rå källfil utan tsx __name-transform.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'appendix1_toc_browser_scripts.js'
);

const BROWSER_SCRIPT_EXPORT_NAMES = [
    'browser_wait_for_print_layout',
    'browser_inject_appendix1_toc_page_numbers',
] as const;

type BrowserScriptExportName = (typeof BROWSER_SCRIPT_EXPORT_NAMES)[number];

type BrowserScriptFn = (...args: unknown[]) => unknown;

type BrowserScriptsModule = {
    [K in BrowserScriptExportName]: BrowserScriptFn;
};

let cached_scripts: BrowserScriptsModule | null = null;

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

export const browser_wait_for_print_layout = scripts.browser_wait_for_print_layout;
export const browser_inject_appendix1_toc_page_numbers = scripts.browser_inject_appendix1_toc_page_numbers;

/**
 * @fileoverview Laddar snapshot-analys browser_scripts från rå källfil utan tsx __name-transform.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'snapshot_analysis_browser_scripts.js'
);

const BROWSER_SCRIPT_EXPORT_NAMES = [
    'browser_get_focused_element_info',
    'browser_get_computed_focus_styles',
    'browser_collect_reflow_candidates',
    'browser_apply_text_spacing_css',
    'browser_remove_text_spacing_css',
    'browser_collect_text_spacing_issues',
    'browser_collect_contrast_candidates',
    'browser_collect_target_sizes',
    'browser_collect_safe_interaction_candidates',
    'browser_detect_consent_banner',
    'browser_collect_page_block_candidates',
    'browser_find_menu_navigation_trigger',
    'browser_read_menu_trigger_state',
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

export const BROWSER_GET_FOCUSED_ELEMENT_INFO = scripts.browser_get_focused_element_info;
export const BROWSER_GET_COMPUTED_FOCUS_STYLES = scripts.browser_get_computed_focus_styles;
export const BROWSER_COLLECT_REFLOW_CANDIDATES = scripts.browser_collect_reflow_candidates;
export const BROWSER_APPLY_TEXT_SPACING_CSS = scripts.browser_apply_text_spacing_css;
export const BROWSER_REMOVE_TEXT_SPACING_CSS = scripts.browser_remove_text_spacing_css;
export const BROWSER_COLLECT_TEXT_SPACING_ISSUES = scripts.browser_collect_text_spacing_issues;
export const BROWSER_COLLECT_CONTRAST_CANDIDATES = scripts.browser_collect_contrast_candidates;
export const BROWSER_COLLECT_TARGET_SIZES = scripts.browser_collect_target_sizes;
export const BROWSER_COLLECT_SAFE_INTERACTION_CANDIDATES = scripts.browser_collect_safe_interaction_candidates;
export const BROWSER_DETECT_CONSENT_BANNER = scripts.browser_detect_consent_banner;
export const BROWSER_COLLECT_PAGE_BLOCK_CANDIDATES = scripts.browser_collect_page_block_candidates;
export const BROWSER_FIND_MENU_NAVIGATION_TRIGGER = scripts.browser_find_menu_navigation_trigger;
export const BROWSER_READ_MENU_TRIGGER_STATE = scripts.browser_read_menu_trigger_state;

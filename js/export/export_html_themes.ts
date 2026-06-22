/**
 * @fileoverview Temavarianter för fristående HTML-export (samma val som i Leffe).
 */

import { escape_html_internal } from './export_html_build_primitives.js';

/** Måste matcha SavedThemePreference i session_manager.ts. */
export type SavedThemePreference = 'light' | 'dark' | 'dark-experimental' | 'winter-white';

export type HtmlExportThemeId = SavedThemePreference | 'system';

export const HTML_EXPORT_DEFAULT_THEME: HtmlExportThemeId = 'light';

export const HTML_EXPORT_THEME_OPTIONS: Array<{ value: HtmlExportThemeId; label_key: string }> = [
    { value: 'light', label_key: 'light_mode' },
    { value: 'dark', label_key: 'dark_mode' },
    { value: 'dark-experimental', label_key: 'settings_theme_dark_experimental' },
    { value: 'winter-white', label_key: 'settings_theme_winter_white' },
    { value: 'system', label_key: 'settings_theme_system' }
];

/** CSS-variabler per tema – använder samma data-theme-värden som Leffe. */
export const HTML_EXPORT_THEME_CSS = `
            html[data-theme] {
                --html-export-code-bg: var(--html-export-sort-bg);
            }
            html[data-theme="light"],
            html:not([data-theme]) {
                --primary-color: #6E3282;
                --primary-color-dark: #4A2159;
                --link-color: #6E3282;
                --link-hover-color: #8A3F9E;
                --heading-color: #6E3282;
                --text-color: #1e2a2b;
                --text-color-muted: #4a5a5c;
                --background-color: #F0EAE3;
                --border-color: #B07CBF;
                --html-export-panel-bg: #ffffff;
                --html-export-sort-bg: rgba(110, 50, 130, 0.05);
                --html-export-sort-border: rgba(110, 50, 130, 0.15);
                --html-export-sort-active-bg: rgba(110, 50, 130, 0.12);
                --html-export-banner-bg: #6E3282;
                --html-export-banner-text: #ffffff;
            }
            html[data-theme="dark"] {
                --primary-color: #9650AA;
                --primary-color-dark: #6E3282;
                --link-color: #D5B9DD;
                --link-hover-color: #E8D4ED;
                --heading-color: #D5B9DD;
                --text-color: #F4F1EE;
                --text-color-muted: #D5B9DD;
                --background-color: #1A2330;
                --border-color: #D5B9DD;
                --html-export-panel-bg: #2E1F2E;
                --html-export-sort-bg: rgba(213, 185, 221, 0.08);
                --html-export-sort-border: rgba(213, 185, 221, 0.2);
                --html-export-sort-active-bg: rgba(213, 185, 221, 0.14);
                --html-export-banner-bg: #9650AA;
                --html-export-banner-text: #ffffff;
            }
            html[data-theme="dark-experimental"] {
                --primary-color: #fafafa;
                --primary-color-dark: #e4e4e7;
                --link-color: #b4b4bc;
                --link-hover-color: #a5b4fc;
                --heading-color: #E6D6BE;
                --text-color: #fafafa;
                --text-color-muted: #94949e;
                --background-color: #09090b;
                --border-color: #4a5078;
                --html-export-panel-bg: #111113;
                --html-export-sort-bg: rgba(165, 180, 252, 0.08);
                --html-export-sort-border: rgba(165, 180, 252, 0.2);
                --html-export-sort-active-bg: rgba(165, 180, 252, 0.14);
                --html-export-banner-bg: #111113;
                --html-export-banner-text: #E6D6BE;
            }
            html[data-theme="winter-white"] {
                --primary-color: #6E3282;
                --primary-color-dark: #4A2159;
                --link-color: #4b4b44;
                --link-hover-color: #4338ca;
                --heading-color: #6E3282;
                --text-color: #09090b;
                --text-color-muted: #6b6b61;
                --background-color: #fafafa;
                --border-color: #b5af87;
                --html-export-panel-bg: #ffffff;
                --html-export-sort-bg: rgba(110, 50, 130, 0.05);
                --html-export-sort-border: rgba(110, 50, 130, 0.15);
                --html-export-sort-active-bg: rgba(110, 50, 130, 0.12);
                --html-export-banner-bg: #09090b;
                --html-export-banner-text: #fafafa;
            }
            @media (prefers-reduced-motion: no-preference) {
                body,
                .html-export-banner,
                .html-export-sidebar,
                .html-export-content,
                .html-export-sidebar h2,
                .html-export-sidebar a,
                .html-export-theme-select,
                .sort-controls,
                .html-export-theme-controls,
                .sort-option,
                .sort-label,
                .content-section,
                .content-section h1,
                .content-section h2,
                .content-section h3,
                .content-section h4,
                .content-section p,
                .content-section a,
                .observation-content code,
                .comment-content code,
                .observation-content pre,
                .comment-content pre {
                    transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease;
                }
            }
            @media (prefers-reduced-motion: reduce) {
                body,
                .html-export-banner,
                .html-export-sidebar,
                .html-export-content,
                .html-export-sidebar h2,
                .html-export-sidebar a,
                .html-export-theme-select,
                .sort-controls,
                .html-export-theme-controls,
                .sort-option,
                .sort-label,
                .content-section,
                .content-section h1,
                .content-section h2,
                .content-section h3,
                .content-section h4,
                .content-section p,
                .content-section a,
                .observation-content code,
                .comment-content code,
                .observation-content pre,
                .comment-content pre {
                    transition: none;
                }
            }
`;

/**
 * Standardtema i exporterad HTML – alltid ljust, oberoende av användarens val i Leffe.
 */
export function resolve_html_export_initial_theme(): HtmlExportThemeId {
    return HTML_EXPORT_DEFAULT_THEME;
}

/** data-theme-värde som ska stå på html-elementet vid export. */
export function resolve_html_export_document_theme(
    initial_theme: HtmlExportThemeId
): SavedThemePreference {
    if (initial_theme === 'system') {
        if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }
    return initial_theme;
}

export function build_html_export_theme_select(
    t: (key: string, opts?: Record<string, unknown>) => string,
    initial_theme: HtmlExportThemeId
): string {
    const label = escape_html_internal(t('settings_theme_label'));
    let options_html = '';
    for (const option of HTML_EXPORT_THEME_OPTIONS) {
        const selected = option.value === initial_theme ? ' selected' : '';
        options_html += `<option value="${option.value}"${selected}>${escape_html_internal(t(option.label_key))}</option>`;
    }

    return (
        `<div class="html-export-theme-controls">` +
        `<label class="html-export-theme-label" for="html-export-theme-select">${label}</label>` +
        `<select id="html-export-theme-select" class="html-export-theme-select" aria-label="${label}">` +
        options_html +
        `</select>` +
        `</div>`
    );
}

export function build_html_export_sidebar_controls(
    t: (key: string, opts?: Record<string, unknown>) => string,
    initial_theme: HtmlExportThemeId
): string {
    let html = '<div class="html-export-sidebar-controls">';
    html += '<div class="sort-controls">';
    html += `<div class="sort-label">${escape_html_internal(t('html_export_sort_label'))}</div>`;
    html += '<div class="sort-options">';
    html += `<label class="sort-option"><input type="radio" name="sort-by" value="requirement" checked> ${escape_html_internal(t('html_export_sort_requirement'))}</label>`;
    html += `<label class="sort-option"><input type="radio" name="sort-by" value="sample"> ${escape_html_internal(t('html_export_sort_sample'))}</label>`;
    html += '</div>';
    html += '</div>';
    html += build_html_export_theme_select(t, initial_theme);
    html += '</div>';
    return html;
}

/**
 * @fileoverview Enhetstester för HTML-export teman och sidopanel.
 */

import {
    build_html_export_sidebar_controls,
    resolve_html_export_document_theme,
    HTML_EXPORT_THEME_OPTIONS
} from '../../js/export/export_html_themes.ts';

describe('export_html_themes', () => {
    const t = (key: string) => key;

    test('HTML_EXPORT_THEME_OPTIONS matchar Leffe-inställningar', () => {
        expect(HTML_EXPORT_THEME_OPTIONS.map((option) => option.value)).toEqual([
            'light',
            'dark',
            'dark-experimental',
            'winter-white',
            'system'
        ]);
    });

    test('build_html_export_sidebar_controls innehåller sortering och tema', () => {
        const html = build_html_export_sidebar_controls(t, 'light');
        expect(html).toContain('sort-controls');
        expect(html).toContain('html-export-theme-select');
        expect(html).toContain('html_export_sort_requirement');
        expect(html).toContain('settings_theme_label');
    });

    test('resolve_html_export_document_theme mappar system till light eller dark', () => {
        expect(resolve_html_export_document_theme('dark')).toBe('dark');
        expect(resolve_html_export_document_theme('dark-experimental')).toBe('dark-experimental');
        expect(resolve_html_export_document_theme('winter-white')).toBe('winter-white');
        expect(['light', 'dark']).toContain(resolve_html_export_document_theme('system'));
    });
});

/**
 * @fileoverview Interaktivt sidopanelskript för HTML-export (tema + kompakt layout).
 */

export const HTML_EXPORT_SIDEBAR_SCRIPT = `
            function resolve_html_export_theme_from_system() {
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    return 'dark';
                }
                return 'light';
            }

            function resolve_html_export_document_theme(theme) {
                if (theme === 'system') {
                    return resolve_html_export_theme_from_system();
                }
                if (
                    theme === 'light' ||
                    theme === 'dark' ||
                    theme === 'dark-experimental' ||
                    theme === 'winter-white'
                ) {
                    return theme;
                }
                return 'light';
            }

            function apply_html_export_theme(theme) {
                const resolved = resolve_html_export_document_theme(theme);
                document.documentElement.setAttribute('data-theme', resolved);
            }

            function setup_html_export_theme_select() {
                const theme_select = document.getElementById('html-export-theme-select');
                if (!theme_select) return;

                apply_html_export_theme(theme_select.value);

                theme_select.addEventListener('change', function() {
                    apply_html_export_theme(this.value);
                });

                if (window.matchMedia) {
                    const media = window.matchMedia('(prefers-color-scheme: dark)');
                    const on_system_theme_change = function() {
                        if (theme_select.value === 'system') {
                            apply_html_export_theme('system');
                        }
                    };
                    if (typeof media.addEventListener === 'function') {
                        media.addEventListener('change', on_system_theme_change);
                    } else if (typeof media.addListener === 'function') {
                        media.addListener(on_system_theme_change);
                    }
                }
            }

            document.addEventListener('DOMContentLoaded', setup_html_export_theme_select);
`;

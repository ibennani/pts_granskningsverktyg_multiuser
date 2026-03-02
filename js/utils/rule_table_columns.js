// js/utils/rule_table_columns.js
// Returnerar kolumndefinitioner för regelfilstabellen, används med GenericTableComponent.

/**
 * Skapar kolumndefinitioner för regelfilstabellen.
 * @param {Object} deps - { t, Helpers, Translation }
 * @param {Object} handlers - { onEditRule(id), onDownloadRule(id), onDeleteRule(id), onPublishRule(id) }
 * @returns {Array<{ headerLabel: string, getContent: (row: any) => string | HTMLElement }>}
 */
export function create_rule_table_columns(deps, handlers) {
    const { t, Helpers, Translation } = deps;
    const { onEditRule, onDownloadRule, onDeleteRule, onPublishRule } = handlers;

    const icon_svg = (name, size = 16) =>
        Helpers?.get_icon_svg ? Helpers.get_icon_svg(name, ['currentColor'], size) : '';

    const columns = [
        {
            headerLabel: t('audit_rules_col_name'),
            getSortValue: (row) => (row.name || `Regelfil ${row.id}`).toString().trim(),
            getContent: (row) => {
                const rule_name = (row.name || `Regelfil ${row.id}`).trim();
                const version_parts = [];
                if (row.version_display) {
                    version_parts.push(t('rulefile_version_published_label', { version: row.version_display }));
                }
                if (row.has_draft && row.draft_version) {
                    version_parts.push(t('rulefile_version_draft_label', { version: row.draft_version }));
                }
                const version_suffix = version_parts.length > 0 ? ` (${version_parts.join(' · ')})` : '';
                const link_text = rule_name + version_suffix;
                const link = Helpers.create_element('a', {
                    class_name: 'generic-table-audit-link',
                    text_content: link_text,
                    attributes: {
                        href: '#edit_rulefile_main',
                        'aria-label': t('audit_edit_rule_aria', { name: link_text })
                    }
                });
                if (typeof onEditRule === 'function') {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        onEditRule(row.id);
                    });
                }
                return link;
            }
        },
        {
            headerLabel: t('audit_rules_col_actions'),
            isAction: true,
            getContent: (row) => {
                const rule_name = (row.name || `Regelfil ${row.id}`).trim();
                const version_parts = [];
                if (row.version_display) {
                    version_parts.push(t('rulefile_version_published_label', { version: row.version_display }));
                }
                if (row.has_draft && row.draft_version) {
                    version_parts.push(t('rulefile_version_draft_label', { version: row.draft_version }));
                }
                const version_suffix = version_parts.length > 0 ? ` (${version_parts.join(' · ')})` : '';
                const link_text = rule_name + version_suffix;

                const container = Helpers.create_element('div');

                if (typeof onDownloadRule === 'function') {
                    const download_aria = t('audit_download_rule_aria', { name: link_text });
                    const download_btn = Helpers.create_element('button', {
                        class_name: ['button', 'button-default', 'button-small', 'generic-table-download-btn'],
                        html_content: `<span>${t('audit_download_label')}</span>` + icon_svg('save'),
                        attributes: {
                            type: 'button',
                            'aria-label': download_aria
                        }
                    });
                    download_btn.addEventListener('click', () => onDownloadRule(row.id));
                    container.appendChild(download_btn);
                }

                if (row.has_draft && typeof onPublishRule === 'function') {
                    const publish_aria = t('rulefile_publish_rule_aria', { name: link_text });
                    const publish_btn = Helpers.create_element('button', {
                        class_name: ['button', 'button-success', 'button-small', 'generic-table-publish-btn'],
                        html_content: `<span>${t('rulefile_publish_button')}</span>` + icon_svg('publish'),
                        attributes: {
                            type: 'button',
                            'aria-label': publish_aria
                        }
                    });
                    publish_btn.addEventListener('click', () => onPublishRule(row.id));
                    container.appendChild(publish_btn);
                }

                if (typeof onDeleteRule === 'function') {
                    const delete_label = t('delete') + ' ' + link_text;
                    const delete_btn = Helpers.create_element('button', {
                        class_name: ['button', 'button-danger', 'button-small', 'generic-table-delete-btn'],
                        html_content: `<span>${t('delete')}</span>` + icon_svg('delete'),
                        attributes: {
                            type: 'button',
                            'aria-label': delete_label
                        }
                    });
                    delete_btn.addEventListener('click', () => {
                        const show_modal = window.show_confirm_delete_modal;
                        if (show_modal) {
                            show_modal({
                                h1_text: t('audit_confirm_delete_rule_title'),
                                warning_text: t('audit_confirm_delete_rule_warning', { name: link_text }),
                                delete_button: delete_btn,
                                yes_label: t('audit_confirm_delete_radera'),
                                no_label: t('audit_confirm_delete_behall'),
                                on_confirm: () => onDeleteRule(row.id)
                            });
                        } else {
                            onDeleteRule(row.id);
                        }
                    });
                    container.appendChild(delete_btn);
                }

                return container;
            }
        }
    ];

    return columns;
}


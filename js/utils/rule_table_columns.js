// js/utils/rule_table_columns.js
// Returnerar kolumndefinitioner för regelfilstabellen, används med GenericTableComponent.

/**
 * Skapar kolumndefinitioner för regelfilstabellen.
 * @param {Object} deps - { t, Helpers, Translation, production_rules_with_base_ids?, is_draft_table? }
 * @param {Object} handlers - { onEditRule(id), onDownloadRule(id), onDeleteRule(id), onPublishRule(id), onCopyRule(id), onPublishProductionRule(id) }
 * @returns {Array<{ headerLabel: string, getContent: (row: any) => string | HTMLElement }>}
 */
export function create_rule_table_columns(deps, handlers) {
    const { t, Helpers, Translation, is_draft_table = false } = deps;
    const { onEditRule, onDownloadRule, onDeleteRule, onPublishRule, onCopyRule, onPublishProductionRule } = handlers;

    const icon_svg = (name, size = 16) =>
        Helpers?.get_icon_svg ? Helpers.get_icon_svg(name, ['currentColor'], size) : '';

    const columns = [
        {
            headerLabel: t('audit_rules_col_name'),
            getSortValue: (row) => (row.name || `Regelfil ${row.id}`).toString().trim(),
            getContent: (row) => {
                const rule_name = (row.name || `Regelfil ${row.id}`).trim();
                const is_production_row = !!row.production_base_id;
                const is_published = row.is_published === true;

                let link_text = rule_name;
                if (is_published && !is_production_row) {
                    // Verkligen publicerad basregel: visa version + (Publicerad)
                    link_text = row.version_display
                        ? `${rule_name} ${row.version_display} (${t('rulefile_status_published_label')})`
                        : `${rule_name} (${t('rulefile_status_published_label')})`;
                } else {
                    // Arbetskopia: antingen produktionskopia (production_base_id) eller opublicerad (t.ex. uppladdad)
                    link_text = row.version_display
                        ? `${rule_name} ${row.version_display} (${t('rulefile_status_production_label')})`
                        : `${rule_name} (${t('rulefile_status_production_label')})`;
                }
                const link = Helpers.create_element('a', {
                    class_name: 'generic-table-audit-link',
                    text_content: link_text,
                    attributes: {
                        href: '#edit_rulefile_main',
                        'aria-label': t('audit_edit_rule_aria', { name: link_text }),
                        'data-rule-id': row.id
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
                const is_production_row = !!row.production_base_id;
                const is_published = row.is_published === true;

                let link_text = rule_name;
                if (is_published && !is_production_row) {
                    link_text = row.version_display
                        ? `${rule_name} ${row.version_display} (${t('rulefile_status_published_label')})`
                        : `${rule_name} (${t('rulefile_status_published_label')})`;
                } else {
                    link_text = row.version_display
                        ? `${rule_name} ${row.version_display} (${t('rulefile_status_production_label')})`
                        : `${rule_name} (${t('rulefile_status_production_label')})`;
                }

                const container = Helpers.create_element('div', { class_name: 'generic-table-action-cell' });

                const has_production_copy_for_base = Array.isArray(deps.production_rules_with_base_ids)
                    ? deps.production_rules_with_base_ids.includes(row.id)
                    : false;

                const show_copy_btn = !is_draft_table && !is_production_row && !has_production_copy_for_base && typeof onCopyRule === 'function';
                if (show_copy_btn) {
                    const copy_aria = t('audit_create_working_copy_aria', { name: link_text });
                    const copy_btn = Helpers.create_element('button', {
                        class_name: ['button', 'button-default', 'button-small', 'generic-table-edit-btn'],
                        html_content: `<span>${t('audit_create_working_copy_label')}</span>` + icon_svg('edit'),
                        attributes: {
                            type: 'button',
                            'aria-label': copy_aria
                        }
                    });
                    copy_btn.addEventListener('click', () => onCopyRule(row.id));
                    container.appendChild(copy_btn);
                }

                // Publicera-knapp visas för alla rader i Arbetskopior-tabellen (alltid till vänster om Ladda ner).
                const show_publish_btn = (is_draft_table || is_production_row) && typeof onPublishProductionRule === 'function';
                if (show_publish_btn) {
                    const publish_prod_aria = t('rulefile_publish_rule_aria', { name: link_text });
                    const publish_prod_btn = Helpers.create_element('button', {
                        class_name: ['button', 'button-success', 'button-small', 'generic-table-publish-btn'],
                        html_content: `<span>${t('rulefile_publish_button')}</span>` + icon_svg('publish'),
                        attributes: {
                            type: 'button',
                            'aria-label': publish_prod_aria
                        }
                    });
                    publish_prod_btn.addEventListener('click', () => onPublishProductionRule(row.id));
                    container.appendChild(publish_prod_btn);
                }

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
                        if (typeof onDeleteRule === 'function') {
                            onDeleteRule(row.id, link_text, delete_btn);
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


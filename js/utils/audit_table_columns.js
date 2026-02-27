// js/utils/audit_table_columns.js
// Returnerar kolumndefinitioner för granskningstabellen, används med GenericTableComponent.

const EMPTY_PLACEHOLDER = '—';

/**
 * Skapar kolumndefinitioner för granskningstabellen.
 * @param {Object} deps - { t, Helpers, Translation, get_status_label }
 * @param {Object} handlers - { onOpenAudit(auditId), onDownloadAudit(auditId), onDeleteAudit?(auditId) }
 * @param {{ includeDelete: boolean }} [opts] - includeDelete true för audit-vyn (kolumn Radera).
 * @returns {Array<{ headerLabel: string, getContent: (row: any) => string | HTMLElement }>}
 */
export function create_audit_table_columns(deps, handlers, opts = {}) {
    const { t, Helpers, Translation, get_status_label } = deps;
    const { onOpenAudit, onDownloadAudit, onDeleteAudit } = handlers;
    const include_delete = opts.includeDelete === true;

    const icon_svg = (name, size = 16) =>
        Helpers?.get_icon_svg ? Helpers.get_icon_svg(name, ['currentColor'], size) : '';

    const lang = Translation?.get_current_language_code?.() || 'sv-SE';
    const format_num = (val) =>
        Helpers?.format_number_locally?.(val, lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ??
        (val != null ? Number(val).toFixed(1) : EMPTY_PLACEHOLDER);

    const columns = [
        {
            headerLabel: t('start_view_col_case_number'),
            getSortValue: (row) => (row.metadata?.caseNumber ?? '').toString().trim(),
            getContent: (row) => (row.metadata?.caseNumber ?? '').toString().trim() || EMPTY_PLACEHOLDER
        },
        {
            headerLabel: t('start_view_col_actor'),
            getSortValue: (row) => (row.metadata?.actorName ?? row.metadata?.caseNumber ?? '').toString().trim(),
            getContent: (row) => {
                const case_number = (row.metadata?.caseNumber ?? '').toString().trim();
                const actor_name = (row.metadata?.actorName ?? '').toString().trim();
                const link_label = actor_name || case_number || EMPTY_PLACEHOLDER;
                const a = Helpers.create_element('a', {
                    class_name: 'generic-table-audit-link',
                    text_content: actor_name || EMPTY_PLACEHOLDER,
                    attributes: {
                        href: `#audit_overview?auditId=${row.id}`,
                        'aria-label': t('start_view_open_audit_aria', { name: link_label })
                    }
                });
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    onOpenAudit(row.id);
                });
                return a;
            }
        },
        {
            headerLabel: t('start_view_col_status'),
            getSortValue: (row) => (row.status ?? '').toString(),
            getContent: (row) => (row.status ? get_status_label(row.status) : EMPTY_PLACEHOLDER)
        },
        {
            headerLabel: t('start_view_col_progress'),
            getSortValue: (row) => row.progress != null ? Number(row.progress) : -1,
            getContent: (row) => (row.progress != null ? `${row.progress}%` : EMPTY_PLACEHOLDER)
        },
        {
            headerLabel: t('start_view_col_deficiency'),
            getSortValue: (row) => (row.deficiency_index != null ? Number(row.deficiency_index) : -Infinity),
            getContent: (row) =>
                row.deficiency_index != null ? format_num(row.deficiency_index) : EMPTY_PLACEHOLDER
        },
        {
            headerLabel: t('start_view_col_auditor'),
            getSortValue: (row) => (row.metadata?.auditorName ?? '').toString().trim(),
            getContent: (row) => (row.metadata?.auditorName ?? '').toString().trim() || EMPTY_PLACEHOLDER
        },
        {
            headerLabel: t('start_view_col_download'),
            getContent: (row) => {
                const case_number = (row.metadata?.caseNumber ?? '').toString().trim();
                const actor_name = (row.metadata?.actorName ?? '').toString().trim();
                const download_details = [case_number, actor_name].filter(Boolean).join(' ') || EMPTY_PLACEHOLDER;
                const btn = Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small', 'generic-table-download-btn'],
                    html_content: `<span>${t('audit_download_label')}</span>` + icon_svg('save'),
                    attributes: {
                        type: 'button',
                        'aria-label': t('start_view_download_audit_aria', { details: download_details })
                    }
                });
                btn.addEventListener('click', () => onDownloadAudit(row.id));
                return btn;
            }
        }
    ];

    if (include_delete && typeof onDeleteAudit === 'function') {
        columns.push({
            headerLabel: t('delete'),
            getContent: (row) => {
                const actor_name = (row.metadata?.actorName ?? '').toString().trim();
                const case_number = (row.metadata?.caseNumber ?? '').toString().trim();
                const audit_link_text = actor_name || case_number || `Granskning ${row.id}`;
                const delete_btn = Helpers.create_element('button', {
                    class_name: ['button', 'button-danger', 'button-small'],
                    html_content: `<span>${t('delete')}</span>` + icon_svg('delete'),
                    attributes: { type: 'button', 'aria-label': t('audit_delete_audit_aria', { name: audit_link_text }) }
                });
                delete_btn.addEventListener('click', () => {
                    const show_modal = window.show_confirm_delete_modal;
                    if (show_modal) {
                        show_modal({
                            h1_text: t('audit_confirm_delete_audit_title'),
                            warning_text: t('audit_confirm_delete_audit_warning', { name: audit_link_text }),
                            delete_button: delete_btn,
                            yes_label: t('audit_confirm_delete_radera'),
                            no_label: t('audit_confirm_delete_behall'),
                            on_confirm: () => onDeleteAudit(row.id)
                        });
                    } else {
                        onDeleteAudit(row.id);
                    }
                });
                return delete_btn;
            }
        });
    }

    return columns;
}

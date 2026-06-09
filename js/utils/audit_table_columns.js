// js/utils/audit_table_columns.js
// Returnerar kolumndefinitioner för granskningstabellen, används med GenericTableComponent.

import {
    format_audit_row_progress_display,
    progress_percent_for_audit_row
} from '../logic/audit_list_progress.js';

const EMPTY_PLACEHOLDER = '—';

/**
 * Visningsnamn för granskning i modaler och aria-etiketter (dnr före aktörsnamn när dnr finns).
 * @param {object|null|undefined} metadata
 * @param {string|number} [audit_id]
 * @returns {string}
 */
export function format_audit_display_label(metadata, audit_id) {
    const case_number = (metadata?.caseNumber ?? '').toString().trim();
    const actor_name = (metadata?.actorName ?? '').toString().trim();
    if (case_number && actor_name) {
        return `${case_number} - ${actor_name}`;
    }
    if (case_number) return case_number;
    if (actor_name) return actor_name;
    if (audit_id !== null && audit_id !== undefined && audit_id !== '') {
        return `Granskning ${audit_id}`;
    }
    return '';
}

/**
 * Skapar kolumndefinitioner för granskningstabellen.
 * @param {Object} deps - { t, Helpers, Translation, get_status_label, get_live_audit_state? }
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
        (val !== null && val !== undefined ? Number(val).toFixed(1) : EMPTY_PLACEHOLDER);

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
                        'aria-label': t('backup_overview_link_to_audit_aria', { name: link_label })
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
            getSortValue: (row) => {
                const pct = progress_percent_for_audit_row(
                    row,
                    typeof deps.get_live_audit_state === 'function' ? deps.get_live_audit_state() : null
                );
                return pct !== null && pct !== undefined ? Number(pct) : -1;
            },
            getContent: (row) => {
                const live =
                    typeof deps.get_live_audit_state === 'function' ? deps.get_live_audit_state() : null;
                const lang = Translation?.get_current_language_code?.() || 'sv-SE';
                const formatted = format_audit_row_progress_display(
                    row,
                    live,
                    lang,
                    Helpers?.format_number_locally
                );
                return formatted ?? EMPTY_PLACEHOLDER;
            }
        },
        {
            headerLabel: t('start_view_col_deficiency'),
            getSortValue: (row) => (row.deficiency_index !== null && row.deficiency_index !== undefined ? Number(row.deficiency_index) : -Infinity),
            getContent: (row) =>
                (row.deficiency_index !== null && row.deficiency_index !== undefined) ? format_num(row.deficiency_index) : EMPTY_PLACEHOLDER
        },
        {
            headerLabel: t('start_view_col_auditor'),
            getSortValue: (row) => (row.metadata?.auditorName ?? '').toString().trim(),
            getContent: (row) => (row.metadata?.auditorName ?? '').toString().trim() || EMPTY_PLACEHOLDER
        },
        {
            headerLabel: t('start_view_col_last_updated'),
            getSortValue: (row) => (row.updated_at ? String(row.updated_at) : ''),
            getContent: (row) => {
                if (!row.updated_at) return EMPTY_PLACEHOLDER;
                return Helpers?.format_iso_to_local_datetime?.(row.updated_at, lang) || String(row.updated_at);
            }
        },
        {
            headerLabel: t('start_view_col_download'),
            isAction: true,
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
            isAction: true,
            getContent: (row) => {
                const audit_link_text = format_audit_display_label(row.metadata, row.id);
                const delete_btn = Helpers.create_element('button', {
                    class_name: ['button', 'button-danger', 'button-small'],
                    html_content: `<span>${t('delete')}</span>` + icon_svg('delete'),
                    attributes: { type: 'button', 'aria-label': t('audit_delete_audit_aria', { name: audit_link_text }) }
                });
                delete_btn.addEventListener('click', () => {
                    if (typeof onDeleteAudit === 'function') {
                        onDeleteAudit(row.id, audit_link_text, delete_btn);
                    }
                });
                return delete_btn;
            }
        });
    }

    return columns;
}

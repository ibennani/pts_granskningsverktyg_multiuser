// js/utils/audit_table_columns.js
// Returnerar kolumndefinitioner för granskningstabellen, används med GenericTableComponent.

import { read_audit_auditor_display_name } from '../logic/user_identity.js';
import {
    get_group_actor_display_sort_value,
    resolve_group_actor_display_name
} from '../logic/audit_list_group_display_names.js';
import {
    get_group_auditor_sort_value,
    resolve_auditor_group_display_name
} from '../logic/audit_list_case_grouping.js';
import { create_file_download_button } from './file_download_button_ui.js';
import { audit_row_granskningstyp_display_label } from './audit_type_display_label.js';

const EMPTY_PLACEHOLDER = '—';

/**
 * Skapar kolumndefinitioner för granskningstabellen.
 * @param {Object} deps - { t, Helpers, Translation, get_status_label }
 * @param {Object} handlers - { onOpenAudit(auditId), onDownloadAudit(auditId), onDeleteAudit?(auditId) }
 * @param {{ includeDelete?: boolean, omitCaseNumberColumn?: boolean, omitAuditorColumn?: boolean }} [opts]
 * @returns {Array<{ headerLabel: string, getContent: (row: any) => string | HTMLElement }>}
 */
export function create_audit_table_columns(deps, handlers, opts = {}) {
    const { t, Helpers, Translation, get_status_label } = deps;
    const { onOpenAudit, onDownloadAudit, onDeleteAudit } = handlers;
    const include_delete = opts.includeDelete === true;
    const omit_case_number = opts.omitCaseNumberColumn === true;
    const omit_auditor = opts.omitAuditorColumn === true;

    const icon_svg = (name, size = 16) =>
        Helpers?.get_icon_svg ? Helpers.get_icon_svg(name, ['currentColor'], size) : '';

    const lang = Translation?.get_current_language_code?.() || 'sv-SE';
    const format_num = (val) =>
        Helpers?.format_number_locally?.(val, lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ??
        (val !== null && val !== undefined ? Number(val).toFixed(1) : EMPTY_PLACEHOLDER);

    const columns = [
        {
            columnKey: 'case_number',
            headerLabel: t('start_view_col_case_number'),
            getSortValue: (row) => (row.metadata?.caseNumber ?? '').toString().trim(),
            getContent: (row) => (row.metadata?.caseNumber ?? '').toString().trim() || EMPTY_PLACEHOLDER
        },
        {
            columnKey: 'actor',
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
            columnKey: 'media_type',
            headerLabel: t('start_view_col_media_type'),
            getSortValue: (row) => (row.audit_type ?? '').toString().trim(),
            getContent: (row) => (row.audit_type ?? '').toString().trim() || EMPTY_PLACEHOLDER
        },
        {
            columnKey: 'granskningstyp',
            headerLabel: t('start_view_col_granskningstyp'),
            getSortValue: (row) => {
                const label = audit_row_granskningstyp_display_label(row);
                const id = (row.granskningstyp_id || row.metadata?.auditTypeId || '').toString().trim();
                if (!label && !id) return t('audit_granskningstyp_missing_label');
                return label;
            },
            getContent: (row) => {
                const label = audit_row_granskningstyp_display_label(row);
                const id = (row.granskningstyp_id || row.metadata?.auditTypeId || '').toString().trim();
                if (!label && !id) return t('audit_granskningstyp_missing_label');
                return label || EMPTY_PLACEHOLDER;
            }
        },
        {
            columnKey: 'status',
            headerLabel: t('start_view_col_status'),
            getSortValue: (row) => (row.status ?? '').toString(),
            getContent: (row) => (row.status ? get_status_label(row.status) : EMPTY_PLACEHOLDER)
        },
        {
            columnKey: 'progress',
            headerLabel: t('start_view_col_progress'),
            getSortValue: (row) => (row.progress !== null && row.progress !== undefined) ? Number(row.progress) : -1,
            getContent: (row) => (row.progress !== null && row.progress !== undefined ? `${row.progress}%` : EMPTY_PLACEHOLDER)
        },
        {
            columnKey: 'deficiency',
            headerLabel: t('start_view_col_deficiency'),
            getSortValue: (row) => (row.deficiency_index !== null && row.deficiency_index !== undefined ? Number(row.deficiency_index) : -Infinity),
            getContent: (row) =>
                (row.deficiency_index !== null && row.deficiency_index !== undefined) ? format_num(row.deficiency_index) : EMPTY_PLACEHOLDER
        },
        {
            columnKey: 'auditor',
            headerLabel: t('start_view_col_auditor'),
            getSortValue: (row) => read_audit_auditor_display_name(row),
            getContent: (row) => read_audit_auditor_display_name(row) || EMPTY_PLACEHOLDER
        },
        {
            columnKey: 'last_updated',
            headerLabel: t('start_view_col_last_updated'),
            getSortValue: (row) => (row.updated_at ? String(row.updated_at) : ''),
            getContent: (row) => {
                if (!row.updated_at) return EMPTY_PLACEHOLDER;
                return Helpers?.format_iso_to_local_datetime?.(row.updated_at, lang) || String(row.updated_at);
            }
        },
        {
            columnKey: 'download',
            headerLabel: t('start_view_col_download'),
            isAction: true,
            getContent: (row) => {
                const case_number = (row.metadata?.caseNumber ?? '').toString().trim();
                const actor_name = (row.metadata?.actorName ?? '').toString().trim();
                const download_details = [case_number, actor_name].filter(Boolean).join(' ') || EMPTY_PLACEHOLDER;
                const parts = create_file_download_button({
                    Helpers,
                    label: t('audit_download_label'),
                    t,
                    variant: 'button-default',
                    icon_name: 'save',
                    extra_class_names: ['generic-table-download-btn'],
                    aria_label: t('start_view_download_audit_aria', { details: download_details }),
                    on_download: () => Promise.resolve(onDownloadAudit(row.id)),
                });
                return parts.wrapper;
            }
        }
    ];

    let result = columns;
    if (omit_case_number) {
        result = result.slice(1);
    }
    if (omit_auditor) {
        result = result.filter((col) => col.columnKey !== 'auditor');
    }

    if (include_delete && typeof onDeleteAudit === 'function') {
        result.push({
            columnKey: 'delete',
            headerLabel: t('delete'),
            isAction: true,
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
                    if (typeof onDeleteAudit === 'function') {
                        onDeleteAudit(row.id, audit_link_text, delete_btn);
                    }
                });
                return delete_btn;
            }
        });
    }

    return result;
}

/**
 * Kolumner för grupperad granskningslista.
 * @param {{ t: function(string, Object=): string }} deps
 * @param {{ groupMode?: 'case' | 'auditor' }} [opts]
 * @returns {Array<{ headerLabel: string, getContent: (row: any) => string, getSortValue?: (row: any) => string }>}
 */
export function create_audit_group_table_columns(deps, opts = {}) {
    const { t } = deps;
    const group_mode = opts.groupMode === 'auditor' ? 'auditor' : 'case';
    if (group_mode === 'auditor') {
        return [
            {
                headerLabel: t('start_view_col_auditor'),
                getSortValue: (row) => get_group_auditor_sort_value(row.audits || []),
                getContent: (row) =>
                    resolve_auditor_group_display_name(row.group_key ?? '', row.audits || []) || EMPTY_PLACEHOLDER
            },
            {
                headerLabel: t('audit_group_col_count'),
                getSortValue: (row) => (row.audits || []).length,
                getContent: (row) => t('audit_group_count', { count: (row.audits || []).length })
            }
        ];
    }
    return [
        {
            headerLabel: t('start_view_col_case_number'),
            getSortValue: (row) => (row.group_key ?? row.case_number ?? '').toString().trim(),
            getContent: (row) => (row.group_key ?? row.case_number ?? '').toString().trim() || EMPTY_PLACEHOLDER
        },
        {
            headerLabel: t('start_view_col_actor'),
            getSortValue: (row) =>
                get_group_actor_display_sort_value(row.group_key ?? '', row.audits || []),
            getContent: (row) =>
                resolve_group_actor_display_name(row.group_key ?? '', row.audits || []) ||
                EMPTY_PLACEHOLDER
        },
        {
            headerLabel: t('audit_group_col_count'),
            getSortValue: (row) => (row.audits || []).length,
            getContent: (row) => t('audit_group_count', { count: (row.audits || []).length })
        }
    ];
}

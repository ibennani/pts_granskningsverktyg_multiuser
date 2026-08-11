/**
 * @fileoverview Kolumndefinitioner för snapshot-listan (GenericTableComponent).
 */
import type { AuditSnapshotListItem } from '../api/audit_snapshot_api.js';
import { create_file_download_button } from './file_download_button_ui.js';
import {
    get_download_filename_datetime,
    sanitize_filename_segment,
} from './download_filename_utils.js';

type SnapshotTableRow = AuditSnapshotListItem & { rowId: string };

type SnapshotTableDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        format_iso_to_local_datetime?: (iso: string, lang: string) => string;
        get_icon_svg?: (name: string, classes: string[], size: number) => string;
    };
    Translation: { get_current_language_code?: () => string };
    t: (key: string, opts?: Record<string, unknown>) => string;
};

function format_status_label(
    t: SnapshotTableDeps['t'],
    item: AuditSnapshotListItem
): string {
    const pending = item.pendingAttempt;
    if (pending) {
        if (pending.status === 'queued') return t('audit_snapshots_status_queued');
        if (pending.status === 'capturing') return t('audit_snapshots_status_capturing');
        if (pending.status === 'packaging') return t('audit_snapshots_status_packaging');
        if (pending.status === 'failed') return t('audit_snapshots_status_failed');
        if (pending.status === 'cancelled') return t('audit_snapshots_status_cancelled');
    }
    if (item.currentReady) {
        if (item.currentReady.warningCount > 0) {
            return t('audit_snapshots_status_ready_warnings');
        }
        return t('audit_snapshots_status_ready');
    }
    return t('audit_snapshots_status_none');
}

function format_bytes(
    size: number | null | undefined,
    t: SnapshotTableDeps['t']
): string {
    if (size == null || !Number.isFinite(size)) return '—';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} ${t('audit_snapshots_size_kb')}`;
    return `${(size / (1024 * 1024)).toFixed(1)} ${t('audit_snapshots_size_mb')}`;
}

export function build_audit_snapshots_table_columns(
    deps: SnapshotTableDeps,
    handlers: {
        on_download: (row: SnapshotTableRow) => Promise<void>;
        on_delete: (row: SnapshotTableRow, delete_button: HTMLElement) => void;
    },
    format_datetime: (iso: string | null | undefined) => string
) {
    const { Helpers, t } = deps;
    const icon_svg = (name: string, size = 16) =>
        Helpers.get_icon_svg ? Helpers.get_icon_svg(name, ['currentColor'], size) : '';

    return [
        {
            columnKey: 'sample',
            headerLabel: t('audit_snapshots_col_sample'),
            getSortValue: (row: SnapshotTableRow) =>
                (row.sampleDescription ?? row.sampleId ?? '').toString(),
            getContent: (row: SnapshotTableRow) => row.sampleDescription || row.sampleId,
        },
        {
            columnKey: 'url',
            headerLabel: t('audit_snapshots_col_url'),
            getSortValue: (row: SnapshotTableRow) => row.requestedUrl || '',
            getContent: (row: SnapshotTableRow) => row.requestedUrl || '—',
        },
        {
            columnKey: 'captured',
            headerLabel: t('audit_snapshots_col_captured'),
            getSortValue: (row: SnapshotTableRow) =>
                row.currentReady?.capturedAt ? Date.parse(row.currentReady.capturedAt) || 0 : 0,
            getContent: (row: SnapshotTableRow) =>
                format_datetime(row.currentReady?.capturedAt ?? null),
        },
        {
            columnKey: 'status',
            headerLabel: t('audit_snapshots_col_status'),
            getSortValue: (row: SnapshotTableRow) => format_status_label(t, row),
            getContent: (row: SnapshotTableRow) => {
                const cell = Helpers.create_element('div');
                cell.appendChild(
                    Helpers.create_element('span', { text_content: format_status_label(t, row) })
                );
                if (row.pendingAttempt && row.currentReady) {
                    cell.appendChild(
                        Helpers.create_element('p', {
                            class_name: 'audit-actions-snapshots__secondary-status',
                            text_content: t('audit_snapshots_replacement_in_progress', {
                                captured_at: format_datetime(row.currentReady.capturedAt),
                            }),
                        })
                    );
                }
                if (row.pendingAttempt?.status === 'failed' && row.pendingAttempt.error) {
                    cell.appendChild(
                        Helpers.create_element('p', {
                            class_name: 'audit-actions-snapshots__error-text',
                            text_content: row.pendingAttempt.error,
                        })
                    );
                }
                return cell;
            },
        },
        {
            columnKey: 'size',
            headerLabel: t('audit_snapshots_col_size'),
            getSortValue: (row: SnapshotTableRow) => row.currentReady?.sizeBytes ?? -1,
            getContent: (row: SnapshotTableRow) =>
                format_bytes(row.currentReady?.sizeBytes ?? null, t),
        },
        {
            columnKey: 'actions',
            headerLabel: t('audit_snapshots_col_action'),
            isAction: true,
            getContent: (row: SnapshotTableRow) => {
                const wrapper = Helpers.create_element('div', {
                    class_name: 'audit-snapshots-table-actions',
                });
                const sample_label = row.sampleDescription || row.sampleId;

                if (row.currentReady) {
                    const download_parts = create_file_download_button({
                        Helpers: Helpers as never,
                        t,
                        label: t('audit_snapshots_download_one'),
                        aria_label: t('audit_snapshots_download_one_for_sample', { sample: sample_label }),
                        variant: 'button-default',
                        extra_class_names: ['button-small', 'generic-table-action-cell'],
                        on_download: () => handlers.on_download(row),
                    });
                    wrapper.appendChild(download_parts.wrapper);
                }

                const delete_btn = Helpers.create_element('button', {
                    class_name: ['button', 'button-danger', 'button-small', 'generic-table-action-cell'],
                    html_content: `<span>${t('delete')}</span>${icon_svg('delete')}`,
                    attributes: {
                        type: 'button',
                        'aria-label': t('audit_snapshots_delete_one_for_sample', { sample: sample_label }),
                    },
                });
                delete_btn.addEventListener('click', () => handlers.on_delete(row, delete_btn));
                wrapper.appendChild(delete_btn);
                return wrapper;
            },
        },
    ];
}

export function map_snapshot_items_to_table_rows(
    items: AuditSnapshotListItem[]
): SnapshotTableRow[] {
    return items
        .filter((item) => item.currentReady || item.pendingAttempt)
        .map((item) => ({
            ...item,
            rowId: item.sampleId,
        }));
}

export type { SnapshotTableRow };

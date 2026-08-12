/**
 * @fileoverview Kolumndefinitioner för snapshot-listan (GenericTableComponent).
 */
import type { AuditSnapshotListItem } from '../api/audit_snapshot_api.js';
import { build_compact_hash_fragment } from '../logic/router_url_codec.js';
import { create_file_download_button } from './file_download_button_ui.js';
import {
    format_sidrapport_warning_label,
    dedupe_sidrapport_warnings_for_display,
} from './sidrapport_warning_labels.js';
import {
    is_sidrapport_retake_busy,
    render_sidrapport_retake_control,
} from './sidrapport_retake_button_ui.js';

type SnapshotTableRow = AuditSnapshotListItem & { rowId: string };

type SampleLike = { id: string; description?: string; url?: string; attachedMediaFilenames?: unknown };

type SnapshotTableDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        format_iso_to_local_datetime?: (iso: string, lang: string) => string;
        get_icon_svg?: (name: string, classes: string[], size: number) => string;
    };
    Translation: { get_current_language_code?: () => string };
    t: (key: string, opts?: Record<string, unknown>) => string;
    getState: () => { samples?: SampleLike[] };
    router?: (view: string, params?: Record<string, unknown>) => void;
    is_sidrapport_retake_busy?: (row: SnapshotTableRow) => boolean;
};

export function resolve_snapshot_sample_label(
    row: AuditSnapshotListItem,
    samples: SampleLike[] | undefined,
    t: SnapshotTableDeps['t']
): string {
    const from_state = samples?.find((sample) => String(sample.id) === String(row.sampleId));
    const description = (from_state?.description ?? row.sampleDescription ?? '').trim();
    if (description) return description;
    return row.sampleId || t('undefined_description');
}

function build_sample_edit_hash(sample_id: string): string {
    return `#${build_compact_hash_fragment('sample_form', { editSampleId: sample_id })}`;
}

function render_sample_name_link(
    row: SnapshotTableRow,
    deps: SnapshotTableDeps,
    sample_label: string
): HTMLElement | string {
    const { Helpers, t, router } = deps;
    if (!router) return sample_label;

    const link = Helpers.create_element('a', {
        class_name: 'generic-table-audit-link',
        text_content: sample_label,
        attributes: {
            href: build_sample_edit_hash(row.sampleId),
        },
    });
    link.addEventListener('click', (event) => {
        event.preventDefault();
        router('sample_form', { editSampleId: row.sampleId });
    });
    return link;
}

function is_sidrapport_replacement_active(
    row: AuditSnapshotListItem,
    is_retake_busy?: (row: SnapshotTableRow) => boolean
): boolean {
    if (is_retake_busy?.(row as SnapshotTableRow)) {
        return true;
    }
    const status = row.pendingAttempt?.status;
    return status === 'queued' || status === 'capturing' || status === 'packaging';
}

function format_replacement_status_label(
    t: SnapshotTableDeps['t'],
    row: AuditSnapshotListItem
): string {
    const pending = row.pendingAttempt;
    if (pending) {
        if (pending.status === 'queued') return t('audit_snapshots_status_queued');
        if (pending.status === 'capturing') return t('audit_snapshots_status_capturing');
        if (pending.status === 'packaging') return t('audit_snapshots_status_packaging');
    }
    return t('audit_snapshots_status_capturing');
}

function format_status_label(
    t: SnapshotTableDeps['t'],
    item: AuditSnapshotListItem,
    is_retake_busy?: (row: SnapshotTableRow) => boolean
): string {
    if (is_sidrapport_replacement_active(item, is_retake_busy)) {
        return format_replacement_status_label(t, item);
    }
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
        on_retake: (row: SnapshotTableRow) => void;
    },
    format_datetime: (iso: string | null | undefined) => string
) {
    const { Helpers, t, getState } = deps;
    const icon_svg = (name: string, size = 16) =>
        Helpers.get_icon_svg ? Helpers.get_icon_svg(name, ['currentColor'], size) : '';
    const resolve_sample_label = (row: SnapshotTableRow) =>
        resolve_snapshot_sample_label(row, getState()?.samples, t);

    return [
        {
            columnKey: 'sample',
            headerLabel: t('audit_snapshots_col_sample'),
            getSortValue: (row: SnapshotTableRow) => resolve_sample_label(row),
            getContent: (row: SnapshotTableRow) =>
                render_sample_name_link(row, deps, resolve_sample_label(row)),
        },
        {
            columnKey: 'captured',
            headerLabel: t('audit_snapshots_col_captured'),
            getSortValue: (row: SnapshotTableRow) =>
                is_sidrapport_replacement_active(row, deps.is_sidrapport_retake_busy)
                    ? 0
                    : row.currentReady?.capturedAt
                      ? Date.parse(row.currentReady.capturedAt) || 0
                      : 0,
            getContent: (row: SnapshotTableRow) =>
                is_sidrapport_replacement_active(row, deps.is_sidrapport_retake_busy)
                    ? '—'
                    : format_datetime(row.currentReady?.capturedAt ?? null),
        },
        {
            columnKey: 'status',
            headerLabel: t('audit_snapshots_col_status'),
            getSortValue: (row: SnapshotTableRow) =>
                format_status_label(t, row, deps.is_sidrapport_retake_busy),
            getContent: (row: SnapshotTableRow) => {
                const cell = Helpers.create_element('div');
                const replacement_active = is_sidrapport_replacement_active(
                    row,
                    deps.is_sidrapport_retake_busy
                );
                cell.appendChild(
                    Helpers.create_element('span', {
                        text_content: format_status_label(t, row, deps.is_sidrapport_retake_busy),
                    })
                );
                if (row.pendingAttempt?.status === 'failed' && row.pendingAttempt.error) {
                    cell.appendChild(
                        Helpers.create_element('p', {
                            class_name: 'audit-actions-snapshots__error-text',
                            text_content: row.pendingAttempt.error,
                        })
                    );
                }
                if (replacement_active) {
                    return cell;
                }
                const warnings = dedupe_sidrapport_warnings_for_display(row.currentReady?.warnings ?? []);
                if (warnings.length > 0) {
                    const warning_list = Helpers.create_element('ul', {
                        class_name: 'audit-actions-snapshots__warning-list',
                    });
                    for (const warning of warnings) {
                        warning_list.appendChild(
                            Helpers.create_element('li', {
                                text_content: format_sidrapport_warning_label(warning, t),
                            })
                        );
                    }
                    cell.appendChild(warning_list);
                } else if ((row.currentReady?.warningCount ?? 0) > 0) {
                    cell.appendChild(
                        Helpers.create_element('p', {
                            class_name: 'audit-actions-snapshots__secondary-status',
                            text_content: t('audit_sidrapport_warnings_legacy_hint'),
                        })
                    );
                }
                return cell;
            },
        },
        {
            columnKey: 'size',
            headerLabel: t('audit_snapshots_col_size'),
            getSortValue: (row: SnapshotTableRow) =>
                is_sidrapport_replacement_active(row, deps.is_sidrapport_retake_busy)
                    ? -1
                    : row.currentReady?.sizeBytes ?? -1,
            getContent: (row: SnapshotTableRow) =>
                is_sidrapport_replacement_active(row, deps.is_sidrapport_retake_busy)
                    ? '—'
                    : format_bytes(row.currentReady?.sizeBytes ?? null, t),
        },
        {
            columnKey: 'actions',
            headerLabel: t('audit_snapshots_col_action'),
            isAction: true,
            getContent: (row: SnapshotTableRow) => {
                const wrapper = Helpers.create_element('div', {
                    class_name: 'audit-snapshots-table-actions',
                });
                const sample_label = resolve_sample_label(row);
                const replacement_active = is_sidrapport_replacement_active(
                    row,
                    deps.is_sidrapport_retake_busy
                );
                const resolve_retake_busy = () =>
                    deps.is_sidrapport_retake_busy
                        ? deps.is_sidrapport_retake_busy(row)
                        : is_sidrapport_retake_busy(row);

                wrapper.appendChild(
                    render_sidrapport_retake_control(
                        Helpers,
                        t,
                        sample_label,
                        resolve_retake_busy(),
                        () => {
                            if (resolve_retake_busy()) return;
                            handlers.on_retake(row);
                        }
                    )
                );

                if (row.currentReady && !replacement_active) {
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

                if (!replacement_active) {
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
                }
                return wrapper;
            },
        },
    ];
}

export function map_snapshot_items_to_table_rows(
    items: AuditSnapshotListItem[],
    samples?: SampleLike[]
): SnapshotTableRow[] {
    return items
        .filter((item) => {
            if (!item.currentReady && !item.pendingAttempt) return false;
            const sample = samples?.find((entry) => String(entry.id) === String(item.sampleId));
            const url = (sample?.url ?? item.requestedUrl ?? '').trim();
            return Boolean(url);
        })
        .map((item) => ({
            ...item,
            rowId: item.sampleId,
        }));
}

export type { SnapshotTableRow };

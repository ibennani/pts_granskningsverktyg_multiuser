/**
 * @fileoverview Verktygsrad ovanför sidrapportstabellen (ladda ner alla, ta om alla).
 */
import { create_file_download_button } from './file_download_button_ui.js';
import {
    get_download_filename_datetime,
    trigger_browser_blob_download,
    FILE_DOWNLOAD_MAX_BYTES,
} from './download_filename_utils.js';
import { get_audit_snapshots_download_all_url } from '../api/audit_snapshot_api.js';
import type { AuditSnapshotListItem } from '../api/audit_snapshot_api.js';
import {
    resolve_retake_sample_for_row,
    start_sidrapport_retake_for_sample,
    type SampleForSidrapport,
} from '../logic/audit_sidrapport_retake.js';
import { is_sidrapport_retake_busy } from './sidrapport_retake_button_ui.js';
import type { SnapshotTableRow } from './audit_snapshots_table_columns.js';

type SnapshotsToolbarHelpers = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
};

type SnapshotsToolbarDeps = {
    Helpers: SnapshotsToolbarHelpers;
    t: (key: string, opts?: Record<string, unknown>) => string;
    getState: () => {
        auditId?: string | null;
        samples?: SampleForSidrapport[];
    };
    fetch_authenticated_blob: (url: string) => Promise<Blob>;
    retake_in_flight_sample_ids: Set<string>;
    get_retake_all_in_flight: () => boolean;
    set_retake_all_in_flight: (value: boolean) => void;
    on_retake_all_complete: (message_key: string, opts?: Record<string, unknown>) => void;
    on_refresh: () => Promise<void>;
};

export function list_bulk_sidrapport_items(
    items: AuditSnapshotListItem[],
    samples: SampleForSidrapport[] | undefined,
    retake_in_flight_sample_ids: ReadonlySet<string>
): AuditSnapshotListItem[] {
    return items.filter((item) => {
        const row = { ...item, rowId: item.sampleId } as SnapshotTableRow;
        if (is_sidrapport_retake_busy(row, retake_in_flight_sample_ids)) {
            return false;
        }
        return resolve_retake_sample_for_row(row, samples);
    });
}

async function start_bulk_sidrapport_capture(
    deps: SnapshotsToolbarDeps,
    items: AuditSnapshotListItem[]
): Promise<void> {
    const audit_id = deps.getState()?.auditId;
    if (!audit_id || deps.get_retake_all_in_flight()) return;

    const samples = deps.getState()?.samples;
    const targets = list_bulk_sidrapport_items(items, samples, deps.retake_in_flight_sample_ids);
    if (targets.length === 0) {
        deps.on_retake_all_complete('audit_sidrapport_retake_all_none');
        return;
    }

    deps.set_retake_all_in_flight(true);

    let started_count = 0;
    const started_sample_ids: string[] = [];
    try {
        for (const item of targets) {
            const row = { ...item, rowId: item.sampleId } as SnapshotTableRow;
            const sample = resolve_retake_sample_for_row(row, samples);
            if (!sample) continue;
            deps.retake_in_flight_sample_ids.add(String(item.sampleId));
            started_sample_ids.push(String(item.sampleId));
            try {
                await start_sidrapport_retake_for_sample(
                    String(audit_id),
                    sample,
                    item.requestedUrl
                );
                started_count += 1;
            } catch {
                deps.retake_in_flight_sample_ids.delete(String(item.sampleId));
            }
        }
    } finally {
        deps.set_retake_all_in_flight(false);
        for (const sample_id of started_sample_ids) {
            deps.retake_in_flight_sample_ids.delete(sample_id);
        }
    }

    if (started_count > 0) {
        deps.on_retake_all_complete('audit_sidrapport_retake_all_started', { count: started_count });
    } else {
        deps.on_retake_all_complete('audit_sidrapport_retake_error');
    }
    await deps.on_refresh();
}

export function render_audit_snapshots_toolbar(
    toolbar_host: HTMLElement,
    deps: SnapshotsToolbarDeps,
    items: AuditSnapshotListItem[]
): void {
    toolbar_host.replaceChildren();
    const ready_count = items.filter((item) => item.currentReady).length;
    const bulk_targets = list_bulk_sidrapport_items(
        items,
        deps.getState()?.samples,
        deps.retake_in_flight_sample_ids
    );
    const show_download_all = ready_count > 0;
    const show_bulk_action = bulk_targets.length > 0 && !deps.get_retake_all_in_flight();
    const bulk_button_label_key =
        ready_count === 0
            ? 'audit_sidrapport_create_all_button'
            : 'audit_sidrapport_retake_all_button';

    if (!show_download_all && !show_bulk_action) {
        toolbar_host.setAttribute('hidden', 'hidden');
        return;
    }

    toolbar_host.removeAttribute('hidden');
    const toolbar = deps.Helpers.create_element('div', { class_name: 'audit-actions-snapshots__toolbar' });
    const start = deps.Helpers.create_element('div', {
        class_name: 'audit-actions-snapshots__toolbar-start',
    });
    const end = deps.Helpers.create_element('div', { class_name: 'audit-actions-snapshots__toolbar-end' });

    if (show_download_all) {
        const download_all_parts = create_file_download_button({
            Helpers: deps.Helpers as never,
            t: deps.t,
            label: deps.t('audit_snapshots_download_all'),
            extra_class_names: ['audit-actions-snapshots__download-all'],
            on_download: async () => {
                const audit_id = String(deps.getState()?.auditId);
                const url = get_audit_snapshots_download_all_url(audit_id);
                const blob = await deps.fetch_authenticated_blob(url);
                if (blob.size > FILE_DOWNLOAD_MAX_BYTES) {
                    throw new Error(deps.t('audit_snapshots_download_all_too_large'));
                }
                const filename = `snapshots_all_${get_download_filename_datetime(null)}.zip`;
                trigger_browser_blob_download(blob, filename);
            },
        });
        download_all_parts.wrapper.classList.add('audit-actions-snapshots__download-all-wrap');
        start.appendChild(download_all_parts.wrapper);
    }

    if (show_bulk_action) {
        const bulk_button_label = deps.t(bulk_button_label_key);
        const bulk_button = deps.Helpers.create_element('button', {
            class_name: ['button', 'button-small', 'button-success', 'audit-actions-snapshots__retake-all'],
            attributes: {
                type: 'button',
                'aria-label': bulk_button_label,
            },
            text_content: bulk_button_label,
        });
        bulk_button.addEventListener('click', () => {
            void start_bulk_sidrapport_capture(deps, items);
        });
        end.appendChild(bulk_button);
    }

    toolbar.append(start, end);
    toolbar_host.appendChild(toolbar);
}

/**
 * @fileoverview Innehåll för Åtgärder → Snapshots.
 */
import './audit_actions_snapshots.css';
import { GenericTableComponent } from './GenericTableComponent.js';
import {
    list_audit_snapshots,
    get_audit_snapshot_download_url,
    get_audit_snapshots_download_all_url,
    delete_audit_snapshots_for_sample,
    type AuditSnapshotListItem,
} from '../api/audit_snapshot_api.js';
import { create_file_download_button } from '../utils/file_download_button_ui.js';
import {
    get_download_filename_datetime,
    sanitize_filename_segment,
    trigger_browser_blob_download,
    FILE_DOWNLOAD_MAX_BYTES,
} from '../utils/download_filename_utils.js';
import { get_auth_token } from '../api/client.js';
import { subscribe_audit_snapshots } from '../logic/list_push_service.js';
import { show_confirm_delete_modal } from '../logic/confirm_delete_modal_logic.js';
import {
    build_audit_snapshots_table_columns,
    map_snapshot_items_to_table_rows,
    type SnapshotTableRow,
} from '../utils/audit_snapshots_table_columns.js';

export type AuditActionsSnapshotsDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        format_iso_to_local_datetime?: (iso: string, lang: string) => string;
        get_icon_svg?: (name: string, classes: string[], size: number) => string;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string; get_current_language_code?: () => string };
    getState: () => { auditId?: string | null; samples?: Array<{ id: string; description?: string }> };
};

async function fetch_authenticated_blob(url: string): Promise<Blob> {
    const token = get_auth_token();
    const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    return res.blob();
}

export function create_audit_actions_snapshots_section(deps: AuditActionsSnapshotsDeps): {
    root: HTMLElement;
    destroy: () => void;
    refresh: () => Promise<void>;
} {
    const { Helpers: helpers, Translation: { t } } = deps;
    const lang = deps.Translation.get_current_language_code?.() || 'sv-SE';

    const root = helpers.create_element('div', { class_name: 'audit-actions-snapshots' });
    root.appendChild(
        helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('audit_snapshots_intro'),
        })
    );

    const live_region = helpers.create_element('p', {
        class_name: 'visually-hidden',
        attributes: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
    }) as HTMLParagraphElement;

    const content_host = helpers.create_element('div', { class_name: 'audit-actions-snapshots__content' });
    const table_host = helpers.create_element('div', { class_name: 'audit-actions-snapshots__table-host' });
    content_host.appendChild(table_host);
    root.append(live_region, content_host);

    const table_component = new GenericTableComponent();
    void table_component.init({ root: table_host, deps: { Helpers: helpers } });

    let unsubscribe: (() => void) | null = null;
    let poll_timer: ReturnType<typeof setInterval> | null = null;
    let last_items_json = '';
    const sort_state = { columnIndex: 0, direction: 'asc' as 'asc' | 'desc' };

    const format_datetime = (iso: string | null | undefined) => {
        if (!iso) return '—';
        if (helpers.format_iso_to_local_datetime) {
            return helpers.format_iso_to_local_datetime(iso, lang) || iso;
        }
        return iso;
    };

    const handle_download_row = async (row: SnapshotTableRow) => {
        const snap = row.currentReady;
        if (!snap) return;
        const audit_id = String(deps.getState()?.auditId);
        const sample_label = row.sampleDescription || row.sampleId;
        const desc = sanitize_filename_segment(sample_label) || 'sample';
        const ts = get_download_filename_datetime(snap.capturedAt);
        const filename = `snapshot_${desc}_${ts}.zip`;
        const blob = await fetch_authenticated_blob(
            get_audit_snapshot_download_url(audit_id, snap.snapshotId)
        );
        trigger_browser_blob_download(blob, filename);
    };

    const handle_delete_row = (row: SnapshotTableRow, delete_button: HTMLElement) => {
        const audit_id = deps.getState()?.auditId;
        if (!audit_id) return;
        const sample_label = row.sampleDescription || row.sampleId;
        const run_delete = async () => {
            try {
                await delete_audit_snapshots_for_sample(String(audit_id), row.sampleId);
                live_region.textContent = t('audit_snapshots_deleted', { sample: sample_label });
                await refresh();
            } catch {
                live_region.textContent = t('audit_snapshots_delete_error');
            }
        };
        show_confirm_delete_modal({
            warning_text: t('audit_snapshots_delete_confirm', { sample: sample_label }),
            delete_button,
            on_confirm: () => {
                void run_delete();
            },
            yes_label: t('delete'),
            no_label: t('audit_snapshots_delete_cancel_label'),
        });
    };

    const columns = build_audit_snapshots_table_columns(
        { Helpers: helpers, Translation: deps.Translation, t },
        { on_download: handle_download_row, on_delete: handle_delete_row },
        format_datetime
    );

    const render_items = (items: AuditSnapshotListItem[]) => {
        const ready_count = items.filter((item) => item.currentReady).length;
        const table_rows = map_snapshot_items_to_table_rows(items);

        for (const node of content_host.querySelectorAll(
            '.audit-actions-snapshots__download-all-wrap, .audit-actions-snapshots__processing-note'
        )) {
            node.remove();
        }

        table_component.render({
            root: table_host,
            columns,
            data: table_rows,
            emptyMessage: t('audit_snapshots_empty'),
            ariaLabel: t('audit_actions_snapshots_title'),
            wrapperClassName: 'generic-table-wrapper audit-actions-snapshots__table-wrapper',
            tableClassName: 'generic-table generic-table--audit-list',
            sortState: sort_state,
            onSort: (column_index: number, direction: 'asc' | 'desc') => {
                sort_state.columnIndex = column_index;
                sort_state.direction = direction;
                render_items(items);
            },
            t,
            getRowId: (row: SnapshotTableRow) => row.rowId,
        });

        if (ready_count > 0) {
            const download_all_parts = create_file_download_button({
                Helpers: helpers as never,
                t,
                label: t('audit_snapshots_download_all'),
                extra_class_names: ['audit-actions-snapshots__download-all'],
                on_download: async () => {
                    const audit_id = String(deps.getState()?.auditId);
                    const url = get_audit_snapshots_download_all_url(audit_id);
                    const blob = await fetch_authenticated_blob(url);
                    if (blob.size > FILE_DOWNLOAD_MAX_BYTES) {
                        throw new Error(t('audit_snapshots_download_all_too_large'));
                    }
                    const filename = `snapshots_all_${get_download_filename_datetime(null)}.zip`;
                    trigger_browser_blob_download(blob, filename);
                },
            });
            download_all_parts.wrapper.classList.add('audit-actions-snapshots__download-all-wrap');
            content_host.appendChild(download_all_parts.wrapper);
        }

        if (
            items.some(
                (item) =>
                    item.pendingAttempt &&
                    ['queued', 'capturing', 'packaging'].includes(item.pendingAttempt.status)
            )
        ) {
            content_host.appendChild(
                helpers.create_element('p', {
                    class_name: 'audit-actions-snapshots__processing-note',
                    text_content: t('audit_snapshots_download_all_partial_note'),
                })
            );
        }
    };

    const refresh = async () => {
        const audit_id = deps.getState()?.auditId;
        if (!audit_id) return;
        try {
            const { items } = await list_audit_snapshots(String(audit_id));
            const json = JSON.stringify(items);
            if (json !== last_items_json) {
                const prev_ready = last_items_json;
                last_items_json = json;
                render_items(items);
                if (prev_ready) {
                    for (const item of items) {
                        if (item.currentReady && item.pendingAttempt?.status === 'ready') {
                            live_region.textContent = t('audit_snapshots_live_ready', {
                                sample: item.sampleDescription || item.sampleId,
                            });
                        }
                    }
                }
            }
        } catch {
            content_host.innerHTML = '';
            content_host.appendChild(
                helpers.create_element('p', { text_content: t('audit_snapshots_load_error') })
            );
        }
    };

    const audit_id = deps.getState()?.auditId;
    if (audit_id) {
        unsubscribe = subscribe_audit_snapshots((payload) => {
            if (String(payload.auditId) === String(audit_id)) {
                void refresh();
            }
        });
        poll_timer = setInterval(() => {
            void refresh();
        }, 30000);
    }

    void refresh();

    return {
        root,
        destroy: () => {
            table_component.destroy?.();
            if (typeof unsubscribe === 'function') unsubscribe();
            if (poll_timer) clearInterval(poll_timer);
        },
        refresh,
    };
}

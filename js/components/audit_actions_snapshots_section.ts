/**
 * @fileoverview Innehåll för Åtgärder → Snapshots.
 */
import './audit_actions_snapshots.css';
import {
    list_audit_snapshots,
    get_audit_snapshot_download_url,
    get_audit_snapshots_download_all_url,
    type AuditSnapshotListItem,
} from '../api/audit_snapshot_api.js';
import { create_file_download_button } from '../utils/file_download_button_ui.js';
import {
    get_download_filename_datetime,
    sanitize_filename_segment,
    trigger_browser_blob_download,
    is_download_file_too_large_error,
    format_file_download_max_size_label,
    FILE_DOWNLOAD_MAX_BYTES,
} from '../utils/download_filename_utils.js';
import { get_auth_token } from '../api/client.js';
import { subscribe_audit_snapshots } from '../logic/list_push_service.js';

export type AuditActionsSnapshotsDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        format_iso_to_local_datetime?: (iso: string, lang: string) => string;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string; get_current_language_code?: () => string };
    getState: () => { auditId?: string | null; samples?: Array<{ id: string; description?: string }> };
};

function format_status_label(t: AuditActionsSnapshotsDeps['Translation']['t'], item: AuditSnapshotListItem): string {
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

function format_bytes(size: number | null | undefined, t: AuditActionsSnapshotsDeps['Translation']['t']): string {
    if (size == null || !Number.isFinite(size)) return '—';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} ${t('audit_snapshots_size_kb')}`;
    return `${(size / (1024 * 1024)).toFixed(1)} ${t('audit_snapshots_size_mb')}`;
}

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
    root.append(live_region, content_host);

    let unsubscribe: (() => void) | null = null;
    let poll_timer: ReturnType<typeof setInterval> | null = null;
    let last_items_json = '';

    const format_datetime = (iso: string | null | undefined) => {
        if (!iso) return '—';
        if (helpers.format_iso_to_local_datetime) {
            return helpers.format_iso_to_local_datetime(iso, lang) || iso;
        }
        return iso;
    };

    const render_items = (items: AuditSnapshotListItem[]) => {
        content_host.innerHTML = '';
        const ready_count = items.filter((item) => item.currentReady).length;

        if (items.length === 0 || items.every((item) => !item.currentReady && !item.pendingAttempt)) {
            content_host.appendChild(
                helpers.create_element('p', { text_content: t('audit_snapshots_empty') })
            );
            return;
        }

        const table = helpers.create_element('table', { class_name: 'audit-actions-snapshots__table' });
        const thead = helpers.create_element('thead');
        const head_row = helpers.create_element('tr');
        for (const key of [
            'audit_snapshots_col_sample',
            'audit_snapshots_col_url',
            'audit_snapshots_col_captured',
            'audit_snapshots_col_status',
            'audit_snapshots_col_size',
            'audit_snapshots_col_action',
        ]) {
            head_row.appendChild(
                helpers.create_element('th', { scope: 'col', text_content: t(key) })
            );
        }
        thead.appendChild(head_row);
        table.appendChild(thead);

        const tbody = helpers.create_element('tbody');
        for (const item of items) {
            const row = helpers.create_element('tr');
            const sample_label = item.sampleDescription || item.sampleId;
            row.appendChild(helpers.create_element('td', { text_content: sample_label }));
            row.appendChild(helpers.create_element('td', { text_content: item.requestedUrl || '—' }));

            const captured_at = item.currentReady?.capturedAt ?? null;
            row.appendChild(helpers.create_element('td', { text_content: format_datetime(captured_at) }));

            const status_cell = helpers.create_element('td');
            status_cell.appendChild(helpers.create_element('span', { text_content: format_status_label(t, item) }));
            if (item.pendingAttempt && item.currentReady) {
                status_cell.appendChild(
                    helpers.create_element('p', {
                        class_name: 'audit-actions-snapshots__secondary-status',
                        text_content: t('audit_snapshots_replacement_in_progress', {
                            captured_at: format_datetime(item.currentReady.capturedAt),
                        }),
                    })
                );
            }
            if (item.pendingAttempt?.status === 'failed' && item.pendingAttempt.error) {
                status_cell.appendChild(
                    helpers.create_element('p', {
                        class_name: 'audit-actions-snapshots__error-text',
                        text_content: item.pendingAttempt.error,
                    })
                );
            }
            row.appendChild(status_cell);

            row.appendChild(
                helpers.create_element('td', {
                    text_content: format_bytes(item.currentReady?.sizeBytes ?? null, t),
                })
            );

            const action_cell = helpers.create_element('td');
            if (item.currentReady) {
                const snap = item.currentReady;
                const desc = sanitize_filename_segment(sample_label) || 'sample';
                const ts = get_download_filename_datetime(snap.capturedAt);
                const filename = `snapshot_${desc}_${ts}.zip`;
                const download_parts = create_file_download_button({
                    Helpers: helpers,
                    t,
                    label: t('audit_snapshots_download_one'),
                    aria_label: t('audit_snapshots_download_one_for_sample', { sample: sample_label }),
                    on_download: async () => {
                        const blob = await fetch_authenticated_blob(
                            get_audit_snapshot_download_url(String(deps.getState()?.auditId), snap.snapshotId)
                        );
                        trigger_browser_blob_download(blob, filename);
                    },
                });
                action_cell.appendChild(download_parts.wrapper);
            }
            row.appendChild(action_cell);
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        content_host.appendChild(table);

        if (ready_count > 0) {
            const download_all_parts = create_file_download_button({
                Helpers: helpers,
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
            content_host.appendChild(download_all_parts.wrapper);
        }

        if (items.some((item) => item.pendingAttempt && ['queued', 'capturing', 'packaging'].includes(item.pendingAttempt.status))) {
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
            if (typeof unsubscribe === 'function') unsubscribe();
            if (poll_timer) clearInterval(poll_timer);
        },
        refresh,
    };
}

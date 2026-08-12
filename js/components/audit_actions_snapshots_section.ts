/**
 * @fileoverview Innehåll för Åtgärder → Snapshots.
 */
import './audit_actions_snapshots.css';
import '../components/notification_component.css';
import { mount_inline_message_dom } from '../notifications/notification_renderer.js';
import { GenericTableComponent } from './GenericTableComponent.js';
import {
    list_audit_snapshots,
    get_audit_snapshot_download_url,
    delete_audit_snapshots_for_sample,
    type AuditSnapshotListItem,
} from '../api/audit_snapshot_api.js';
import {
    get_download_filename_datetime,
    sanitize_filename_segment,
    trigger_browser_blob_download,
} from '../utils/download_filename_utils.js';
import { get_auth_token } from '../api/client.js';
import { subscribe_audit_snapshots } from '../logic/list_push_service.js';
import { show_confirm_delete_modal } from '../logic/confirm_delete_modal_logic.js';
import {
    build_audit_snapshots_table_columns,
    map_snapshot_items_to_table_rows,
    resolve_snapshot_sample_label,
    type SnapshotTableRow,
} from '../utils/audit_snapshots_table_columns.js';
import {
    resolve_retake_sample_for_row,
    start_sidrapport_retake_for_sample,
} from '../logic/audit_sidrapport_retake.js';
import { is_sidrapport_retake_busy } from '../utils/sidrapport_retake_button_ui.js';
import { render_audit_snapshots_toolbar } from '../utils/audit_actions_snapshots_toolbar.js';

export type AuditActionsSnapshotsDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        format_iso_to_local_datetime?: (iso: string, lang: string) => string;
        get_icon_svg?: (name: string, classes: string[], size: number) => string;
        add_protocol_if_missing?: (url: string) => string;
        get_external_link_icon_html?: (t: (key: string) => string) => string;
        escape_html?: (text: string) => string;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string; get_current_language_code?: () => string };
    getState: () => {
        auditId?: string | null;
        samples?: Array<{ id: string; description?: string; url?: string; attachedMediaFilenames?: unknown }>;
    };
    router?: (view: string, params?: Record<string, unknown>) => void;
};

const SNAPSHOT_INTRO_ITEM_KEYS = [
    'audit_snapshots_intro_item_screenshot',
    'audit_snapshots_intro_item_html',
    'audit_snapshots_intro_item_network',
    'audit_snapshots_intro_item_console',
    'audit_snapshots_intro_item_accessibility',
    'audit_snapshots_intro_item_metadata',
    'audit_snapshots_intro_item_download_all',
] as const;

function render_snapshots_intro(
    helpers: AuditActionsSnapshotsDeps['Helpers'],
    t: AuditActionsSnapshotsDeps['Translation']['t']
): HTMLElement {
    const wrapper = helpers.create_element('div', { class_name: 'audit-actions-snapshots-intro' });
    wrapper.appendChild(
        helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('audit_snapshots_intro'),
        })
    );
    wrapper.appendChild(
        helpers.create_element('p', {
            class_name: 'audit-actions-snapshots-intro__list-heading',
            text_content: t('audit_snapshots_intro_contents_heading'),
        })
    );
    const list = helpers.create_element('ul', { class_name: 'audit-actions-snapshots-intro__list' });
    for (const key of SNAPSHOT_INTRO_ITEM_KEYS) {
        list.appendChild(helpers.create_element('li', { text_content: t(key) }));
    }
    wrapper.appendChild(list);
    wrapper.appendChild(
        helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('audit_snapshots_intro_footer'),
        })
    );
    return wrapper;
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
        helpers.create_element('h1', { text_content: t('audit_actions_snapshots_title') })
    );
    root.appendChild(render_snapshots_intro(helpers, t));

    const live_region = helpers.create_element('p', {
        class_name: 'visually-hidden',
        attributes: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
    }) as HTMLParagraphElement;

    const content_host = helpers.create_element('div', { class_name: 'audit-actions-snapshots__content' });
    const toolbar_host = helpers.create_element('div', {
        class_name: 'audit-actions-snapshots__toolbar-host',
        attributes: { hidden: 'hidden' },
    });
    const info_host = helpers.create_element('div', { class_name: 'audit-actions-snapshots__info-host' });
    const table_host = helpers.create_element('div', { class_name: 'audit-actions-snapshots__table-host' });
    content_host.appendChild(table_host);
    root.append(live_region, toolbar_host, info_host, content_host);

    const table_component = new GenericTableComponent();
    void table_component.init({ root: table_host, deps: { Helpers: helpers } });

    let unsubscribe: (() => void) | null = null;
    let poll_timer: ReturnType<typeof setInterval> | null = null;
    let last_items_json = '';
    let last_items: AuditSnapshotListItem[] = [];
    const retake_in_flight_sample_ids = new Set<string>();
    let retake_all_in_flight = false;
    const sort_state = { columnIndex: 0, direction: 'asc' as 'asc' | 'desc' };

    const format_datetime = (iso: string | null | undefined) => {
        if (!iso) return '—';
        if (helpers.format_iso_to_local_datetime) {
            return helpers.format_iso_to_local_datetime(iso, lang) || iso;
        }
        return iso;
    };

    const resolve_sample_label = (row: SnapshotTableRow) =>
        resolve_snapshot_sample_label(row, deps.getState()?.samples, t);

    const handle_download_row = async (row: SnapshotTableRow) => {
        const snap = row.currentReady;
        if (!snap) return;
        const audit_id = String(deps.getState()?.auditId);
        const sample_label = resolve_sample_label(row);
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
        const sample_label = resolve_sample_label(row);
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

    const handle_retake_row = async (row: SnapshotTableRow) => {
        const audit_id = deps.getState()?.auditId;
        if (!audit_id) return;
        if (is_sidrapport_retake_busy(row, retake_in_flight_sample_ids)) return;

        const sample = resolve_retake_sample_for_row(row, deps.getState()?.samples);
        if (!sample) {
            live_region.textContent = t('audit_sidrapport_retake_missing_url', {
                sample: resolve_sample_label(row),
            });
            return;
        }

        const sample_label = resolve_sample_label(row);
        retake_in_flight_sample_ids.add(String(row.sampleId));
        render_items(last_items);

        try {
            await start_sidrapport_retake_for_sample(String(audit_id), sample, row.requestedUrl);
            live_region.textContent = t('audit_sidrapport_retake_started', { sample: sample_label });
            await refresh();
        } catch {
            live_region.textContent = t('audit_sidrapport_retake_error');
        } finally {
            retake_in_flight_sample_ids.delete(String(row.sampleId));
            await refresh();
        }
    };

    const columns = build_audit_snapshots_table_columns(
        {
            Helpers: helpers,
            Translation: deps.Translation,
            t,
            getState: deps.getState,
            router: deps.router,
            is_sidrapport_retake_busy: (row) =>
                is_sidrapport_retake_busy(row, retake_in_flight_sample_ids),
        },
        {
            on_download: handle_download_row,
            on_delete: handle_delete_row,
            on_retake: (row) => {
                void handle_retake_row(row);
            },
        },
        format_datetime
    );

    const clear_load_error = () => {
        content_host.querySelector('.audit-actions-snapshots__load-error')?.remove();
        table_host.removeAttribute('hidden');
    };

    const show_load_error = () => {
        toolbar_host.replaceChildren();
        toolbar_host.setAttribute('hidden', 'hidden');
        table_host.setAttribute('hidden', 'hidden');
        if (content_host.querySelector('.audit-actions-snapshots__load-error')) {
            return;
        }
        content_host.insertBefore(
            helpers.create_element('p', {
                class_name: 'audit-actions-snapshots__load-error',
                attributes: { role: 'alert' },
                text_content: t('audit_snapshots_load_error'),
            }),
            table_host
        );
    };

    const render_items = (items: AuditSnapshotListItem[]) => {
        clear_load_error();
        last_items = items;
        const table_rows = map_snapshot_items_to_table_rows(items, deps.getState()?.samples);

        render_audit_snapshots_toolbar(
            toolbar_host,
            {
                Helpers: helpers,
                t,
                getState: deps.getState,
                fetch_authenticated_blob,
                retake_in_flight_sample_ids,
                get_retake_all_in_flight: () => retake_all_in_flight,
                set_retake_all_in_flight: (value) => {
                    retake_all_in_flight = value;
                },
                on_retake_all_complete: (message_key, opts) => {
                    live_region.textContent = t(message_key, opts);
                },
                on_refresh: refresh,
            },
            items
        );

        info_host.replaceChildren();

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

        if (
            items.some(
                (item) =>
                    item.pendingAttempt &&
                    ['queued', 'capturing', 'packaging'].includes(item.pendingAttempt.status)
            )
        ) {
            const info_el = helpers.create_element('div');
            mount_inline_message_dom(info_el, t('audit_snapshots_download_all_partial_note'), 'warning');
            info_host.appendChild(info_el);
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
                                sample: resolve_snapshot_sample_label(
                                    item,
                                    deps.getState()?.samples,
                                    t
                                ),
                            });
                        }
                    }
                }
            }
        } catch {
            show_load_error();
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

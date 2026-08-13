/**
 * @fileoverview Vy för bulkimport av granskningsdelar från URL-lista.
 */
import './bulk_sample_url_import_view_component.css';
import { resolve_sample_vocab } from '../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { parse_bulk_url_list } from '../logic/bulk_url_import_parse.js';
import {
    run_bulk_url_capture_phase,
    save_bulk_import_rows,
    type BulkImportPreparedRow,
} from '../logic/bulk_sample_url_import_orchestrator.js';
import { subscribe_audit_snapshots } from '../logic/list_push_service.js';

type BulkViewDeps = {
    router: (view: string, params?: Record<string, unknown>) => void;
    getState: () => Record<string, unknown>;
    dispatch: (action: { type: string; payload?: unknown }) => void;
    StoreActionTypes: Record<string, string>;
    Translation: { t: (key: string, params?: Record<string, unknown>) => string };
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        generate_uuid_v4: () => string;
        add_protocol_if_missing?: (url: string) => string;
        escape_html?: (text: string) => string;
    };
    NotificationComponent?: { show_global_message: (msg: string, type: string) => void };
};

export class BulkSampleUrlImportViewComponent {
    root: HTMLElement | null = null;
    deps: BulkViewDeps | null = null;
    plate_element_ref: HTMLElement | null = null;
    rows: BulkImportPreparedRow[] = [];
    selected_category_id = '';
    abort_controller: AbortController | null = null;
    unsubscribe_snapshots: (() => void) | null = null;
    progress_live_region: HTMLElement | null = null;

    init({ root, deps }: { root: HTMLElement; deps: BulkViewDeps }) {
        this.root = root;
        this.deps = deps;
        this.unsubscribe_snapshots = subscribe_audit_snapshots((payload) => {
            const state = deps.getState();
            if (payload.auditId && String(state.auditId) !== String(payload.auditId)) return;
            if (payload.status === 'ready') {
                this.render();
            }
        });
    }

    destroy() {
        this.abort_controller?.abort();
        this.unsubscribe_snapshots?.();
        this.root = null;
        this.deps = null;
        this.plate_element_ref = null;
        this.rows = [];
    }

    get_url_categories(): Array<{ id: string; label: string }> {
        const metadata = (this.deps?.getState()?.ruleFileContent as { metadata?: unknown } | undefined)?.metadata;
        const vocab = resolve_sample_vocab(metadata);
        return (vocab.sampleCategories || [])
            .filter((cat) => Boolean((cat as { hasUrl?: boolean }).hasUrl))
            .map((cat) => ({
                id: String((cat as { id?: string }).id || ''),
                label: String((cat as { text?: string }).text || (cat as { id?: string }).id || ''),
            }))
            .filter((cat) => cat.id);
    }

    wait_for_snapshot_ready(audit_id: string, capture_id: string, timeout_ms: number): Promise<boolean> {
        return new Promise((resolve) => {
            const started = Date.now();
            const timer = window.setInterval(() => {
                if (Date.now() - started > timeout_ms) {
                    window.clearInterval(timer);
                    resolve(false);
                }
            }, timeout_ms);
            const unsub = subscribe_audit_snapshots((payload) => {
                if (String(payload.auditId) !== String(audit_id)) return;
                if (String(payload.snapshotId) !== String(capture_id)) return;
                if (payload.status === 'ready' || payload.status === 'failed') {
                    window.clearInterval(timer);
                    unsub();
                    resolve(payload.status === 'ready');
                }
            });
        });
    }

    async handle_fetch_click() {
        if (!this.deps) return;
        const t = this.deps.Translation.t;
        if (!this.selected_category_id) {
            this.deps.NotificationComponent?.show_global_message(t('bulk_url_import_choose_category'), 'warning');
            return;
        }
        const textarea = this.plate_element_ref?.querySelector('#bulk-url-list-textarea') as HTMLTextAreaElement | null;
        const parsed = parse_bulk_url_list(textarea?.value || '', this.deps.Helpers.add_protocol_if_missing);
        const valid = parsed.filter((row) => row.normalized_url);
        if (valid.length === 0) {
            this.deps.NotificationComponent?.show_global_message(t('bulk_url_import_no_valid_urls'), 'warning');
            return;
        }

        this.abort_controller?.abort();
        this.abort_controller = new AbortController();
        this.rows = valid.map((row) => ({
            row_id: this.deps!.Helpers.generate_uuid_v4(),
            url: row.normalized_url!,
            status: 'waiting',
            error_message: null,
            page_title: null,
            screenshot_filename: null,
            sample_id: null,
            capture_id: null,
            suggested_sample_type_id: null,
            suggested_sample_type_confidence: 0,
            detected_content_type_ids: [],
            selected_content_type_ids: [],
            include_in_save: true,
        }));
        this.render();

        await run_bulk_url_capture_phase(
            {
                getState: this.deps.getState,
                dispatch: this.deps.dispatch,
                StoreActionTypes: this.deps.StoreActionTypes,
                generate_uuid: this.deps.Helpers.generate_uuid_v4,
                add_protocol_if_missing: this.deps.Helpers.add_protocol_if_missing,
                on_row_updated: (row) => {
                    const index = this.rows.findIndex((r) => r.row_id === row.row_id);
                    if (index >= 0) this.rows[index] = row;
                    this.render_rows_only();
                },
                wait_for_snapshot_ready: this.wait_for_snapshot_ready.bind(this),
                signal: this.abort_controller.signal,
            },
            this.rows,
            this.selected_category_id
        );
        this.render();
    }

    async handle_save_click() {
        if (!this.deps || !this.selected_category_id) return;
        await save_bulk_import_rows(
            {
                getState: this.deps.getState,
                dispatch: this.deps.dispatch,
                StoreActionTypes: this.deps.StoreActionTypes,
                generate_uuid: this.deps.Helpers.generate_uuid_v4,
                on_row_updated: (row) => {
                    const index = this.rows.findIndex((r) => r.row_id === row.row_id);
                    if (index >= 0) this.rows[index] = row;
                    this.render_rows_only();
                },
                wait_for_snapshot_ready: this.wait_for_snapshot_ready.bind(this),
            },
            this.rows,
            this.selected_category_id
        );
        this.deps.NotificationComponent?.show_global_message(
            this.deps.Translation.t('bulk_url_import_save_done'),
            'success'
        );
        this.deps.router('sample_management');
    }

    render_rows_only() {
        const tbody = this.plate_element_ref?.querySelector('.bulk-url-import-table tbody');
        if (!tbody || !this.deps) return;
        tbody.innerHTML = '';
        for (const row of this.rows) {
            tbody.appendChild(this.build_row_element(row));
        }
    }

    build_row_element(row: BulkImportPreparedRow): HTMLTableRowElement {
        const t = this.deps!.Translation.t;
        const tr = this.deps!.Helpers.create_element('tr') as HTMLTableRowElement;
        const status_key = `bulk_url_import_status_${row.status}`;
        tr.appendChild(this.deps!.Helpers.create_element('td', { text_content: row.url }));
        tr.appendChild(this.deps!.Helpers.create_element('td', { text_content: row.page_title || '—' }));
        tr.appendChild(this.deps!.Helpers.create_element('td', { text_content: t(status_key) }));
        if (row.error_message) {
            tr.appendChild(this.deps!.Helpers.create_element('td', { text_content: row.error_message }));
        }
        return tr;
    }

    render() {
        if (!this.root || !this.deps) return;
        const t = this.deps.Translation.t;
        const categories = this.get_url_categories();
        if (!this.selected_category_id && categories[0]) {
            this.selected_category_id = categories[0].id;
        }

        if (!this.plate_element_ref || !this.root.contains(this.plate_element_ref)) {
            this.root.innerHTML = '';
            this.plate_element_ref = this.deps.Helpers.create_element('div', {
                class_name: 'content-plate bulk-url-import-plate',
            });
            this.root.appendChild(this.plate_element_ref);
        }
        const plate = this.plate_element_ref;
        plate!.innerHTML = '';

        plate!.appendChild(this.deps.Helpers.create_element('h1', { text_content: t('bulk_url_import_title') }));
        plate!.appendChild(this.deps.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('bulk_url_import_intro'),
        }));

        const category_fieldset = this.deps.Helpers.create_element('fieldset', {
            class_name: 'bulk-url-import-category-fieldset',
        });
        category_fieldset.appendChild(this.deps.Helpers.create_element('legend', {
            text_content: t('bulk_url_import_category_legend'),
        }));
        for (const cat of categories) {
            const label = this.deps.Helpers.create_element('label', { class_name: 'bulk-url-import-category-label' });
            const radio = this.deps.Helpers.create_element('input', {
                attributes: { type: 'radio', name: 'bulkSampleCategory', value: cat.id },
            }) as HTMLInputElement;
            radio.checked = cat.id === this.selected_category_id;
            radio.addEventListener('change', () => {
                if (radio.checked) this.selected_category_id = cat.id;
            });
            label.appendChild(radio);
            label.appendChild(document.createTextNode(` ${cat.label}`));
            category_fieldset.appendChild(label);
        }
        plate!.appendChild(category_fieldset);

        const url_label = this.deps.Helpers.create_element('label', {
            attributes: { for: 'bulk-url-list-textarea' },
            text_content: t('bulk_url_import_urls_label'),
        });
        plate!.appendChild(url_label);
        const textarea = this.deps.Helpers.create_element('textarea', {
            class_name: ['form-control', 'bulk-url-import-textarea'],
            attributes: { id: 'bulk-url-list-textarea', rows: '8' },
        }) as HTMLTextAreaElement;
        plate!.appendChild(textarea);

        this.progress_live_region = this.deps.Helpers.create_element('p', {
            class_name: 'bulk-url-import-progress',
            attributes: { role: 'status', 'aria-live': 'polite' },
            text_content: this.rows.length ? t('bulk_url_import_progress', { count: this.rows.length }) : '',
        });
        plate!.appendChild(this.progress_live_region);

        const actions = this.deps.Helpers.create_element('div', { class_name: 'bulk-url-import-actions' });
        const fetch_btn = this.deps.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            text_content: t('bulk_url_import_fetch_button'),
        });
        fetch_btn.addEventListener('click', () => void this.handle_fetch_click());
        actions.appendChild(fetch_btn);

        if (this.rows.some((r) => r.status !== 'waiting' && r.status !== 'fetching')) {
            const save_btn = this.deps.Helpers.create_element('button', {
                class_name: ['button', 'button-success'],
                attributes: { type: 'button' },
                text_content: t('bulk_url_import_save_button'),
            });
            save_btn.addEventListener('click', () => void this.handle_save_click());
            actions.appendChild(save_btn);
        }

        const back_btn = this.deps.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            text_content: t('bulk_url_import_back_button'),
        });
        back_btn.addEventListener('click', () => this.deps!.router('sample_management'));
        actions.appendChild(back_btn);
        plate!.appendChild(actions);

        if (this.rows.length > 0) {
            const table = this.deps.Helpers.create_element('table', {
                class_name: ['table', 'bulk-url-import-table'],
            });
            const thead = this.deps.Helpers.create_element('thead');
            const head_row = this.deps.Helpers.create_element('tr');
            for (const key of ['bulk_url_import_col_url', 'bulk_url_import_col_title', 'bulk_url_import_col_status']) {
                head_row.appendChild(this.deps.Helpers.create_element('th', { text_content: t(key) }));
            }
            thead.appendChild(head_row);
            table.appendChild(thead);
            const tbody = this.deps.Helpers.create_element('tbody');
            for (const row of this.rows) {
                tbody.appendChild(this.build_row_element(row));
            }
            table.appendChild(tbody);
            plate!.appendChild(table);
        }
    }
}

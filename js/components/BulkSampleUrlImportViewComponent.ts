/**
 * @fileoverview Vy för bulkimport av granskningsdelar från URL-lista.
 */
import './bulk_sample_url_import_view_component.css';
import { parse_bulk_url_list } from '../logic/bulk_url_import_parse.js';
import { resolve_default_url_sample_category_id } from '../logic/bulk_url_import_category.js';
import { show_bulk_url_import_modal } from './bulk_url_import_modal.js';
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
    start_button_ref: HTMLButtonElement | null = null;

    init({ root, deps }: { root: HTMLElement; deps: BulkViewDeps }) {
        this.root = root;
        this.deps = deps;
    }

    destroy() {
        this.root = null;
        this.deps = null;
        this.plate_element_ref = null;
        this.start_button_ref = null;
    }

    get_sample_category_id(): string | null {
        const metadata = (this.deps?.getState()?.ruleFileContent as { metadata?: unknown } | undefined)?.metadata;
        return resolve_default_url_sample_category_id(metadata);
    }

    wait_for_snapshot_ready(audit_id: string, capture_id: string, timeout_ms: number): Promise<boolean> {
        return new Promise((resolve) => {
            const timer = window.setTimeout(() => {
                unsub();
                resolve(false);
            }, timeout_ms);
            const unsub = subscribe_audit_snapshots((payload) => {
                if (String(payload.auditId) !== String(audit_id)) return;
                if (String(payload.snapshotId) !== String(capture_id)) return;
                if (payload.status === 'ready' || payload.status === 'failed') {
                    window.clearTimeout(timer);
                    unsub();
                    resolve(payload.status === 'ready');
                }
            });
        });
    }

    handle_start_click() {
        if (!this.deps) return;
        const t = this.deps.Translation.t;
        const sample_category_id = this.get_sample_category_id();
        if (!sample_category_id) {
            this.deps.NotificationComponent?.show_global_message(t('bulk_url_import_no_url_category'), 'warning');
            return;
        }

        const textarea = this.plate_element_ref?.querySelector('#bulk-url-list-textarea') as HTMLTextAreaElement | null;
        const parsed = parse_bulk_url_list(textarea?.value || '', this.deps.Helpers.add_protocol_if_missing);
        const urls = parsed.filter((row) => row.normalized_url).map((row) => row.normalized_url!);
        if (urls.length === 0) {
            this.deps.NotificationComponent?.show_global_message(t('bulk_url_import_no_valid_urls'), 'warning');
            return;
        }

        show_bulk_url_import_modal(
            {
                getState: this.deps.getState,
                dispatch: this.deps.dispatch,
                StoreActionTypes: this.deps.StoreActionTypes,
                Helpers: this.deps.Helpers,
                t,
                sample_category_id,
                wait_for_snapshot_ready: this.wait_for_snapshot_ready.bind(this),
                on_complete: () => {
                    this.deps?.NotificationComponent?.show_global_message(
                        t('bulk_url_import_save_done'),
                        'success'
                    );
                    this.deps?.router('sample_management');
                },
            },
            urls,
            this.start_button_ref
        );
    }

    render() {
        if (!this.root || !this.deps) return;
        const t = this.deps.Translation.t;

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

        const actions = this.deps.Helpers.create_element('div', { class_name: 'bulk-url-import-actions' });
        const start_btn = this.deps.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            text_content: t('bulk_url_import_start_button'),
        }) as HTMLButtonElement;
        start_btn.addEventListener('click', () => this.handle_start_click());
        this.start_button_ref = start_btn;
        actions.appendChild(start_btn);

        const back_btn = this.deps.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            text_content: t('bulk_url_import_back_button'),
        });
        back_btn.addEventListener('click', () => this.deps!.router('sample_management'));
        actions.appendChild(back_btn);
        plate!.appendChild(actions);
    }
}

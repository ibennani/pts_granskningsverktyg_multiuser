/**
 * Startsida med lista över granskningar (när den används som egen vykomponent).
 */

import { check_api_available, get_audits } from '../api/client.js';
import './start_view_component.css';
import { GenericTableComponent } from './GenericTableComponent.js';
import { create_audit_table_columns } from '../utils/audit_table_columns.js';
import { open_audit_by_id, download_audit_by_id } from '../logic/audit_open_logic.js';
import { subscribe_audits } from '../logic/list_push_service.js';

const GV_AUDITS_LIST_CACHE_KEY = 'gv_audits_list_cache_v1';

/** Rad från GET /audits (index) — kan sakna fält beroende på API-version. */
type AuditIndexRow = {
    id?: string;
    status?: string;
    updated_at?: string | null;
    metadata?: Record<string, unknown>;
    version?: number | null;
    progress?: number | null;
    deficiency_index?: number | null;
};

function read_cached_audits_list(): AuditIndexRow[] | null {
    try {
        const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(GV_AUDITS_LIST_CACHE_KEY) : null;
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { audits?: unknown };
        return Array.isArray(parsed?.audits) ? (parsed.audits as AuditIndexRow[]) : null;
    } catch {
        return null;
    }
}

function write_cached_audits_list(audits: AuditIndexRow[]) {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(GV_AUDITS_LIST_CACHE_KEY, JSON.stringify({ audits: audits || [] }));
        }
    } catch {
        /* ignorera quota m.m. */
    }
}

const START_VIEW_SECTION_COUNT = 4;

type StartViewDeps = {
    router: (view: string, params?: Record<string, string>) => void;
    dispatch: (...args: unknown[]) => void;
    StoreActionTypes: Record<string, string>;
    Translation: { t: (key: string, replacements?: Record<string, string | number>) => string };
    Helpers: Record<string, unknown> & {
        create_element?: (...args: unknown[]) => HTMLElement;
        load_css_safely?: (
            path: string,
            name: string,
            opts?: { timeout?: number; maxRetries?: number }
        ) => Promise<unknown>;
    };
    NotificationComponent?: {
        show_global_message?: (msg: string, level: string) => void;
        clear_global_message?: () => void;
    };
    SaveAuditLogic?: unknown;
    ValidationLogic?: unknown;
};

export class StartViewComponent {
    static CSS_PATH = './start_view_component.css';

    root: HTMLElement | null;

    deps: StartViewDeps | null;

    router: StartViewDeps['router'] | null;

    dispatch: StartViewDeps['dispatch'] | null;

    StoreActionTypes: StartViewDeps['StoreActionTypes'] | null;

    Translation: StartViewDeps['Translation'] | null;

    Helpers: StartViewDeps['Helpers'] | null;

    NotificationComponent: StartViewDeps['NotificationComponent'] | null;

    SaveAuditLogic: unknown;

    ValidationLogic: unknown;

    audits: AuditIndexRow[];

    api_available: boolean;

    _api_checked: boolean;

    _unsubscribe_audits: (() => void) | null;

    _genericTables: GenericTableComponent[];

    _startTableSortState: { columnIndex: number; direction: 'asc' | 'desc' } | undefined;

    constructor() {
        this.root = null;
        this.deps = null;
        this.router = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.SaveAuditLogic = null;
        this.ValidationLogic = null;
        this.audits = [];
        this.api_available = false;
        this._api_checked = false;
        this._unsubscribe_audits = null;
        this._genericTables = [];
        this._startTableSortState = undefined;
    }

    async init({ root, deps }: { root: HTMLElement; deps: StartViewDeps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent ?? null;
        const w = typeof window !== 'undefined' ? (window as Window & { SaveAuditLogic?: unknown }) : null;
        this.SaveAuditLogic = deps.SaveAuditLogic ?? w?.SaveAuditLogic;
        this.ValidationLogic = deps.ValidationLogic ?? (w as Window & { ValidationLogic?: unknown })?.ValidationLogic;

        this.audits = [];
        this.api_available = false;
        this._api_checked = false;
        this._unsubscribe_audits = null;

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(StartViewComponent.CSS_PATH, 'StartViewComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {});
        }

        this._genericTables = [];
        for (let i = 0; i < START_VIEW_SECTION_COUNT; i++) {
            const tbl = new GenericTableComponent();
            await tbl.init({ root: this.root, deps });
            this._genericTables.push(tbl);
        }
    }

    _audit_fingerprint(a: AuditIndexRow | null | undefined): string {
        return JSON.stringify({
            id: a?.id,
            status: a?.status,
            updated_at: a?.updated_at,
            version: a?.version ?? null,
            progress: a?.progress ?? null,
            deficiency_index: a?.deficiency_index ?? null,
            metadata: a?.metadata
        });
    }

    _section_index_for_audit(audit: AuditIndexRow | null | undefined): number {
        const s = audit?.status;
        if (s === 'in_progress') return 0;
        if (s === 'not_started') return 1;
        if (s === 'locked') return 2;
        if (s === 'archived') return 3;
        return 1;
    }

    async _on_audits_changed() {
        if (!this.root || !this.api_available) return;
        try {
            const fresh = (await get_audits()) as AuditIndexRow[];
            const old_ids = (this.audits || []).map((x) => x.id);
            const new_ids = (fresh || []).map((x) => x.id);
            const same_length = old_ids.length === new_ids.length;
            const same_order = same_length && old_ids.every((id, i) => id === new_ids[i]);
            const same_sections =
                same_length &&
                (this.audits || []).every((a, i) => {
                    const b = fresh[i];
                    return b && this._section_index_for_audit(a) === this._section_index_for_audit(b);
                });
            if (!same_order || !same_sections) {
                this.audits = fresh;
                if (this.root) this.render();
                return;
            }
            const changed: AuditIndexRow[] = [];
            for (let i = 0; i < fresh.length; i++) {
                if (this._audit_fingerprint(this.audits[i]) !== this._audit_fingerprint(fresh[i])) {
                    changed.push(fresh[i]);
                }
            }
            this.audits = fresh;
            if (changed.length === 0) return;
            for (const audit of changed) {
                if (audit.id === undefined || audit.id === null) continue;
                const section_index = this._section_index_for_audit(audit);
                const table = this._genericTables[section_index];
                if (table && typeof table.updateRow === 'function') {
                    table.updateRow(audit.id, audit);
                }
            }
        } catch {
            if (this.root) this.render();
        }
    }

    get_t_func(): (key: string, replacements?: Record<string, string | number>) => string {
        return this.Translation && typeof this.Translation.t === 'function'
            ? this.Translation.t.bind(this.Translation)
            : (key: string) => `**${key}**`;
    }

    get_status_label(status: string): string {
        const t = this.get_t_func();
        const map: Record<string, string> = {
            not_started: t('audit_status_not_started'),
            in_progress: t('audit_status_in_progress'),
            locked: t('audit_status_locked'),
            archived: t('audit_status_archived')
        };
        return map[status] || status;
    }

    async handle_download_audit(audit_id: string | number) {
        const t = this.get_t_func();
        await download_audit_by_id({
            audit_id,
            ValidationLogic: this.ValidationLogic as object,
            SaveAuditLogic: this.SaveAuditLogic as object,
            NotificationComponent: this.NotificationComponent as object | undefined,
            t
        });
    }

    async handle_open_audit(audit_id: string | number) {
        const t = this.get_t_func();
        if (!this.dispatch || !this.StoreActionTypes || !this.router) return;
        await open_audit_by_id({
            audit_id,
            dispatch: this.dispatch,
            StoreActionTypes: this.StoreActionTypes,
            ValidationLogic: this.ValidationLogic as object,
            router: this.router,
            NotificationComponent: this.NotificationComponent as object | undefined,
            t
        });
    }

    async ensure_api_data(force = false) {
        if (this._api_checked && !force) return;
        if (force) this._api_checked = false;
        this._api_checked = true;
        this.api_available = await check_api_available();
        if (this.api_available) {
            try {
                this.audits = (await get_audits()) as AuditIndexRow[];
                write_cached_audits_list(this.audits);
            } catch {
                const cached = read_cached_audits_list();
                if (cached) {
                    this.audits = cached;
                    this.api_available = true;
                } else {
                    this.audits = [];
                }
            }
        } else {
            const cached = read_cached_audits_list();
            if (cached) {
                this.audits = cached;
                this.api_available = true;
            }
        }
    }

    render() {
        const root = this.root;
        const Helpers = this.Helpers;
        const create_el = Helpers?.create_element;
        if (!root || typeof create_el !== 'function') return;

        if (!this._api_checked) {
            void this.ensure_api_data().then(() => {
                if (this.root) this.render();
            });
        }

        root.innerHTML = '';
        const t = this.get_t_func();

        const plate = create_el('div', { class_name: 'content-plate start-view-plate' }) as HTMLElement;

        const h1 = create_el('h1', {
            id: 'main-content-heading',
            text_content: t('start_view_h1'),
            attributes: { tabindex: '-1' }
        });

        const intro = create_el('p', {
            class_name: 'start-view-intro',
            text_content: t('start_view_intro')
        });

        plate.appendChild(h1);
        plate.appendChild(intro);

        if (!this._api_checked) {
            const loading = create_el('p', {
                class_name: 'start-view-loading',
                text_content: t('audit_loading')
            });
            plate.appendChild(loading);
        } else if (!this.api_available) {
            const no_api = create_el('p', {
                class_name: 'start-view-no-api',
                text_content: t('audit_api_unavailable')
            });
            plate.appendChild(no_api);
        } else {
            const sort_audits = (list: AuditIndexRow[]) =>
                [...list].sort((a, b) => {
                    const ca = (a.metadata?.caseNumber ?? '').toString().trim();
                    const cb = (b.metadata?.caseNumber ?? '').toString().trim();
                    if (!ca && !cb) return 0;
                    if (!ca) return 1;
                    if (!cb) return -1;
                    return ca.localeCompare(cb, undefined, { numeric: true });
                });
            const in_progress = this.audits.filter((a) => a.status === 'in_progress');
            const not_started = this.audits.filter((a) => a.status === 'not_started');
            const locked = this.audits.filter((a) => a.status === 'locked');
            const archived = this.audits.filter((a) => a.status === 'archived');

            const section_configs = [
                { heading_key: 'start_view_audits_heading', audits: sort_audits(in_progress), empty_key: 'start_view_no_audits' },
                { heading_key: 'start_view_new_audits_heading', audits: sort_audits(not_started), empty_key: 'start_view_no_new_audits' },
                { heading_key: 'start_view_completed_audits_heading', audits: sort_audits(locked), empty_key: 'start_view_no_completed_audits' },
                { heading_key: 'start_view_archived_audits_heading', audits: sort_audits(archived), empty_key: 'start_view_no_archived_audits' }
            ];

            const table_deps = {
                t: this.get_t_func(),
                Helpers: this.Helpers,
                Translation: this.Translation,
                get_status_label: this.get_status_label.bind(this)
            };
            const table_handlers = {
                onOpenAudit: (id: string | number) => {
                    void this.handle_open_audit(id);
                },
                onDownloadAudit: (id: string | number) => {
                    void this.handle_download_audit(id);
                }
            };
            const audit_columns = create_audit_table_columns(table_deps, table_handlers, { includeDelete: false });

            section_configs.forEach((config, index) => {
                const section = create_el('section', {
                    class_name:
                        index === 0 ? 'start-view-audits-section' : 'start-view-audits-section start-view-audits-section-following'
                });
                const heading_title = t(config.heading_key);
                const section_heading_text = t('start_view_section_heading_with_count', {
                    title: heading_title,
                    count: (config.audits || []).length
                });
                const is_new_audits_section = config.heading_key === 'start_view_new_audits_heading';
                if (is_new_audits_section) {
                    const heading_row = create_el('div', { class_name: 'start-view-section-heading-row' });
                    const section_heading = create_el('h2', {
                        text_content: section_heading_text,
                        attributes: { id: `${config.heading_key}-heading` }
                    });
                    const start_new_btn = create_el('button', {
                        class_name: ['button', 'button-primary', 'audit-start-new-audit-btn'],
                        text_content: t('start_new_audit'),
                        attributes: {
                            type: 'button',
                            'aria-label': t('start_new_audit')
                        }
                    });
                    if (this.router) {
                        start_new_btn.addEventListener('click', () => this.router!('audit_audits', { startNew: '1' }));
                    }
                    heading_row.appendChild(section_heading);
                    heading_row.appendChild(start_new_btn);
                    section.appendChild(heading_row);
                } else {
                    const section_heading = create_el('h2', {
                        text_content: section_heading_text,
                        attributes: { id: `${config.heading_key}-heading` }
                    });
                    section.appendChild(section_heading);
                }

                const table_wrapper = create_el('div');
                this._startTableSortState = this._startTableSortState ?? { columnIndex: 0, direction: 'asc' };
                const table_instance = this._genericTables[index];
                table_instance.render({
                    root: table_wrapper,
                    columns: audit_columns,
                    data: config.audits,
                    emptyMessage: t(config.empty_key),
                    ariaLabel: section_heading_text,
                    wrapperClassName: 'generic-table-wrapper',
                    tableClassName: 'generic-table generic-table--audit-list',
                    sortState: this._startTableSortState,
                    onSort: (columnIndex: number, direction: 'asc' | 'desc') => {
                        this._startTableSortState = { columnIndex, direction };
                        this.render();
                    },
                    t: this.Translation!.t.bind(this.Translation),
                    getRowId: (row: AuditIndexRow) => String(row?.id ?? '')
                });
                section.appendChild(table_wrapper);
                plate.appendChild(section);
            });
        }

        root.appendChild(plate);

        if (this._api_checked && this.api_available && !this._unsubscribe_audits) {
            this._unsubscribe_audits = subscribe_audits(() => {
                void this._on_audits_changed();
            });
        }
    }

    destroy() {
        if (typeof this._unsubscribe_audits === 'function') {
            this._unsubscribe_audits();
            this._unsubscribe_audits = null;
        }
        for (const tbl of this._genericTables || []) {
            tbl?.destroy?.();
        }
        this._genericTables = [];
        this.root = null;
        this.deps = null;
    }
}

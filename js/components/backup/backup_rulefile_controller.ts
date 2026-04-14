import { GenericTableComponent } from '../GenericTableComponent.js';
import { get_rulefile_backup_history, get_rulefile_backup_overview } from '../../api/client.js';
import { build_rulefile_history_columns, build_rulefile_table_columns, download_rulefile_snapshot_json, type RulefileBackupHistoryRow } from './backup_rulefile_tables';

export type RulefileKind = 'all' | 'published' | 'working';

export class BackupRulefileController {
    root: HTMLElement | null = null;
    deps: any = null;
    router: any = null;
    Helpers: any = null;
    Translation: any = null;
    NotificationComponent: any = null;
    t: any = null;

    view_name: string | null = null;
    params: any = null;

    rulefile_overview: any[] = [];
    filtered_rulefiles: any[] = [];
    selected_rule_set_id: string | null = null;
    selected_rulefile_history: RulefileBackupHistoryRow[] = [];

    filter_text = '';
    rulefile_kind: RulefileKind = 'all';
    sort_state: { columnIndex: number; direction: 'asc' | 'desc' } = { columnIndex: 0, direction: 'asc' };
    _overview_table: any;
    _detail_table: any;
    _data_loaded = false;

    constructor() {
        this._overview_table = new GenericTableComponent();
        this._detail_table = new GenericTableComponent();
    }

    async init({ root, deps }: { root: HTMLElement; deps: any }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this.NotificationComponent = deps.NotificationComponent;
        this.view_name = deps.view_name;
        this.params = deps.params || {};
        this.t = (this.Translation && typeof this.Translation.t === 'function') ? this.Translation.t : ((k: string) => `**${k}**`);

        this.selected_rule_set_id = this.view_name === 'backup_rulefile_detail' ? (this.params.ruleSetId || null) : null;
        this._data_loaded = false;

        await this._overview_table.init({ deps });
        await this._detail_table.init({ deps });
    }

    destroy() {
        this._overview_table?.destroy?.();
        this._detail_table?.destroy?.();
        this.root = null;
        this.deps = null;
        this.router = null;
        this.Helpers = null;
        this.Translation = null;
        this.NotificationComponent = null;
        this.t = null;
        this.rulefile_overview = [];
        this.filtered_rulefiles = [];
        this.selected_rulefile_history = [];
    }

    async load_data(force = false) {
        if (this._data_loaded && !force) return;
        this._data_loaded = true;

        const overview = await get_rulefile_backup_overview().catch(() => []);
        this.rulefile_overview = Array.isArray(overview) ? overview : [];

        if (this.view_name === 'backup_rulefile_detail' && this.selected_rule_set_id) {
            const items = await get_rulefile_backup_history(this.selected_rule_set_id).catch(() => []);
            this.selected_rulefile_history = Array.isArray(items) ? items : [];
        }

        this.apply_filters();
    }

    apply_filters() {
        const text = (this.filter_text || '').toLowerCase();
        const kind = this.rulefile_kind;
        const items = this.rulefile_overview || [];
        this.filtered_rulefiles = items.filter((item) => {
            if (kind === 'published' && !item.has_published_in_any_snapshot) return false;
            if (kind === 'working' && !item.has_working_in_any_snapshot) return false;
            if (!text) return true;
            const haystack = [item.name || '', item.ruleSetId || ''].join(' ').toLowerCase();
            return haystack.includes(text);
        });
    }

    handle_show_history(rule_set_id: string) {
        if (!rule_set_id) return;
        if (typeof this.router === 'function') this.router('backup_rulefile_detail', { ruleSetId: rule_set_id });
    }

    async handle_download(row: RulefileBackupHistoryRow) {
        try {
            await download_rulefile_snapshot_json(row);
        } catch (err: any) {
            this.NotificationComponent?.show_global_message?.(err?.message || this.t('backup_detail_load_error'), 'error');
        }
    }

    render_rulefiles_overview({ root }: { root: HTMLElement }) {
        const columns = build_rulefile_table_columns({
            Helpers: this.Helpers,
            Translation: this.Translation,
            t: this.t,
            on_show_history: (id) => this.handle_show_history(id)
        });
        this._overview_table.render({
            root,
            columns,
            data: this.filtered_rulefiles || [],
            emptyMessage: this.t('backup_rulefile_overview_empty'),
            ariaLabel: this.t('backup_rulefile_overview_aria_label'),
            wrapperClassName: 'generic-table-wrapper',
            tableClassName: 'generic-table generic-table--backup-overview',
            sortState: this.sort_state,
            onSort: (columnIndex: number, direction: 'asc' | 'desc') => {
                this.sort_state = { columnIndex, direction };
                const refresh = this.deps?.backup_overview_refresh_table;
                if (typeof refresh === 'function') refresh();
            },
            t: this.t
        });
    }

    render_rulefile_detail({ root }: { root: HTMLElement }) {
        const cols = build_rulefile_history_columns({
            Helpers: this.Helpers,
            Translation: this.Translation,
            t: this.t,
            on_download: (row) => this.handle_download(row)
        });
        this._detail_table.render({
            root,
            columns: cols,
            data: this.selected_rulefile_history || [],
            emptyMessage: this.t('backup_rulefile_detail_empty'),
            ariaLabel: this.t('backup_rulefile_detail_aria_label'),
            wrapperClassName: 'generic-table-wrapper',
            tableClassName: 'generic-table generic-table--backup-detail',
            sortState: { columnIndex: 0, direction: 'desc' },
            onSort: () => {},
            t: this.t
        });
    }

    render() {
        // Inget här – render sker av huvudkomponenten beroende på view_name.
    }
}


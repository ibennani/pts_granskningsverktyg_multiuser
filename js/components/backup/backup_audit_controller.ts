import { GenericTableComponent } from '../GenericTableComponent.js';
import {
    api_get,
    get_backup_overview,
    get_backups_for_audit,
    run_backup_now,
    get_backup_settings,
    get_audit_version,
    update_audit,
    import_audit,
    get_base_url,
    get_auth_headers
} from '../../api/client.js';
import { app_runtime_refs } from '../../utils/app_runtime_refs.js';
import { build_audit_detail_columns, build_audit_overview_columns, download_audit_backup_json } from './backup_audit_tables';

export class BackupAuditController {
    root: HTMLElement | null = null;
    deps: any = null;
    router: any = null;
    Helpers: any = null;
    Translation: any = null;
    NotificationComponent: any = null;
    t: any = null;

    view_name: string | null = null;
    params: any = null;

    backup_overview: any[] = [];
    filtered_overview: any[] = [];
    backup_status: any = null;
    backup_settings: any = null;
    selected_audit_id: string | null = null;
    selected_audit_backups: any[] = [];
    filter_text = '';
    status_filter = 'all';
    _run_backup_in_progress = false;
    sort_state: { columnIndex: number; direction: 'asc' | 'desc' } = { columnIndex: 0, direction: 'asc' };
    audit_detail_sort_state: { columnIndex: number; direction: 'asc' | 'desc' } = { columnIndex: 0, direction: 'desc' };
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
        this.selected_audit_id = this.view_name === 'backup_detail' ? (this.params.auditId || null) : null;
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
        this.backup_overview = [];
        this.filtered_overview = [];
        this.selected_audit_backups = [];
    }

    get_status_label(status: string) {
        const map: Record<string, string> = {
            not_started: this.t('audit_status_not_started'),
            in_progress: this.t('audit_status_in_progress'),
            locked: this.t('audit_status_locked'),
            archived: this.t('audit_status_archived'),
            deleted: this.t('backup_status_deleted')
        };
        return map[status] || status || '';
    }

    _get_next_backup_run() {
        const cron = this.backup_settings?.schedule_cron;
        if (!cron || typeof cron !== 'string') return null;
        const parts = cron.trim().split(/\s+/);
        if (parts.length < 2) return null;
        const hours_str = parts[1];
        const hours = hours_str
            .split(',')
            .map((h: string) => parseInt(h, 10))
            .filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 23)
            .sort((a: number, b: number) => a - b);
        if (hours.length === 0) return null;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        for (const h of hours) {
            const run_at = new Date(today.getTime());
            run_at.setHours(h, 0, 0, 0);
            if (run_at > now) return run_at;
        }
        const tomorrow = new Date(today.getTime());
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(hours[0], 0, 0, 0);
        return tomorrow;
    }

    build_status_box_paragraphs() {
        if (!this.Helpers?.create_element) return [];
        const lang = this.Translation?.get_current_language_code?.() || 'sv-SE';

        if (!this.backup_status) {
            return [this.Helpers.create_element('p', { text_content: this.t('backup_status_unknown') })];
        }

        const last_run_raw = this.backup_status.last_run || this.backup_status.timestamp || null;
        const last_run_str = last_run_raw && this.Helpers?.format_iso_to_local_datetime
            ? this.Helpers.format_iso_to_local_datetime(last_run_raw, lang)
            : null;
        const last_p = this.Helpers.create_element('p', {
            text_content: last_run_str
                ? this.t('backup_status_last_run', {
                    datetime: last_run_str,
                    audits: this.backup_status.audits_processed ?? 0,
                    files: this.backup_status.new_files ?? 0
                })
                : this.t('backup_status_no_runs')
        });

        const out = [last_p];
        const next_run = this._get_next_backup_run();
        if (next_run) {
            const next_run_str = this.Helpers?.format_iso_to_local_datetime
                ? this.Helpers.format_iso_to_local_datetime(next_run.toISOString(), lang)
                : next_run.toLocaleString(lang);
            out.push(this.Helpers.create_element('p', {
                text_content: this.t('backup_status_next_run', { datetime: next_run_str })
            }));
        }
        return out;
    }

    async load_data(force = false) {
        if (this._data_loaded && !force) return;
        this._data_loaded = true;

        const [overview, status, settings] = await Promise.all([
            get_backup_overview().catch(() => []),
            api_get('/backup/status').catch(() => null),
            get_backup_settings().catch(() => null)
        ]);
        this.backup_overview = Array.isArray(overview) ? overview : [];
        this.backup_status = status && status.ok ? status : null;
        this.backup_settings = settings && (settings.schedule_cron || (settings.runs_per_day !== null && settings.runs_per_day !== undefined)) ? settings : null;

        if (this.view_name === 'backup_detail' && this.selected_audit_id) {
            const items = await get_backups_for_audit(this.selected_audit_id).catch(() => []);
            this.selected_audit_backups = Array.isArray(items) ? items : [];
        }

        this.apply_filters();
    }

    apply_filters() {
        const text = (this.filter_text || '').toLowerCase();
        const status_filter = this.status_filter;
        const items = this.backup_overview || [];
        this.filtered_overview = items.filter((item) => {
            if (status_filter !== 'all' && item.status && item.status !== status_filter) return false;
            if (!text) return true;
            const haystack = [item.caseNumber || '', item.actorName || '', item.auditId || ''].join(' ').toLowerCase();
            return haystack.includes(text);
        });
    }

    handle_show_backups(audit_id: string) {
        if (!audit_id) return;
        if (typeof this.router === 'function') this.router('backup_detail', { auditId: audit_id });
    }

    handle_go_to_audit(audit_id: string) {
        if (!audit_id) return;
        if (typeof this.router === 'function') this.router('audit_overview', { auditId: audit_id });
    }

    async handle_run_backup() {
        if (this._run_backup_in_progress) return;
        this._run_backup_in_progress = true;
        const request_full = this.deps?.backup_overview_request_full_render;
        if (typeof request_full === 'function') request_full();
        try {
            await run_backup_now();
            this._data_loaded = false;
            await this.load_data(true);
            this.NotificationComponent?.show_global_message?.(this.t('backup_run_success'), 'success');
        } catch (err: any) {
            this.NotificationComponent?.show_global_message?.(this.t('backup_run_error') || err?.message, 'error');
        } finally {
            this._run_backup_in_progress = false;
            if (typeof request_full === 'function') request_full();
        }
    }

    async handle_download(audit_id: string, filename: string) {
        try {
            await download_audit_backup_json({ audit_id, filename });
        } catch (err: any) {
            this.NotificationComponent?.show_global_message?.(err?.message || this.t('backup_detail_load_error'), 'error');
        }
    }

    async handle_restore(audit_id: string, row: any) {
        if (!audit_id || !row?.filename) return;
        const ModalComponent: any = (app_runtime_refs as any).modal_component;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;

        ModalComponent.show(
            { h1_text: this.t('backup_restore_modal_overwrite_title'), message_text: this.t('backup_restore_modal_overwrite_intro') },
            (container: HTMLElement, modal: any) => {
                const actions = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const restore_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-success'],
                    text_content: this.t('backup_restore_modal_confirm_load'),
                    attributes: { type: 'button' }
                });
                const keep_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-secondary'],
                    text_content: this.t('backup_restore_modal_keep_current'),
                    attributes: { type: 'button' }
                });
                keep_btn.addEventListener('click', () => modal.close());
                restore_btn.addEventListener('click', async () => {
                    modal.close();
                    await this._do_restore(audit_id, row.filename);
                });
                actions.appendChild(restore_btn);
                actions.appendChild(keep_btn);
                container.appendChild(actions);
            }
        );
    }

    async _do_restore(audit_id: string, filename: string) {
        const base = get_base_url();
        const backup_url = `${base}/backup/files/${encodeURIComponent(audit_id)}/${encodeURIComponent(filename)}`;
        let backup_data: any = null;
        try {
            const res = await fetch(backup_url, { cache: 'no-store', headers: get_auth_headers() });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
            backup_data = await res.json();
        } catch (err: any) {
            this.NotificationComponent?.show_global_message?.(this.t('backup_restore_error') || err?.message, 'error');
            return;
        }

        // Om granskningen är raderad på servern: importera som ny.
        const overview_row = this.backup_overview.find((r) => r.auditId === audit_id) || null;
        const is_deleted = overview_row?.status === 'deleted';
        if (is_deleted) {
            try {
                await import_audit({
                    ruleFileContent: backup_data.ruleFileContent,
                    auditMetadata: backup_data.auditMetadata,
                    samples: backup_data.samples || [],
                    auditStatus: backup_data.auditStatus || 'not_started',
                    archivedRequirementResults: backup_data.archivedRequirementResults || [],
                    lastRulefileUpdateLog: backup_data.lastRulefileUpdateLog || null
                });
                this.NotificationComponent?.show_global_message?.(this.t('backup_restore_success'), 'success');
                this._data_loaded = false;
                await this.load_data(true);
            } catch (err: any) {
                this.NotificationComponent?.show_global_message?.(this.t('backup_restore_error') || err?.message, 'error');
            }
            return;
        }

        // Annars: skriv över befintlig.
        let current_audit_version: number | null = null;
        try {
            const ver = await get_audit_version(audit_id);
            if (ver?.version !== null && ver?.version !== undefined) current_audit_version = Number(ver.version);
        } catch (_) {}
        if (current_audit_version === null || !Number.isFinite(current_audit_version)) {
            this.NotificationComponent?.show_global_message?.(this.t('backup_restore_error'), 'error');
            return;
        }
        try {
            await update_audit(audit_id, {
                metadata: backup_data.auditMetadata || {},
                status: backup_data.auditStatus || 'not_started',
                samples: backup_data.samples || [],
                ruleFileContent: backup_data.ruleFileContent,
                archivedRequirementResults: backup_data.archivedRequirementResults || [],
                lastRulefileUpdateLog: backup_data.lastRulefileUpdateLog ?? null,
                expectedVersion: current_audit_version
            });
            this.NotificationComponent?.show_global_message?.(this.t('backup_restore_success'), 'success');
            this._data_loaded = false;
            await this.load_data(true);
        } catch (err: any) {
            this.NotificationComponent?.show_global_message?.(this.t('backup_restore_error') || err?.message, 'error');
        }
    }

    render_audits_overview({ root }: { root: HTMLElement }) {
        const columns = build_audit_overview_columns({
            Helpers: this.Helpers,
            Translation: this.Translation,
            t: this.t,
            get_status_label: (s) => this.get_status_label(s),
            on_show_backups: (id) => this.handle_show_backups(id),
            on_go_to_audit: (id) => this.handle_go_to_audit(id)
        });
        this._overview_table.render({
            root,
            columns,
            data: this.filtered_overview || [],
            emptyMessage: this.t('backup_overview_empty'),
            ariaLabel: this.t('backup_overview_aria_label'),
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

    render_audit_detail({ root }: { root: HTMLElement }) {
        const overview_row = this.backup_overview.find((r) => r.auditId === this.selected_audit_id) || null;
        const cols = build_audit_detail_columns({
            Helpers: this.Helpers,
            Translation: this.Translation,
            t: this.t,
            get_status_label: (s) => this.get_status_label(s),
            overview_row,
            on_restore: (row) => this.handle_restore(String(this.selected_audit_id || ''), row),
            on_download: (fname) => this.handle_download(String(this.selected_audit_id || ''), fname)
        });
        this._detail_table.render({
            root,
            columns: cols,
            data: this.selected_audit_backups || [],
            emptyMessage: this.t('backup_detail_empty'),
            ariaLabel: this.t('backup_detail_aria_label'),
            wrapperClassName: 'generic-table-wrapper',
            tableClassName: 'generic-table generic-table--backup-detail',
            sortState: this.audit_detail_sort_state,
            onSort: (columnIndex: number, direction: 'asc' | 'desc') => {
                this.audit_detail_sort_state = { columnIndex, direction };
                const refresh = this.deps?.backup_detail_table_refresh;
                if (typeof refresh === 'function') refresh();
            },
            t: this.t
        });
    }

    render() {}
}


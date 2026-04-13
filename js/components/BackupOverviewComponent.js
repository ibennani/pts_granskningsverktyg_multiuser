// js/components/BackupOverviewComponent.js

import { get_backup_overview, get_backups_for_audit, run_backup_now, get_backup_settings, api_get, get_base_url, get_auth_headers, get_audit_version, update_audit, import_audit } from '../api/client.js';
import { GenericTableComponent } from './GenericTableComponent.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import './backup_overview_component.css';

export class BackupOverviewComponent {
    constructor() {
        this.CSS_PATH = './backup_overview_component.css';
        this.root = null;
        this.deps = null;
        this.router = null;
        this.view_name = null;
        this.params = null;
        this.Helpers = null;
        this.Translation = null;
        this.NotificationComponent = null;
        this.backup_overview = [];
        this.filtered_overview = [];
        this.backup_status = null;
        this.backup_settings = null;
        this.selected_audit_id = null;
        this.selected_audit_backups = [];
        this.filter_text = '';
        this.status_filter = 'all';
        this._run_backup_in_progress = false;
        this.sort_state_overview = { columnIndex: 0, direction: 'asc' };
        this._overview_table = null;
        this._detail_table = null;
        this._overview_table_root = null;
        this._status_last_run_p = null;
        this._status_next_run_p = null;
        this._run_backup_btn_ref = null;
        this._data_loaded = false;
    }

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.view_name = deps.view_name;
        this.params = deps.params || {};
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this.NotificationComponent = deps.NotificationComponent;

        this.backup_overview = [];
        this.filtered_overview = [];
        this.backup_status = null;
        this.backup_settings = null;
        this.selected_audit_id = this.view_name === 'backup_detail'
            ? (this.params.auditId || null)
            : null;
        this.selected_audit_backups = [];
        this.filter_text = '';
        this.status_filter = 'all';
        this._run_backup_in_progress = false;
        this.sort_state_overview = { columnIndex: 0, direction: 'asc' };

        this._overview_table = new GenericTableComponent();
        this._detail_table = new GenericTableComponent();
        await this._overview_table.init({ deps });
        await this._detail_table.init({ deps });

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'BackupOverviewComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {});
        }

        this._handle_filter_input = this._handle_filter_input.bind(this);
        this._handle_status_change = this._handle_status_change.bind(this);
        this._handle_show_backups = this._handle_show_backups.bind(this);
        this._handle_back_to_list = this._handle_back_to_list.bind(this);
        this._handle_run_backup = this._handle_run_backup.bind(this);
        this._handle_open_backup_settings = this._handle_open_backup_settings.bind(this);
        this._handle_download_backup = this._handle_download_backup.bind(this);
        this._handle_restore_backup = this._handle_restore_backup.bind(this);

        this._data_loaded = false;
    }

    destroy() {
        this._overview_table?.destroy?.();
        this._detail_table?.destroy?.();
        this._overview_table_root = null;
        this._status_last_run_p = null;
        this._status_next_run_p = null;
        this._run_backup_btn_ref = null;
        this.root = null;
        this.deps = null;
        this.router = null;
        this.Helpers = null;
        this.Translation = null;
        this.NotificationComponent = null;
        this.backup_overview = [];
        this.filtered_overview = [];
        this.selected_audit_backups = [];
    }

    get_t_func() {
        return (this.Translation && typeof this.Translation.t === 'function')
            ? this.Translation.t
            : (key) => `**${key}**`;
    }

    get_status_label(status) {
        const t = this.get_t_func();
        const map = {
            not_started: t('audit_status_not_started'),
            in_progress: t('audit_status_in_progress'),
            locked: t('audit_status_locked'),
            archived: t('audit_status_archived'),
            deleted: t('backup_status_deleted')
        };
        return map[status] || status || '';
    }

    /**
     * Beräknar nästa planerade körningstid från schedule_cron (t.ex. "0 0,6,12,18 * * *").
     * Returnerar Date eller null.
     */
    _get_next_backup_run() {
        const cron = this.backup_settings?.schedule_cron;
        if (!cron || typeof cron !== 'string') return null;
        const parts = cron.trim().split(/\s+/);
        if (parts.length < 2) return null;
        const hoursStr = parts[1];
        const hours = hoursStr.split(',').map((h) => parseInt(h, 10)).filter((n) => !Number.isNaN(n) && n >= 0 && n <= 23);
        if (hours.length === 0) return null;
        hours.sort((a, b) => a - b);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        for (let i = 0; i < hours.length; i++) {
            const runAt = new Date(today.getTime());
            runAt.setHours(hours[i], 0, 0, 0);
            if (runAt > now) return runAt;
        }
        const tomorrow = new Date(today.getTime());
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(hours[0], 0, 0, 0);
        return tomorrow;
    }

    /**
     * Uppdaterar endast texten i statusrutan (senaste och nästa körning) utan att rendera om hela vyn.
     * Anropas t.ex. när en manuell backup just slutförts.
     */
    _update_status_box_text() {
        const t = this.get_t_func();
        const lang = this.Translation?.get_current_language_code?.() || 'sv-SE';
        if (this._status_last_run_p && document.contains(this._status_last_run_p)) {
            if (!this.backup_status) {
                this._status_last_run_p.textContent = t('backup_status_unknown');
            } else {
                const last_run = this.backup_status.last_run || this.backup_status.timestamp || null;
                const last_run_str = last_run && this.Helpers?.format_iso_to_local_datetime
                    ? this.Helpers.format_iso_to_local_datetime(last_run, lang)
                    : null;
                this._status_last_run_p.textContent = last_run_str
                    ? t('backup_status_last_run', {
                        datetime: last_run_str,
                        audits: this.backup_status.audits_processed ?? 0,
                        files: this.backup_status.new_files ?? 0
                    })
                    : t('backup_status_no_runs');
            }
        }
        if (this._status_next_run_p && document.contains(this._status_next_run_p)) {
            const next_run = this.view_name === 'backup' ? this._get_next_backup_run() : null;
            if (next_run) {
                const next_run_str = this.Helpers?.format_iso_to_local_datetime
                    ? this.Helpers.format_iso_to_local_datetime(next_run.toISOString(), lang)
                    : next_run.toLocaleString(lang);
                this._status_next_run_p.textContent = t('backup_status_next_run', { datetime: next_run_str });
            }
        }
        if (this._run_backup_btn_ref && document.contains(this._run_backup_btn_ref)) {
            const label_el = this._run_backup_btn_ref.querySelector('.backup-btn-label');
            if (label_el) label_el.textContent = t('backup_run_now_button');
            this._run_backup_btn_ref.removeAttribute('aria-busy');
        }
    }

    async _load_data(force = false) {
        if (this._data_loaded && !force) return;
        this._data_loaded = true;
        try {
            const [overview, status, settings] = await Promise.all([
                get_backup_overview(),
                api_get('/backup/status').catch(() => null),
                get_backup_settings().catch(() => null)
            ]);
            this.backup_overview = Array.isArray(overview) ? overview : [];
            this.backup_status = status && status.ok ? status : null;
            this.backup_settings = settings && (settings.schedule_cron || (settings.runs_per_day !== null && settings.runs_per_day !== undefined)) ? settings : null;
            this._apply_filters();

            if (this.view_name === 'backup_detail' && this.selected_audit_id) {
                try {
                    const items = await get_backups_for_audit(this.selected_audit_id);
                    this.selected_audit_backups = Array.isArray(items) ? items : [];
                } catch (err) {
                    this.selected_audit_backups = [];
                    if (this.NotificationComponent?.show_global_message) {
                        const t = this.get_t_func();
                        this.NotificationComponent.show_global_message(
                            t('backup_detail_load_error') || err.message,
                            'error'
                        );
                    }
                }
            }
        } catch (err) {
            if (this.NotificationComponent?.show_global_message) {
                const t = this.get_t_func();
                this.NotificationComponent.show_global_message(
                    t('backup_overview_load_error') || err.message,
                    'error'
                );
            }
            this.backup_overview = [];
            this.filtered_overview = [];
        }
    }

    _apply_filters() {
        const text = (this.filter_text || '').toLowerCase();
        const status_filter = this.status_filter;
        const items = this.backup_overview || [];
        this.filtered_overview = items.filter((item) => {
            if (status_filter !== 'all' && item.status && item.status !== status_filter) {
                return false;
            }
            if (!text) return true;
            const haystack = [
                item.caseNumber || '',
                item.actorName || '',
                item.auditId || ''
            ].join(' ').toLowerCase();
            return haystack.includes(text);
        });
    }

    _handle_filter_input(event) {
        this.filter_text = event.target.value || '';
        this._apply_filters();
        this._render_overview_table_only();
    }

    _handle_status_change(event) {
        this.status_filter = event.target.value || 'all';
        this._apply_filters();
        this._render_overview_table_only();
    }

    _render_overview_table_only() {
        if (this.view_name !== 'backup' || !this._overview_table_root || !this.Helpers?.create_element) return;
        const t = this.get_t_func();
        const overview_columns = this._build_overview_columns(t);
        this._overview_table.render({
            root: this._overview_table_root,
            columns: overview_columns,
            data: this.filtered_overview || [],
            emptyMessage: t('backup_overview_empty'),
            ariaLabel: t('backup_overview_aria_label'),
            wrapperClassName: 'generic-table-wrapper',
            tableClassName: 'generic-table generic-table--backup-overview',
            sortState: this.sort_state_overview,
            onSort: (col_index, direction) => {
                this.sort_state_overview = { columnIndex: col_index, direction };
                if (this.root) this.render();
            },
            t
        });
    }

    async _handle_show_backups(audit_id) {
        if (!audit_id) return;
        if (typeof this.router === 'function') {
            this.router('backup_detail', { auditId: audit_id });
            return;
        }
        // Fallback om router saknas: visa inline-detaljvy
        this.selected_audit_id = audit_id;
        this.selected_audit_backups = [];
        try {
            const items = await get_backups_for_audit(audit_id);
            this.selected_audit_backups = Array.isArray(items) ? items : [];
        } catch (err) {
            this.selected_audit_backups = [];
            if (this.NotificationComponent?.show_global_message) {
                const t = this.get_t_func();
                this.NotificationComponent.show_global_message(
                    t('backup_detail_load_error') || err.message,
                    'error'
                );
            }
        }
        if (this.root) this.render();
    }

    _handle_back_to_list() {
        if (typeof this.router === 'function') {
            this.router('backup', {});
            return;
        }
        this.selected_audit_id = null;
        this.selected_audit_backups = [];
        if (this.root) this.render();
    }

    async _handle_run_backup() {
        const t = this.get_t_func();
        if (this._run_backup_in_progress) return;
        this._run_backup_in_progress = true;
        if (this.root) this.render();
        try {
            const result = await run_backup_now();
            this.backup_status = result && result.ok ? result : null;
            this._data_loaded = false;
            await this._load_data(true);
            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(
                    t('backup_run_success') || 'Backup genomförd',
                    'success'
                );
            }
        } catch (err) {
            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(
                    t('backup_run_error') || err.message,
                    'error'
                );
            }
        } finally {
            this._run_backup_in_progress = false;
            this._update_status_box_text();
        }
    }

    async _handle_download_backup(event, audit_id, filename) {
        if (event) event.preventDefault();
        if (!audit_id || !filename) return;
        const base = get_base_url();
        const url = `${base}/backup/files/${encodeURIComponent(audit_id)}/${encodeURIComponent(filename)}`;
        try {
            const res = await fetch(url, { cache: 'no-store', headers: get_auth_headers() });
            if (!res.ok) {
                const t = this.get_t_func();
                const msg = (await res.json().catch(() => ({}))).error || res.statusText;
                if (this.NotificationComponent?.show_global_message) {
                    this.NotificationComponent.show_global_message(msg || t('backup_detail_load_error'), 'error');
                }
                return;
            }
            const blob = await res.blob();
            const object_url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = object_url;
            a.download = filename;
            a.setAttribute('aria-hidden', 'true');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(object_url);
        } catch (err) {
            if (this.NotificationComponent?.show_global_message) {
                const t = this.get_t_func();
                this.NotificationComponent.show_global_message(t('backup_detail_load_error') || err.message, 'error');
            }
        }
    }

    async _handle_restore_backup(event, row) {
        if (event) event.preventDefault();
        const audit_id = this.selected_audit_id;
        if (!audit_id || !row?.filename) return;
        const t = this.get_t_func();
        const Helpers = this.Helpers;
        const lang = this.Translation?.get_current_language_code?.() || 'sv-SE';
        const format_datetime = (iso) => {
            if (!iso || !Helpers?.format_iso_to_local_datetime) return '';
            return Helpers.format_iso_to_local_datetime(iso, lang);
        };
        const base = get_base_url();
        const backup_url = `${base}/backup/files/${encodeURIComponent(audit_id)}/${encodeURIComponent(row.filename)}`;
        let backup_data;
        try {
            const res = await fetch(backup_url, { cache: 'no-store', headers: get_auth_headers() });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
            backup_data = await res.json();
        } catch (err) {
            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(t('backup_restore_error') || err.message, 'error');
            }
            return;
        }
        const overview_row = this.backup_overview.find((r) => r.auditId === audit_id) || null;
        const is_deleted = overview_row?.status === 'deleted';
        const ModalComponent = app_runtime_refs.modal_component;
        if (!ModalComponent?.show || !Helpers?.create_element) return;

        if (is_deleted) {
            const backup_datetime_str = format_datetime(row.createdAt) || row.createdAt || '—';
            ModalComponent.show(
                {
                    h1_text: t('backup_restore_modal_deleted_title'),
                    message_text: ''
                },
                (container, modal) => {
                    const intro = Helpers.create_element('p', { text_content: t('backup_restore_modal_deleted_intro') });
                    container.appendChild(intro);
                    const ul = Helpers.create_element('ul');
                    const li = Helpers.create_element('li', { text_content: t('backup_restore_modal_deleted_from', { datetime: backup_datetime_str }) });
                    ul.appendChild(li);
                    container.appendChild(ul);
                    const actions = Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                    const restore_btn = Helpers.create_element('button', {
                        class_name: ['button', 'button-success'],
                        text_content: t('backup_restore_modal_restore_btn'),
                        attributes: { type: 'button' }
                    });
                    restore_btn.addEventListener('click', async () => {
                        modal.close();
                        try {
                            await import_audit({
                                ruleFileContent: backup_data.ruleFileContent,
                                auditMetadata: backup_data.auditMetadata,
                                samples: backup_data.samples || [],
                                auditStatus: backup_data.auditStatus || 'not_started',
                                archivedRequirementResults: backup_data.archivedRequirementResults || [],
                                lastRulefileUpdateLog: backup_data.lastRulefileUpdateLog || null
                            });
                            if (this.NotificationComponent?.show_global_message) {
                                this.NotificationComponent.show_global_message(t('backup_restore_success'), 'success');
                            }
                            this._data_loaded = false;
                            await this._load_data(true);
                            if (this.root) this.render();
                        } catch (err) {
                            if (this.NotificationComponent?.show_global_message) {
                                this.NotificationComponent.show_global_message(t('backup_restore_error') || err.message, 'error');
                            }
                        }
                    });
                    const close_btn = Helpers.create_element('button', {
                        class_name: ['button', 'button-secondary'],
                        text_content: t('backup_restore_modal_close'),
                        attributes: { type: 'button' }
                    });
                    close_btn.addEventListener('click', () => modal.close());
                    actions.appendChild(restore_btn);
                    actions.appendChild(close_btn);
                    container.appendChild(actions);
                }
            );
            return;
        }

        let current_updated_at = null;
        let current_audit_version = null;
        try {
            const ver = await get_audit_version(audit_id);
            current_updated_at = ver?.updated_at || null;
            if (ver?.version !== null && ver?.version !== undefined) {
                current_audit_version = Number(ver.version);
            }
        } catch (_) {
            // ignoreras medvetet
        }
        const backup_datetime_str = format_datetime(row.createdAt) || row.createdAt || '—';
        const current_datetime_str = current_updated_at ? format_datetime(current_updated_at) : '—';
        const actor_name = overview_row?.actorName ?? backup_data?.auditMetadata?.actorName ?? '—';

        ModalComponent.show(
            {
                h1_text: t('backup_restore_modal_overwrite_title'),
                message_text: ''
            },
            (container, modal) => {
                const intro = Helpers.create_element('p');
                intro.appendChild(document.createTextNode(t('backup_restore_modal_overwrite_intro') + ' '));
                intro.appendChild(Helpers.create_element('br'));
                const actor_label = Helpers.create_element('strong', { text_content: t('backup_restore_modal_actor_label') });
                intro.appendChild(actor_label);
                intro.appendChild(document.createTextNode(' ' + actor_name + '.'));
                container.appendChild(intro);
                const ul = Helpers.create_element('ul', { class_name: 'backup-restore-modal-list' });
                const li_load = Helpers.create_element('li');
                li_load.appendChild(Helpers.create_element('strong', { text_content: t('backup_restore_modal_loading_from_label') }));
                li_load.appendChild(document.createTextNode(' ' + backup_datetime_str));
                const li_current = Helpers.create_element('li');
                li_current.appendChild(Helpers.create_element('strong', { text_content: t('backup_restore_modal_current_overwrite_label') }));
                li_current.appendChild(document.createTextNode(' ' + current_datetime_str));
                ul.appendChild(li_load);
                ul.appendChild(li_current);
                container.appendChild(ul);
                const actions = Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const load_btn = Helpers.create_element('button', {
                    class_name: ['button', 'button-success'],
                    text_content: t('backup_restore_modal_confirm_load'),
                    attributes: { type: 'button' }
                });
                load_btn.addEventListener('click', async () => {
                    modal.close();
                    try {
                        if (current_audit_version === null || !Number.isFinite(current_audit_version)) {
                            if (this.NotificationComponent?.show_global_message) {
                                this.NotificationComponent.show_global_message(t('backup_restore_error'), 'error');
                            }
                            return;
                        }
                        await update_audit(audit_id, {
                            metadata: backup_data.auditMetadata || {},
                            status: backup_data.auditStatus || 'not_started',
                            samples: backup_data.samples || [],
                            ruleFileContent: backup_data.ruleFileContent,
                            archivedRequirementResults: backup_data.archivedRequirementResults || [],
                            lastRulefileUpdateLog: backup_data.lastRulefileUpdateLog ?? null,
                            expectedVersion: current_audit_version
                        });
                        if (this.NotificationComponent?.show_global_message) {
                            this.NotificationComponent.show_global_message(t('backup_restore_success'), 'success');
                        }
                        this._data_loaded = false;
                        await this._load_data(true);
                        if (this.root) this.render();
                    } catch (err) {
                        if (this.NotificationComponent?.show_global_message) {
                            this.NotificationComponent.show_global_message(t('backup_restore_error') || err.message, 'error');
                        }
                    }
                });
                const keep_btn = Helpers.create_element('button', {
                    class_name: ['button', 'button-secondary'],
                    text_content: t('backup_restore_modal_keep_current'),
                    attributes: { type: 'button' }
                });
                keep_btn.addEventListener('click', () => modal.close());
                actions.appendChild(load_btn);
                actions.appendChild(keep_btn);
                container.appendChild(actions);
            }
        );
    }

    _handle_open_backup_settings() {
        if (typeof this.router === 'function') {
            this.router('backup_settings', {});
        }
    }

    _build_overview_columns(t) {
        const Helpers = this.Helpers;
        const lang = this.Translation?.get_current_language_code?.() || 'sv-SE';
        const format_datetime = (iso) => {
            if (!iso || !Helpers?.format_iso_to_local_datetime) return '';
            return Helpers.format_iso_to_local_datetime(iso, lang);
        };

        return [
            {
                headerLabel: t('backup_overview_col_case_number'),
                getSortValue: (row) => (row.caseNumber ?? '').toString().trim(),
                getContent: (row) => (row.caseNumber ?? '').toString().trim() || '—'
            },
            {
                headerLabel: t('backup_overview_col_actor'),
                getSortValue: (row) => (row.actorName ?? '').toString().trim(),
                getContent: (row) => {
                    const raw_actor_name = (row.actorName ?? '').toString().trim();
                    const fallback_name = t('unknown_actor') || '—';
                    const actor_name = raw_actor_name || fallback_name;
                    const is_deleted = row?.status === 'deleted';

                    if (is_deleted) {
                        return Helpers.create_element('span', {
                            text_content: t('backup_actor_display_deleted', { name: actor_name })
                        });
                    }

                    const a = Helpers.create_element('a', {
                        text_content: actor_name,
                        attributes: {
                            href: `#audit_overview?auditId=${row.auditId ?? ''}`,
                            'aria-label': t('backup_overview_link_to_audit_aria', { name: actor_name })
                        }
                    });
                    a.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (row.auditId !== null && row.auditId !== undefined) {
                            this.router('audit_overview', { auditId: row.auditId });
                        }
                    });
                    return a;
                }
            },
            {
                headerLabel: t('backup_overview_col_status'),
                getSortValue: (row) => (row.status ?? '').toString(),
                getContent: (row) => {
                    const label = this.get_status_label(row.status) || '—';
                    if (row.status === 'deleted') {
                        const span = this.Helpers.create_element('span', {
                            class_name: 'backup-status-deleted',
                            text_content: label
                        });
                        return span;
                    }
                    return label;
                }
            },
            {
                headerLabel: t('backup_overview_col_latest_backup'),
                getSortValue: (row) => row.latestBackupAt ? Date.parse(row.latestBackupAt) || 0 : 0,
                getContent: (row) => format_datetime(row.latestBackupAt) || '—'
            },
            {
                headerLabel: t('backup_overview_col_backup_count'),
                getSortValue: (row) => (row.backupCount !== null && row.backupCount !== undefined) ? Number(row.backupCount) : 0,
                getContent: (row) => (row.backupCount !== null && row.backupCount !== undefined ? String(row.backupCount) : '0')
            },
            {
                headerLabel: t('backup_overview_col_actions'),
                isAction: true,
                getContent: (row) => {
                    const actor_name = (row.actorName ?? '').toString().trim()
                        || (row.caseNumber ?? '').toString().trim()
                        || t('unknown_actor');
                    const btn = Helpers.create_element('button', {
                        class_name: ['button', 'button-default', 'button-small'],
                        text_content: t('backup_overview_show_backups_button'),
                        attributes: {
                            type: 'button',
                            'aria-label': t('backup_overview_show_backups_aria', { actorName: actor_name })
                        }
                    });
                    btn.addEventListener('click', () => this._handle_show_backups(row.auditId));
                    return btn;
                }
            }
        ];
    }

    _build_detail_columns(t, overview_row) {
        const Helpers = this.Helpers;
        const lang = this.Translation?.get_current_language_code?.() || 'sv-SE';
        const format_datetime = (iso) => {
            if (!iso || !Helpers?.format_iso_to_local_datetime) return '';
            return Helpers.format_iso_to_local_datetime(iso, lang);
        };

        const format_file_size = (bytes) => {
            if (bytes === null || bytes === undefined || typeof bytes !== 'number') return '—';
            if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
            if (bytes >= 1024) return (bytes / 1024).toFixed(1).replace('.', ',') + ' KB';
            return bytes + ' B';
        };
        const get_summary_text = (row) => {
            const s = row.summarySamples;
            const r = row.summaryRequirements;
            if (s !== null && s !== undefined && r !== null && r !== undefined) return t('backup_detail_summary', { samples: s, requirements: r });
            if (s !== null && s !== undefined) return t('backup_detail_summary_samples_only', { samples: s });
            if (r !== null && r !== undefined) return t('backup_detail_summary_requirements_only', { requirements: r });
            return '—';
        };

        return [
            {
                headerLabel: t('backup_detail_col_datetime'),
                getSortValue: (row) => row.createdAt ? Date.parse(row.createdAt) || 0 : 0,
                getContent: (row) => format_datetime(row.createdAt) || row.createdAt || '—'
            },
            {
                headerLabel: t('backup_detail_col_file_size'),
                getSortValue: (row) => (row.fileSizeBytes !== null && row.fileSizeBytes !== undefined) ? Number(row.fileSizeBytes) : 0,
                getContent: (row) => format_file_size(row.fileSizeBytes)
            },
            {
                headerLabel: t('backup_overview_col_status'),
                getSortValue: () => (overview_row?.status ?? '').toString(),
                getContent: () => this.get_status_label(overview_row?.status) || '—'
            },
            {
                headerLabel: t('backup_detail_col_progress'),
                getSortValue: (row) => (row.progressPercent !== null && row.progressPercent !== undefined) ? Number(row.progressPercent) : -1,
                getContent: (row) => {
                    const audited = row.progressAudited;
                    const total = row.progressTotal;
                    if (audited === null || audited === undefined || total === null || total === undefined || total === 0) return '—';
                    const pct = (100 * audited) / total;
                    const pctStr = pct.toFixed(1).replace('.', ',');
                    return `${audited} / ${total} (${pctStr} %)`;
                }
            },
            {
                headerLabel: t('backup_detail_col_actions'),
                isAction: true,
                getContent: (row) => {
                    const wrapper = Helpers.create_element('div', {
                        class_name: 'backup-detail-actions-cell'
                    });
                    const row_datetime = format_datetime(row.createdAt) || row.createdAt || '—';
                    const row_summary = get_summary_text(row);
                    const restore_aria = t('backup_restore_aria', { datetime: row_datetime, type: row_summary });
                    const download_aria = t('backup_detail_download_aria', { datetime: row_datetime, type: row_summary });
                    const restore_btn = Helpers.create_element('button', {
                        class_name: ['button', 'button-success', 'button-small', 'generic-table-action-cell', 'backup-btn-with-icon'],
                        attributes: {
                            type: 'button',
                            'aria-label': restore_aria
                        }
                    });
                    restore_btn.appendChild(Helpers.create_element('span', { class_name: 'backup-btn-label', text_content: t('backup_restore_button') }));
                    if (Helpers.get_icon_svg) {
                        const icon_span = Helpers.create_element('span', {
                            html_content: Helpers.get_icon_svg('update', ['currentColor'], 18),
                            attributes: { 'aria-hidden': 'true' }
                        });
                        icon_span.classList.add('backup-btn-icon');
                        restore_btn.appendChild(icon_span);
                    }
                    restore_btn.addEventListener('click', (e) => {
                        this._handle_restore_backup(e, row);
                    });
                    const download_a = Helpers.create_element('a', {
                        class_name: ['button', 'button-default', 'button-small', 'generic-table-action-cell', 'backup-btn-with-icon'],
                        attributes: {
                            href: '#',
                            'aria-label': download_aria
                        }
                    });
                    download_a.appendChild(Helpers.create_element('span', { class_name: 'backup-btn-label', text_content: t('backup_detail_download_button') }));
                    if (Helpers.get_icon_svg) {
                        const dl_icon = Helpers.create_element('span', {
                            html_content: Helpers.get_icon_svg('download', ['currentColor'], 18),
                            attributes: { 'aria-hidden': 'true' }
                        });
                        dl_icon.classList.add('backup-btn-icon');
                        download_a.appendChild(dl_icon);
                    }
                    download_a.addEventListener('click', (e) => {
                        this._handle_download_backup(e, this.selected_audit_id, row.filename);
                    });
                    wrapper.appendChild(restore_btn);
                    wrapper.appendChild(download_a);
                    return wrapper;
                }
            }
        ];
    }

    async render() {
        if (!this.root || !this.Helpers?.create_element) return;

        if (!this._data_loaded) {
            this._load_data().then(() => {
                if (this.root) this.render();
            });
        }

        const t = this.get_t_func();
        this.root.innerHTML = '';
        this._overview_table_root = null;

        const plate = this.Helpers.create_element('div', {
            class_name: 'content-plate backup-view-plate'
        });

        let pending_message_key = null;
        try {
            pending_message_key = sessionStorage.getItem('gv_backup_settings_saved_message');
            if (pending_message_key) sessionStorage.removeItem('gv_backup_settings_saved_message');
        } catch (_) {
            // ignoreras medvetet
        }
        if (pending_message_key && this.view_name === 'backup' && this.NotificationComponent?.show_global_message) {
            this.NotificationComponent.show_global_message(t(pending_message_key), 'success');
        }

        if (this.view_name === 'backup') {
            const h1 = this.Helpers.create_element('h1', {
                id: 'main-content-heading',
                text_content: t('backup_view_h1'),
                attributes: { tabindex: '-1' }
            });

            const intro = this.Helpers.create_element('p', {
                class_name: 'backup-view-intro',
                text_content: t('backup_view_intro')
            });

            plate.appendChild(h1);
            plate.appendChild(intro);
        }

        // Systemstatus-ruta (endast i översiktsvy)
        if (this.view_name === 'backup') {
        const status_box = this.Helpers.create_element('section', {
            class_name: 'backup-status-box'
        });
        const status_heading_row = this.Helpers.create_element('div', {
            class_name: 'backup-status-heading-row'
        });
        const status_heading = this.Helpers.create_element('h2', {
            text_content: t('backup_status_heading')
        });
        const run_backup_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'button-small', 'backup-btn-with-icon'],
            attributes: { type: 'button' }
        });
        const run_text_span = this.Helpers.create_element('span', {
            class_name: 'backup-btn-label',
            text_content: this._run_backup_in_progress ? t('backup_run_in_progress') : t('backup_run_now_button')
        });
        run_backup_btn.appendChild(run_text_span);
        if (this.Helpers.get_icon_svg) {
            const run_icon = this.Helpers.create_element('span', {
                html_content: this.Helpers.get_icon_svg('save', ['currentColor'], 18),
                attributes: { 'aria-hidden': 'true' }
            });
            run_icon.classList.add('backup-btn-icon');
            run_backup_btn.appendChild(run_icon);
        }
        this._run_backup_btn_ref = run_backup_btn;
        if (this._run_backup_in_progress) {
            run_backup_btn.setAttribute('aria-busy', 'true');
        }
        run_backup_btn.addEventListener('click', this._handle_run_backup);
        const heading_and_run = this.Helpers.create_element('div', { class_name: 'backup-status-heading-left' });
        heading_and_run.appendChild(status_heading);
        heading_and_run.appendChild(run_backup_btn);
        const settings_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'button-small', 'backup-btn-with-icon'],
            attributes: { type: 'button', 'aria-label': t('backup_settings_button') }
        });
        settings_btn.appendChild(this.Helpers.create_element('span', {
            class_name: 'backup-btn-label',
            text_content: t('backup_settings_button')
        }));
        if (this.Helpers.get_icon_svg) {
            const set_icon = this.Helpers.create_element('span', {
                html_content: this.Helpers.get_icon_svg('settings', ['currentColor'], 18),
                attributes: { 'aria-hidden': 'true' }
            });
            set_icon.classList.add('backup-btn-icon');
            settings_btn.appendChild(set_icon);
        }
        settings_btn.addEventListener('click', this._handle_open_backup_settings);
        const status_buttons = this.Helpers.create_element('div', { class_name: 'backup-status-heading-buttons' });
        status_buttons.appendChild(settings_btn);
        status_heading_row.appendChild(heading_and_run);
        status_heading_row.appendChild(status_buttons);
        status_box.appendChild(status_heading_row);

        if (!this.backup_status) {
            const p = this.Helpers.create_element('p', {
                text_content: t('backup_status_unknown')
            });
            this._status_last_run_p = p;
            status_box.appendChild(p);
        } else {
            const last_run = this.backup_status.last_run || this.backup_status.timestamp || null;
            const lang = this.Translation?.get_current_language_code?.() || 'sv-SE';
            const last_run_str = last_run && this.Helpers?.format_iso_to_local_datetime
                ? this.Helpers.format_iso_to_local_datetime(last_run, lang)
                : null;

            const p = this.Helpers.create_element('p', {
                text_content: last_run_str
                    ? t('backup_status_last_run', {
                        datetime: last_run_str,
                        audits: this.backup_status.audits_processed ?? 0,
                        files: this.backup_status.new_files ?? 0
                    })
                    : t('backup_status_no_runs')
            });
            this._status_last_run_p = p;
            status_box.appendChild(p);
        }

        const next_run = this.view_name === 'backup' ? this._get_next_backup_run() : null;
        this._status_next_run_p = null;
        if (next_run) {
            const lang = this.Translation?.get_current_language_code?.() || 'sv-SE';
            const next_run_str = this.Helpers?.format_iso_to_local_datetime
                ? this.Helpers.format_iso_to_local_datetime(next_run.toISOString(), lang)
                : next_run.toLocaleString(lang);
            const p_next = this.Helpers.create_element('p', {
                text_content: t('backup_status_next_run', { datetime: next_run_str })
            });
            this._status_next_run_p = p_next;
            status_box.appendChild(p_next);
        }

        plate.appendChild(status_box);

        // Filtersektion
        const filter_section = this.Helpers.create_element('section', {
            class_name: 'backup-filter-section'
        });

        const search_wrapper = this.Helpers.create_element('div', {
            class_name: 'backup-filter-search'
        });
        const search_label = this.Helpers.create_element('label', {
            text_content: t('backup_filter_search_label'),
            attributes: { for: 'backup-filter-search-input' }
        });
        const search_input = this.Helpers.create_element('input', {
            attributes: {
                id: 'backup-filter-search-input',
                type: 'text',
                value: this.filter_text
            }
        });
        search_input.addEventListener('input', this._handle_filter_input);
        search_wrapper.appendChild(search_label);
        search_wrapper.appendChild(search_input);

        const status_wrapper = this.Helpers.create_element('div', {
            class_name: 'backup-filter-status'
        });
        const status_label = this.Helpers.create_element('label', {
            text_content: t('backup_filter_status_label'),
            attributes: { for: 'backup-filter-status-select' }
        });
        const status_select = this.Helpers.create_element('select', {
            attributes: {
                id: 'backup-filter-status-select',
                name: 'backup-status-filter'
            }
        });
        const add_option = (value, label) => {
            const opt = this.Helpers.create_element('option', {
                text_content: label,
                attributes: { value }
            });
            if (this.status_filter === value) {
                opt.selected = true;
            }
            status_select.appendChild(opt);
        };
        add_option('all', t('backup_filter_status_all'));
        add_option('in_progress', this.get_status_label('in_progress'));
        add_option('not_started', this.get_status_label('not_started'));
        add_option('locked', this.get_status_label('locked'));
        add_option('archived', this.get_status_label('archived'));
        add_option('deleted', t('backup_status_deleted'));
        status_select.addEventListener('change', this._handle_status_change);
        status_wrapper.appendChild(status_label);
        status_wrapper.appendChild(status_select);

        filter_section.appendChild(search_wrapper);
        filter_section.appendChild(status_wrapper);

        plate.appendChild(filter_section);
        }

        if (this.view_name === 'backup') {
            // Översiktstabell
            const overview_section = this.Helpers.create_element('section', {
                class_name: 'backup-overview-section'
            });
            const overview_heading = this.Helpers.create_element('h2', {
                text_content: t('backup_overview_heading')
            });
            overview_section.appendChild(overview_heading);

            const overview_table_root = this.Helpers.create_element('div', {
                class_name: 'backup-overview-table-root'
            });
            overview_section.appendChild(overview_table_root);
            this._overview_table_root = overview_table_root;

            const overview_columns = this._build_overview_columns(t);
            this._overview_table.render({
                root: overview_table_root,
                columns: overview_columns,
                data: this.filtered_overview || [],
                emptyMessage: t('backup_overview_empty'),
                ariaLabel: t('backup_overview_aria_label'),
                wrapperClassName: 'generic-table-wrapper',
                tableClassName: 'generic-table generic-table--backup-overview',
                sortState: this.sort_state_overview,
                onSort: (col_index, direction) => {
                    this.sort_state_overview = { columnIndex: col_index, direction };
                    if (this.root) this.render();
                },
                t
            });

            plate.appendChild(overview_section);
        }

        // Detaljvy för vald granskning (egen vy)
        if (this.view_name === 'backup_detail' && this.selected_audit_id) {
            const detail_section = this.Helpers.create_element('section', {
                class_name: 'backup-detail-section'
            });
            const detail_h1 = this.Helpers.create_element('h1', {
                id: 'main-content-heading',
                text_content: t('backup_detail_heading'),
                attributes: { tabindex: '-1' }
            });
            detail_section.appendChild(detail_h1);

            const detail_overview_row = this.backup_overview.find(r => r.auditId === this.selected_audit_id) || null;
            const detail_info = this.Helpers.create_element('ul', { class_name: 'backup-detail-info' });
            const lang = this.Translation?.get_current_language_code?.() || 'sv-SE';
            const format_dt = (iso) => (iso && this.Helpers?.format_iso_to_local_datetime)
                ? this.Helpers.format_iso_to_local_datetime(iso, lang)
                : '';
            const raw_actor_name = (detail_overview_row?.actorName ?? '').toString().trim();
            const fallback_name = t('unknown_actor') || '—';
            const base_actor_name = raw_actor_name || fallback_name;
            const is_deleted = detail_overview_row?.status === 'deleted';
            const actor_name = is_deleted
                ? t('backup_actor_display_deleted', { name: base_actor_name })
                : base_actor_name;
            const case_number = detail_overview_row?.caseNumber ?? '';
            const backup_count = (detail_overview_row?.backupCount !== null && detail_overview_row?.backupCount !== undefined) ? String(detail_overview_row.backupCount) : '0';
            const latest_str = detail_overview_row?.latestBackupAt ? format_dt(detail_overview_row.latestBackupAt) : '—';
            const make_li = (label, value) => {
                const li = this.Helpers.create_element('li');
                li.appendChild(this.Helpers.create_element('strong', { text_content: label }));
                li.appendChild(document.createTextNode(' ' + value));
                return li;
            };
            const actor_li = this.Helpers.create_element('li');
            actor_li.appendChild(this.Helpers.create_element('strong', { text_content: t('backup_detail_info_actor') }));
            actor_li.appendChild(document.createTextNode(' '));
            if (is_deleted) {
                actor_li.appendChild(document.createTextNode(actor_name));
            } else {
                const actor_link = this.Helpers.create_element('a', {
                    text_content: actor_name,
                    attributes: {
                        href: `#audit_overview?auditId=${this.selected_audit_id}`,
                        'aria-label': t('backup_overview_link_to_audit_aria', { name: actor_name })
                    }
                });
                actor_link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.router('audit_overview', { auditId: this.selected_audit_id });
                });
                actor_li.appendChild(actor_link);
            }
            detail_info.appendChild(actor_li);
            if (case_number) {
                detail_info.appendChild(make_li(t('backup_detail_info_case_number'), case_number));
            }
            detail_info.appendChild(make_li(t('backup_detail_info_backup_count'), backup_count));
            detail_info.appendChild(make_li(t('backup_detail_info_latest'), latest_str));
            detail_section.appendChild(detail_info);

            const detail_table_root = this.Helpers.create_element('div', {
                class_name: 'backup-detail-table-root'
            });
            detail_section.appendChild(detail_table_root);

            const detail_columns = this._build_detail_columns(t, detail_overview_row);
            this._detail_table.render({
                root: detail_table_root,
                columns: detail_columns,
                data: this.selected_audit_backups || [],
                emptyMessage: t('backup_detail_empty'),
                ariaLabel: t('backup_detail_aria_label'),
                wrapperClassName: 'generic-table-wrapper',
                tableClassName: 'generic-table generic-table--backup-detail',
                sortState: { columnIndex: 0, direction: 'desc' },
                onSort: () => {}, // sorteras redan manuellt
                t
            });

            const back_btn_bottom = this.Helpers.create_element('button', {
                class_name: ['button', 'button-secondary'],
                text_content: t('backup_detail_back_to_list'),
                attributes: { type: 'button' }
            });
            back_btn_bottom.addEventListener('click', this._handle_back_to_list);
            detail_section.appendChild(back_btn_bottom);

            plate.appendChild(detail_section);
        }

        this.root.appendChild(plate);
    }
}


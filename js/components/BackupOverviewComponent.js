// js/components/BackupOverviewComponent.js

import { get_backup_overview, get_backups_for_audit, run_backup_now, get_backup_settings, update_backup_settings, api_get, get_base_url } from '../api/client.js';
import { GenericTableComponent } from './GenericTableComponent.js';

export const BackupOverviewComponent = {
    CSS_PATH: './css/components/backup_overview_component.css',

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
        this.selected_audit_id = this.view_name === 'backup_detail'
            ? (this.params.auditId || null)
            : null;
        this.selected_audit_backups = [];
        this.filter_text = '';
        this.status_filter = 'all';
        this._run_backup_in_progress = false;
        this.sort_state_overview = { columnIndex: 0, direction: 'asc' };

        this._overview_table = Object.create(GenericTableComponent);
        this._detail_table = Object.create(GenericTableComponent);
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

        this._data_loaded = false;
    },

    destroy() {
        this._overview_table?.destroy?.();
        this._detail_table?.destroy?.();
        this.root = null;
        this.deps = null;
        this.router = null;
        this.Helpers = null;
        this.Translation = null;
        this.NotificationComponent = null;
        this.backup_overview = [];
        this.filtered_overview = [];
        this.selected_audit_backups = [];
    },

    get_t_func() {
        return (this.Translation && typeof this.Translation.t === 'function')
            ? this.Translation.t
            : (key) => `**${key}**`;
    },

    get_status_label(status) {
        const t = this.get_t_func();
        const map = {
            not_started: t('audit_status_not_started'),
            in_progress: t('audit_status_in_progress'),
            locked: t('audit_status_locked'),
            archived: t('audit_status_archived')
        };
        return map[status] || status || '';
    },

    async _load_data(force = false) {
        if (this._data_loaded && !force) return;
        this._data_loaded = true;
        try {
            const [overview, status] = await Promise.all([
                get_backup_overview(),
                api_get('/backup/status').catch(() => null)
            ]);
            this.backup_overview = Array.isArray(overview) ? overview : [];
            this.backup_status = status && status.ok ? status : null;
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
    },

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
    },

    _handle_filter_input(event) {
        this.filter_text = event.target.value || '';
        this._apply_filters();
        if (this.root) this.render();
    },

    _handle_status_change(event) {
        this.status_filter = event.target.value || 'all';
        this._apply_filters();
        if (this.root) this.render();
    },

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
    },

    _handle_back_to_list() {
        if (typeof this.router === 'function') {
            this.router('backup', {});
            return;
        }
        this.selected_audit_id = null;
        this.selected_audit_backups = [];
        if (this.root) this.render();
    },

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
            if (this.root) this.render();
        }
    },

    async _handle_download_backup(event, audit_id, filename) {
        if (event) event.preventDefault();
        if (!audit_id || !filename) return;
        const base = get_base_url();
        const url = `${base}/backup/${encodeURIComponent(audit_id)}/${encodeURIComponent(filename)}`;
        try {
            const res = await fetch(url, { cache: 'no-store' });
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
    },

    async _handle_open_backup_settings() {
        const t = this.get_t_func();
        const ModalComponent = this.deps?.ModalComponent || window.ModalComponent;
        const NotificationComponent = this.NotificationComponent;
        if (!ModalComponent?.show) return;
        let schedule_times = '00:00, 06:00, 12:00, 18:00';
        let retention_days = 30;
        try {
            const data = await get_backup_settings();
            if (data?.schedule_cron === '0 0,6,12,18 * * *') {
                schedule_times = '00:00, 06:00, 12:00, 18:00';
            } else if (data?.schedule_cron) {
                schedule_times = data.schedule_cron;
            }
            if (data?.retention_days != null) retention_days = data.retention_days;
        } catch {
            /* använd standardvärden */
        }

        ModalComponent.show(
            {
                h1_text: t('backup_settings_modal_title'),
                message_text: ''
            },
            (content_container, modal_ref) => {
                const form = this.Helpers.create_element('div', { class_name: 'backup-settings-modal-form' });

                const schedule_group = this.Helpers.create_element('div', { class_name: 'form-group' });
                schedule_group.appendChild(this.Helpers.create_element('label', { text_content: t('backup_settings_schedule_label') }));
                schedule_group.appendChild(this.Helpers.create_element('p', { class_name: 'form-control-static', text_content: t('backup_settings_schedule_value', { times: schedule_times }) }));
                schedule_group.appendChild(this.Helpers.create_element('p', { class_name: 'form-help', text_content: t('backup_settings_schedule_info') }));
                form.appendChild(schedule_group);

                const retention_group = this.Helpers.create_element('div', { class_name: 'form-group' });
                const retention_label_el = this.Helpers.create_element('label', {
                    text_content: t('backup_settings_retention_label'),
                    attributes: { for: 'backup-settings-retention-days' }
                });
                retention_group.appendChild(retention_label_el);
                const retention_input = this.Helpers.create_element('input', {
                    attributes: {
                        type: 'number',
                        id: 'backup-settings-retention-days',
                        min: '1',
                        max: '365',
                        value: String(retention_days),
                        'aria-describedby': 'backup-settings-retention-help'
                    },
                    class_name: 'form-control'
                });
                retention_group.appendChild(retention_input);
                const retention_help = this.Helpers.create_element('p', {
                    class_name: 'form-help',
                    text_content: t('backup_settings_retention_help'),
                    attributes: { id: 'backup-settings-retention-help' }
                });
                retention_group.appendChild(retention_help);
                form.appendChild(retention_group);

                const btn_row = this.Helpers.create_element('div', { class_name: 'backup-settings-modal-buttons' });
                const save_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('backup_settings_save'),
                    attributes: { type: 'button' }
                });
                const close_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-secondary'],
                    text_content: t('backup_settings_close'),
                    attributes: { type: 'button' }
                });
                save_btn.addEventListener('click', async () => {
                    const raw = retention_input.value.trim();
                    const num = raw === '' ? NaN : parseInt(raw, 10);
                    if (!Number.isInteger(num) || num < 1 || num > 365) {
                        if (NotificationComponent?.show_global_message) {
                            NotificationComponent.show_global_message(t('backup_settings_retention_invalid'), 'warning');
                        }
                        return;
                    }
                    try {
                        await update_backup_settings({ retention_days: num });
                        if (NotificationComponent?.show_global_message) {
                            NotificationComponent.show_global_message(t('backup_settings_saved_ok'), 'success');
                        }
                        modal_ref.close();
                    } catch (err) {
                        if (NotificationComponent?.show_global_message) {
                            NotificationComponent.show_global_message(t('backup_settings_save_error') || err.message, 'error');
                        }
                    }
                });
                close_btn.addEventListener('click', () => modal_ref.close());
                btn_row.appendChild(save_btn);
                btn_row.appendChild(close_btn);
                form.appendChild(btn_row);

                content_container.appendChild(form);
            }
        );
    },

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
                getContent: (row) => (row.actorName ?? '').toString().trim() || '—'
            },
            {
                headerLabel: t('backup_overview_col_status'),
                getSortValue: (row) => (row.status ?? '').toString(),
                getContent: (row) => this.get_status_label(row.status) || '—'
            },
            {
                headerLabel: t('backup_overview_col_latest_backup'),
                getSortValue: (row) => row.latestBackupAt ? Date.parse(row.latestBackupAt) || 0 : 0,
                getContent: (row) => format_datetime(row.latestBackupAt) || '—'
            },
            {
                headerLabel: t('backup_overview_col_backup_count'),
                getSortValue: (row) => row.backupCount != null ? Number(row.backupCount) : 0,
                getContent: (row) => (row.backupCount != null ? String(row.backupCount) : '0')
            },
            {
                headerLabel: t('backup_overview_col_has_archive'),
                getSortValue: (row) => row.hasArchive ? 1 : 0,
                getContent: (row) => row.hasArchive ? t('yes') : t('no')
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
    },

    _build_detail_columns(t, overview_row) {
        const Helpers = this.Helpers;
        const lang = this.Translation?.get_current_language_code?.() || 'sv-SE';
        const format_datetime = (iso) => {
            if (!iso || !Helpers?.format_iso_to_local_datetime) return '';
            return Helpers.format_iso_to_local_datetime(iso, lang);
        };
        const actor_name = overview_row?.actorName ?? '—';
        const backup_count = overview_row?.backupCount != null ? String(overview_row.backupCount) : '—';
        const latest_str = overview_row?.latestBackupAt
            ? format_datetime(overview_row.latestBackupAt) || '—'
            : '—';

        return [
            {
                headerLabel: t('backup_detail_col_actor'),
                getSortValue: () => actor_name,
                getContent: () => actor_name
            },
            {
                headerLabel: t('backup_detail_col_backup_count'),
                getSortValue: () => overview_row?.backupCount ?? 0,
                getContent: () => backup_count
            },
            {
                headerLabel: t('backup_detail_col_latest'),
                getSortValue: (row) => row.createdAt ? Date.parse(row.createdAt) || 0 : 0,
                getContent: () => latest_str
            },
            {
                headerLabel: t('backup_detail_col_type'),
                getSortValue: (row) => row.isArchive ? 1 : 0,
                getContent: (row) => row.isArchive
                    ? t('backup_detail_type_archive')
                    : t('backup_detail_type_regular')
            },
            {
                headerLabel: t('backup_detail_col_actions'),
                isAction: true,
                getContent: (row) => {
                    const a = Helpers.create_element('a', {
                        class_name: 'button button-default button-small generic-table-action-cell',
                        text_content: t('backup_detail_download_button'),
                        attributes: {
                            href: '#',
                            'aria-label': t('backup_detail_download_aria', { filename: row.filename || '' })
                        }
                    });
                    a.addEventListener('click', (e) => {
                        this._handle_download_backup(e, this.selected_audit_id, row.filename);
                    });
                    return a;
                }
            }
        ];
    },

    async render() {
        if (!this.root || !this.Helpers?.create_element) return;

        if (!this._data_loaded) {
            this._load_data().then(() => {
                if (this.root) this.render();
            });
        }

        const t = this.get_t_func();
        this.root.innerHTML = '';

        const plate = this.Helpers.create_element('div', {
            class_name: 'content-plate backup-view-plate'
        });

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

        // Systemstatus-ruta
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
            class_name: ['button', 'button-default', 'button-small'],
            text_content: this._run_backup_in_progress ? t('backup_run_in_progress') : t('backup_run_now_button'),
            attributes: { type: 'button' }
        });
        if (this._run_backup_in_progress) {
            run_backup_btn.setAttribute('aria-busy', 'true');
        }
        run_backup_btn.addEventListener('click', this._handle_run_backup);
        const heading_and_run = this.Helpers.create_element('div', { class_name: 'backup-status-heading-left' });
        heading_and_run.appendChild(status_heading);
        heading_and_run.appendChild(run_backup_btn);
        const settings_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'button-small'],
            text_content: t('backup_settings_button'),
            attributes: { type: 'button', 'aria-label': t('backup_settings_button') }
        });
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
            status_box.appendChild(p);
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
        status_select.addEventListener('change', this._handle_status_change);
        status_wrapper.appendChild(status_label);
        status_wrapper.appendChild(status_select);

        filter_section.appendChild(search_wrapper);
        filter_section.appendChild(status_wrapper);

        plate.appendChild(filter_section);

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
            const detail_h2 = this.Helpers.create_element('h2', {
                text_content: t('backup_detail_heading')
            });
            detail_section.appendChild(detail_h2);

            const detail_table_root = this.Helpers.create_element('div', {
                class_name: 'backup-detail-table-root'
            });
            detail_section.appendChild(detail_table_root);

            const detail_overview_row = this.backup_overview.find(r => r.auditId === this.selected_audit_id) || null;
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
};


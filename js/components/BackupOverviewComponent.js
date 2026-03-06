// js/components/BackupOverviewComponent.js

import { get_backup_overview, get_backups_for_audit, api_get } from '../api/client.js';
import { GenericTableComponent } from './GenericTableComponent.js';

export const BackupOverviewComponent = {
    CSS_PATH: './css/components/backup_overview_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this.NotificationComponent = deps.NotificationComponent;

        this.backup_overview = [];
        this.filtered_overview = [];
        this.backup_status = null;
        this.selected_audit_id = null;
        this.selected_audit_backups = [];
        this.filter_text = '';
        this.status_filter = 'all';
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
        this.selected_audit_id = null;
        this.selected_audit_backups = [];
        if (this.root) this.render();
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
                    const btn = Helpers.create_element('button', {
                        class_name: ['button', 'button-default', 'button-small'],
                        text_content: t('backup_overview_show_backups_button'),
                        attributes: { type: 'button' }
                    });
                    btn.addEventListener('click', () => this._handle_show_backups(row.auditId));
                    return btn;
                }
            }
        ];
    },

    _build_detail_columns(t) {
        const Helpers = this.Helpers;
        const lang = this.Translation?.get_current_language_code?.() || 'sv-SE';
        const format_datetime = (iso) => {
            if (!iso || !Helpers?.format_iso_to_local_datetime) return '';
            return Helpers.format_iso_to_local_datetime(iso, lang);
        };

        return [
            {
                headerLabel: t('backup_detail_col_datetime'),
                getSortValue: (row) => row.createdAt ? Date.parse(row.createdAt) || 0 : 0,
                getContent: (row) => format_datetime(row.createdAt) || '—'
            },
            {
                headerLabel: t('backup_detail_col_type'),
                getSortValue: (row) => row.isArchive ? 1 : 0,
                getContent: (row) => row.isArchive
                    ? t('backup_detail_type_archive')
                    : t('backup_detail_type_regular')
            },
            {
                headerLabel: t('backup_detail_col_filename'),
                getSortValue: (row) => (row.filename ?? '').toString(),
                getContent: (row) => row.filename || '—'
            },
            {
                headerLabel: t('backup_detail_col_actions'),
                isAction: true,
                getContent: (row) => {
                    const a = Helpers.create_element('a', {
                        class_name: 'button button-default button-small',
                        text_content: t('backup_detail_download_button'),
                        attributes: {
                            href: row.url || '#',
                            'aria-label': t('backup_detail_download_aria', { filename: row.filename || '' })
                        }
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
        const status_heading = this.Helpers.create_element('h2', {
            text_content: t('backup_status_heading')
        });
        status_box.appendChild(status_heading);

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

        // Detaljvy för vald granskning
        if (this.selected_audit_id) {
            const detail_section = this.Helpers.create_element('section', {
                class_name: 'backup-detail-section'
            });
            const detail_heading_row = this.Helpers.create_element('div', {
                class_name: 'backup-detail-heading-row'
            });
            const detail_h2 = this.Helpers.create_element('h2', {
                text_content: t('backup_detail_heading')
            });
            const back_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-secondary', 'button-small'],
                text_content: t('backup_detail_back_to_list'),
                attributes: { type: 'button' }
            });
            back_btn.addEventListener('click', this._handle_back_to_list);
            detail_heading_row.appendChild(detail_h2);
            detail_heading_row.appendChild(back_btn);
            detail_section.appendChild(detail_heading_row);

            const detail_table_root = this.Helpers.create_element('div', {
                class_name: 'backup-detail-table-root'
            });
            detail_section.appendChild(detail_table_root);

            const detail_columns = this._build_detail_columns(t);
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

            plate.appendChild(detail_section);
        }

        this.root.appendChild(plate);
    }
};


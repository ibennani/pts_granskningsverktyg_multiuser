// js/components/StartViewComponent.js

import { check_api_available, get_audits, load_audit_with_rule_file } from '../api/client.js';

export const StartViewComponent = {
    CSS_PATH: './css/components/start_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.SaveAuditLogic = deps.SaveAuditLogic || window.SaveAuditLogic;
        this.ValidationLogic = deps.ValidationLogic || window.ValidationLogic;

        this.handle_download_audit = this.handle_download_audit.bind(this);

        this.audits = [];
        this.api_available = false;
        this._api_checked = false;
        this._poll_timer = null;
        this.POLL_INTERVAL_MS = 3000;

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'StartViewComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {});
        }

        this._start_list_polling = () => {
            this._stop_list_polling();
            const poll = async () => {
                if (!this.root || !this.api_available) return;
                try {
                    const fresh = await get_audits();
                    const fp = (arr) => JSON.stringify(arr.map(a => ({ id: a.id, status: a.status, updated_at: a.updated_at })));
                    if (fp(fresh) !== fp(this.audits)) {
                        this.audits = fresh;
                        if (this.root) this.render();
                    }
                } catch {
                    /* tyst vid poll-fel */
                }
                this._poll_timer = setTimeout(poll, this.POLL_INTERVAL_MS);
            };
            this._poll_timer = setTimeout(poll, this.POLL_INTERVAL_MS);
        };
        this._stop_list_polling = () => {
            if (this._poll_timer) {
                clearTimeout(this._poll_timer);
                this._poll_timer = null;
            }
        };
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
        return map[status] || status;
    },

    async handle_download_audit(audit_id) {
        const t = this.get_t_func();
        const show_msg = this.NotificationComponent?.show_global_message?.bind(this.NotificationComponent);
        try {
            const full_state = await load_audit_with_rule_file(audit_id);
            if (full_state?.ruleFileContent && this.ValidationLogic?.validate_saved_audit_file?.(full_state)?.isValid) {
                if (this.SaveAuditLogic?.save_audit_to_json_file) {
                    this.SaveAuditLogic.save_audit_to_json_file(full_state, t, show_msg);
                } else {
                    if (show_msg) show_msg(t('error_internal'), 'error');
                }
            } else {
                if (show_msg) show_msg(t('error_invalid_saved_audit_file'), 'error');
            }
        } catch (err) {
            if (show_msg) {
                show_msg(t('server_load_audit_error', { message: err.message }) || err.message, 'error');
            }
        }
    },

    async ensure_api_data(force = false) {
        if (this._api_checked && !force) return;
        if (force) this._api_checked = false;
        this._api_checked = true;
        this.api_available = await check_api_available();
        if (this.api_available) {
            try {
                this.audits = await get_audits();
            } catch {
                this.audits = [];
            }
        }
    },

    render() {
        if (!this.root || !this.Helpers?.create_element) return;

        if (!this._api_checked) {
            this.ensure_api_data().then(() => {
                if (this.root) this.render();
            });
        }

        this.root.innerHTML = '';
        const t = this.get_t_func();

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate start-view-plate' });

        const h1 = this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            text_content: t('start_view_h1'),
            attributes: { tabindex: '-1' }
        });

        const intro = this.Helpers.create_element('p', {
            class_name: 'start-view-intro',
            text_content: t('start_view_intro')
        });

        plate.appendChild(h1);
        plate.appendChild(intro);

        if (!this._api_checked) {
            const loading = this.Helpers.create_element('p', {
                class_name: 'start-view-loading',
                text_content: t('admin_loading')
            });
            plate.appendChild(loading);
        } else if (!this.api_available) {
            const no_api = this.Helpers.create_element('p', {
                class_name: 'start-view-no-api',
                text_content: t('admin_api_unavailable')
            });
            plate.appendChild(no_api);
        } else {
            const sort_audits = (list) => [...list].sort((a, b) => {
                const ca = (a.metadata?.caseNumber ?? '').toString().trim();
                const cb = (b.metadata?.caseNumber ?? '').toString().trim();
                if (!ca && !cb) return 0;
                if (!ca) return 1;
                if (!cb) return -1;
                return ca.localeCompare(cb, undefined, { numeric: true });
            });
            const in_progress = this.audits.filter((a) => a.status === 'in_progress');
            const not_started = this.audits.filter((a) => a.status === 'not_started');
            const completed = this.audits.filter((a) => a.status === 'locked' || a.status === 'archived');

            const section_configs = [
                { heading_key: 'start_view_audits_heading', audits: sort_audits(in_progress) },
                { heading_key: 'start_view_new_audits_heading', audits: sort_audits(not_started) },
                { heading_key: 'start_view_completed_audits_heading', audits: sort_audits(completed) }
            ];

            const EMPTY_PLACEHOLDER = '—';
            const render_table_body = (audits, empty_text_key) => {
                const tbody = this.Helpers.create_element('tbody');
                if (audits.length === 0) {
                    const empty_row = this.Helpers.create_element('tr');
                    const empty_cell = this.Helpers.create_element('td', {
                        text_content: t(empty_text_key),
                        attributes: { colspan: '7' }
                    });
                    empty_row.appendChild(empty_cell);
                    tbody.appendChild(empty_row);
                } else {
                    audits.forEach((audit) => {
                        const row = this.Helpers.create_element('tr');
                        const case_number = (audit.metadata?.caseNumber ?? '').toString().trim();
                        const actor_name = (audit.metadata?.actorName ?? '').toString().trim();
                        const auditor = (audit.metadata?.auditorName ?? '').toString().trim();
                        const link_label = actor_name || case_number || EMPTY_PLACEHOLDER;

                        const case_cell = this.Helpers.create_element('td', { text_content: case_number || EMPTY_PLACEHOLDER });
                        const actor_cell = this.Helpers.create_element('td');
                        const link = this.Helpers.create_element('a', {
                            class_name: 'start-view-audit-link',
                            text_content: actor_name || EMPTY_PLACEHOLDER,
                            attributes: {
                                href: `#audit_overview?auditId=${audit.id}`,
                                'aria-label': t('start_view_open_audit_aria', { name: link_label })
                            }
                        });
                        actor_cell.appendChild(link);
                        const status_cell = this.Helpers.create_element('td', {
                            text_content: audit.status ? this.get_status_label(audit.status) : EMPTY_PLACEHOLDER
                        });
                        const progress_cell = this.Helpers.create_element('td', {
                            text_content: audit.progress != null ? `${audit.progress}%` : EMPTY_PLACEHOLDER
                        });
                        const deficiency_cell = this.Helpers.create_element('td', {
                            text_content: audit.deficiency_index != null
                                ? (this.Helpers.format_number_locally?.(audit.deficiency_index, this.Translation?.get_current_language_code?.() || 'sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? Number(audit.deficiency_index).toFixed(1))
                                : EMPTY_PLACEHOLDER
                        });
                        const auditor_cell = this.Helpers.create_element('td', { text_content: auditor || EMPTY_PLACEHOLDER });
                        const download_details = [case_number, actor_name].filter(Boolean).join(' ') || EMPTY_PLACEHOLDER;
                        const download_btn = this.Helpers.create_element('button', {
                            class_name: ['button', 'button-default', 'button-small', 'start-view-download-btn'],
                            html_content: `<span>${t('admin_download_label')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('save', ['currentColor'], 16) : ''),
                            attributes: { type: 'button', 'aria-label': t('start_view_download_audit_aria', { details: download_details }) }
                        });
                        download_btn.addEventListener('click', () => this.handle_download_audit(audit.id));
                        const download_cell = this.Helpers.create_element('td');
                        download_cell.appendChild(download_btn);

                        row.appendChild(case_cell);
                        row.appendChild(actor_cell);
                        row.appendChild(status_cell);
                        row.appendChild(progress_cell);
                        row.appendChild(deficiency_cell);
                        row.appendChild(auditor_cell);
                        row.appendChild(download_cell);
                        tbody.appendChild(row);
                    });
                }
                return tbody;
            };

            const headers = [
                t('start_view_col_case_number'),
                t('start_view_col_actor'),
                t('start_view_col_status'),
                t('start_view_col_progress'),
                t('start_view_col_deficiency'),
                t('start_view_col_auditor'),
                t('start_view_col_download')
            ];

            section_configs.forEach((config, index) => {
                const section = this.Helpers.create_element('section', {
                    class_name: index === 0 ? 'start-view-audits-section' : 'start-view-audits-section start-view-audits-section-following'
                });
                const is_new_audits_section = config.heading_key === 'start_view_new_audits_heading';
                if (is_new_audits_section) {
                    const heading_row = this.Helpers.create_element('div', { class_name: 'start-view-section-heading-row' });
                    const section_heading = this.Helpers.create_element('h2', { text_content: t(config.heading_key) });
                    const start_new_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-primary', 'admin-start-new-audit-btn'],
                        text_content: t('start_new_audit'),
                        attributes: {
                            type: 'button',
                            'aria-label': t('start_new_audit')
                        }
                    });
                    start_new_btn.addEventListener('click', () => this.router('admin_audits', { startNew: '1' }));
                    heading_row.appendChild(section_heading);
                    heading_row.appendChild(start_new_btn);
                    section.appendChild(heading_row);
                } else {
                    const section_heading = this.Helpers.create_element('h2', { text_content: t(config.heading_key) });
                    section.appendChild(section_heading);
                }

                const table_wrapper = this.Helpers.create_element('div', { class_name: 'start-view-table-wrapper' });
                const table = this.Helpers.create_element('table', {
                    class_name: 'start-view-table',
                    attributes: { 'aria-label': t(config.heading_key) }
                });
                const caption = this.Helpers.create_element('caption', {
                    class_name: 'visually-hidden',
                    text_content: t(config.heading_key)
                });
                table.appendChild(caption);
                const thead = this.Helpers.create_element('thead');
                const header_row = this.Helpers.create_element('tr');
                headers.forEach((text) => {
                    header_row.appendChild(this.Helpers.create_element('th', { text_content: text }));
                });
                thead.appendChild(header_row);
                table.appendChild(thead);

                const empty_key = config.heading_key === 'start_view_audits_heading'
                    ? 'start_view_no_audits'
                    : config.heading_key === 'start_view_new_audits_heading'
                        ? 'start_view_no_new_audits'
                        : 'start_view_no_completed_audits';
                table.appendChild(render_table_body(config.audits, empty_key));
                table_wrapper.appendChild(table);
                section.appendChild(table_wrapper);
                plate.appendChild(section);
            });
        }

        this.root.appendChild(plate);

        if (this._api_checked && this.api_available && typeof this._start_list_polling === 'function') {
            this._start_list_polling();
        }
    },

    destroy() {
        this._stop_list_polling?.();
        this.root = null;
        this.deps = null;
    }
};

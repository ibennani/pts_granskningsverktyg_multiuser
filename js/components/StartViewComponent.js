// js/components/StartViewComponent.js

import { check_api_available, get_audits } from '../api/client.js';

export const StartViewComponent = {
    CSS_PATH: './css/components/start_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;

        this.audits = [];
        this.api_available = false;
        this._api_checked = false;

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'StartViewComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {});
        }
    },

    get_t_func() {
        return (this.Translation && typeof this.Translation.t === 'function')
            ? this.Translation.t
            : (key) => `**${key}**`;
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

    handle_open_audit(audit_id) {
        this.router('upload', { auditId: audit_id });
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

        const h2 = this.Helpers.create_element('h2', {
            text_content: t('start_view_audits_heading')
        });

        plate.appendChild(h1);
        plate.appendChild(intro);
        plate.appendChild(h2);

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
            const table_wrapper = this.Helpers.create_element('div', { class_name: 'start-view-table-wrapper' });
            const table = this.Helpers.create_element('table', {
                class_name: 'start-view-table',
                attributes: { 'aria-label': t('start_view_audits_heading') }
            });

            const thead = this.Helpers.create_element('thead');
            const header_row = this.Helpers.create_element('tr');
            const headers = [
                t('start_view_col_actor'),
                t('start_view_col_status'),
                t('start_view_col_progress'),
                t('start_view_col_deficiency')
            ];
            headers.forEach((text) => {
                const th = this.Helpers.create_element('th', { text_content: text });
                header_row.appendChild(th);
            });
            thead.appendChild(header_row);
            table.appendChild(thead);

            const tbody = this.Helpers.create_element('tbody');
            if (this.audits.length === 0) {
                const empty_row = this.Helpers.create_element('tr');
                const empty_cell = this.Helpers.create_element('td', {
                    text_content: t('start_view_no_audits'),
                    attributes: { colspan: '4' }
                });
                empty_row.appendChild(empty_cell);
                tbody.appendChild(empty_row);
            } else {
                this.audits.forEach((audit) => {
                    const row = this.Helpers.create_element('tr');
                    const actor_name = audit.metadata?.actorName || '';
                    const display_actor = actor_name || `Granskning ${audit.id}`;

                    const actor_cell = this.Helpers.create_element('td');
                    const link = this.Helpers.create_element('a', {
                        href: `#upload?auditId=${audit.id}`,
                        class_name: 'start-view-audit-link',
                        text_content: display_actor,
                        attributes: { 'aria-label': t('start_view_open_audit_aria', { name: display_actor }) }
                    });
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.handle_open_audit(audit.id);
                    });
                    actor_cell.appendChild(link);

                    const status_cell = this.Helpers.create_element('td', {
                        text_content: this.get_status_label(audit.status)
                    });

                    const progress_cell = this.Helpers.create_element('td', {
                        text_content: audit.progress != null ? `${audit.progress}%` : '—'
                    });

                    const deficiency_cell = this.Helpers.create_element('td', {
                        text_content: audit.deficiency_index != null ? String(audit.deficiency_index) : '—'
                    });

                    row.appendChild(actor_cell);
                    row.appendChild(status_cell);
                    row.appendChild(progress_cell);
                    row.appendChild(deficiency_cell);
                    tbody.appendChild(row);
                });
            }
            table.appendChild(tbody);
            table_wrapper.appendChild(table);
            plate.appendChild(table_wrapper);
        }

        this.root.appendChild(plate);
    },

    destroy() {
        this.root = null;
        this.deps = null;
    }
};

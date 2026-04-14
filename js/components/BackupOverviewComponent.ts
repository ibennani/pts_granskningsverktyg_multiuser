import './backup_overview_component.css';
import { BackupAuditController } from './backup/backup_audit_controller';
import { BackupRulefileController, type RulefileKind } from './backup/backup_rulefile_controller';
import { load_backup_mode_from_storage, save_backup_mode_to_storage, type BackupMode } from './backup/backup_mode_storage';

export class BackupOverviewComponent {
    CSS_PATH = './backup_overview_component.css';
    root: HTMLElement | null = null;
    deps: any = null;
    router: any = null;
    view_name: string | null = null;
    params: any = null;
    Helpers: any = null;
    Translation: any = null;
    NotificationComponent: any = null;
    mode: BackupMode = 'audits';

    audits = new BackupAuditController();
    rulefiles = new BackupRulefileController();

    async init({ root, deps }: { root: HTMLElement; deps: any }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.view_name = deps.view_name;
        this.params = deps.params || {};
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this.NotificationComponent = deps.NotificationComponent;
        this.mode = load_backup_mode_from_storage();

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'BackupOverviewComponent', { timeout: 5000, maxRetries: 2 }).catch(() => {});
        }
        const deps_for_backup_child = {
            ...deps,
            backup_overview_refresh_table: () => this._refresh_backup_overview_table_only(),
            backup_overview_request_full_render: () => {
                if (this.root) void this.render();
            }
        };
        await this.audits.init({ root, deps: deps_for_backup_child });
        await this.rulefiles.init({ root, deps: deps_for_backup_child });
    }

    destroy() {
        this.audits.destroy();
        this.rulefiles.destroy();
        this.root = null;
        this.deps = null;
        this.router = null;
        this.Helpers = null;
        this.Translation = null;
        this.NotificationComponent = null;
    }

    get_t_func() {
        return (this.Translation && typeof this.Translation.t === 'function') ? this.Translation.t : ((key: string) => `**${key}**`);
    }

    /** Samma mönster som startvyns tabellrubriker (`start_view_section_heading_with_count`). */
    _format_backup_overview_heading() {
        const t = this.get_t_func();
        const title = this.mode === 'audits' ? t('backup_overview_heading') : t('backup_rulefile_overview_heading');
        const count = this.mode === 'audits'
            ? (this.audits.filtered_overview?.length ?? 0)
            : (this.rulefiles.filtered_rulefiles?.length ?? 0);
        return t('start_view_section_heading_with_count', { title, count });
    }

    _sync_backup_overview_section_heading() {
        if (!this.root || this.view_name !== 'backup') return;
        const overview_heading = this.root.querySelector('#backup-overview-section-heading');
        if (overview_heading) overview_heading.textContent = this._format_backup_overview_heading();
    }

    async _handle_mode_change(next: BackupMode) {
        this.mode = next;
        save_backup_mode_to_storage(next);
        if (next === 'audits') {
            await this.audits.load_data();
        } else {
            await this.rulefiles.load_data();
        }
        this._update_backup_list_filters_for_mode();
        this._refresh_backup_overview_table_only();
    }

    /**
     * Synkar etiketter, andra filtret och sökfältets värde när läge byts, utan att tömma hela vyn (fokus bevaras).
     */
    _update_backup_list_filters_for_mode() {
        if (!this.root || this.view_name !== 'backup' || !this.Helpers?.create_element) return;
        const t = this.get_t_func();

        const search_label = this.root.querySelector('.backup-filter-search label[for="backup-filter-search-input"]');
        if (search_label) {
            search_label.textContent = this.mode === 'audits' ? t('backup_filter_search_label') : t('backup_rulefile_filter_search_label');
        }

        const search_input = this.root.querySelector('#backup-filter-search-input') as HTMLInputElement | null;
        if (search_input) {
            search_input.value = this.mode === 'audits' ? this.audits.filter_text : this.rulefiles.filter_text;
        }

        const status_label = this.root.querySelector('.backup-filter-status label[for="backup-filter-status-select"]');
        if (status_label) {
            status_label.textContent = this.mode === 'audits' ? t('backup_filter_status_label') : t('backup_rulefile_filter_kind_label');
        }

        const status_select = this.root.querySelector('#backup-filter-status-select') as HTMLSelectElement | null;
        if (!status_select) return;

        status_select.replaceChildren();

        const append_opt = (value: string, label: string, selected: boolean) => {
            const opt = this.Helpers.create_element('option', { text_content: label, attributes: { value } });
            if (selected) opt.selected = true;
            status_select.appendChild(opt);
        };

        if (this.mode === 'audits') {
            const cur = this.audits.status_filter || 'all';
            const pairs: [string, string][] = [
                ['all', t('backup_filter_status_all')],
                ['in_progress', this.audits.get_status_label('in_progress')],
                ['not_started', this.audits.get_status_label('not_started')],
                ['locked', this.audits.get_status_label('locked')],
                ['archived', this.audits.get_status_label('archived')],
                ['deleted', t('backup_status_deleted')]
            ];
            const valid = pairs.some(([v]) => v === cur) ? cur : 'all';
            if (valid !== cur) this.audits.status_filter = valid;
            pairs.forEach(([v, lbl]) => append_opt(v, lbl, v === valid));
        } else {
            const cur = this.rulefiles.rulefile_kind || 'all';
            const pairs: [string, string][] = [
                ['all', t('backup_rulefile_filter_kind_all')],
                ['published', t('backup_rulefile_filter_kind_published')],
                ['working', t('backup_rulefile_filter_kind_working')]
            ];
            const valid = (pairs.some(([v]) => v === cur) ? cur : 'all') as RulefileKind;
            if (valid !== cur) this.rulefiles.rulefile_kind = valid;
            pairs.forEach(([v, lbl]) => append_opt(v, lbl, v === valid));
        }

        if (this.mode === 'audits') this.audits.apply_filters();
        else this.rulefiles.apply_filters();

        this._sync_backup_overview_section_heading();
    }

    /**
     * Uppdaterar endast översiktstabellen så filterfält (t.ex. sök) inte förlorar fokus.
     */
    _refresh_backup_overview_table_only() {
        if (!this.root || this.view_name !== 'backup') return;
        const host = this.root.querySelector('.backup-overview-table-root');
        if (!host) return;
        if (this.mode === 'audits') {
            this.audits.render_audits_overview({ root: host as HTMLElement });
        } else {
            this.rulefiles.render_rulefiles_overview({ root: host as HTMLElement });
        }
        this._sync_backup_overview_section_heading();
    }

    async render() {
        if (!this.root || !this.Helpers?.create_element) return;
        const t = this.get_t_func();

        if (this.mode === 'audits') await this.audits.load_data();
        if (this.mode === 'rulefiles') await this.rulefiles.load_data();

        this.root.innerHTML = '';
        const plate = this.Helpers.create_element('div', { class_name: 'content-plate backup-view-plate' });

        if (this.view_name === 'backup') {
            plate.appendChild(this.Helpers.create_element('h1', { id: 'main-content-heading', text_content: t('menu_link_backups'), attributes: { tabindex: '-1' } }));
            plate.appendChild(this.Helpers.create_element('p', { class_name: 'backup-view-intro', text_content: t('backup_view_intro') }));

            const status_box = this.Helpers.create_element('section', { class_name: 'backup-status-box' });
            const heading_row = this.Helpers.create_element('div', { class_name: 'backup-status-heading-row' });
            const left = this.Helpers.create_element('div', { class_name: 'backup-status-heading-left' });
            left.appendChild(this.Helpers.create_element('h2', { text_content: t('backup_status_heading') }));
            const run_btn = this.Helpers.create_element('button', { class_name: ['button', 'button-default', 'button-small', 'backup-btn-with-icon'], attributes: { type: 'button' } });
            run_btn.appendChild(this.Helpers.create_element('span', { class_name: 'backup-btn-label', text_content: this.audits._run_backup_in_progress ? t('backup_run_in_progress') : t('backup_run_now_button') }));
            if (this.Helpers.get_icon_svg) {
                const run_icon = this.Helpers.create_element('span', {
                    html_content: this.Helpers.get_icon_svg('save', ['currentColor'], 18),
                    attributes: { 'aria-hidden': 'true' }
                });
                run_icon.classList.add('backup-btn-icon');
                run_btn.appendChild(run_icon);
            }
            if (this.audits._run_backup_in_progress) {
                run_btn.setAttribute('aria-busy', 'true');
            } else {
                run_btn.removeAttribute('aria-busy');
            }
            run_btn.addEventListener('click', () => this.audits.handle_run_backup());
            left.appendChild(run_btn);
            heading_row.appendChild(left);

            const right = this.Helpers.create_element('div', { class_name: 'backup-status-heading-buttons' });
            const settings_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default', 'button-small', 'backup-btn-with-icon'],
                attributes: { type: 'button', 'aria-label': t('backup_settings_button') }
            });
            settings_btn.appendChild(this.Helpers.create_element('span', { class_name: 'backup-btn-label', text_content: t('backup_settings_button') }));
            if (this.Helpers.get_icon_svg) {
                const set_icon = this.Helpers.create_element('span', {
                    html_content: this.Helpers.get_icon_svg('settings', ['currentColor'], 18),
                    attributes: { 'aria-hidden': 'true' }
                });
                set_icon.classList.add('backup-btn-icon');
                settings_btn.appendChild(set_icon);
            }
            settings_btn.addEventListener('click', () => this.router('backup_settings', {}));
            right.appendChild(settings_btn);
            heading_row.appendChild(right);
            status_box.appendChild(heading_row);

            (this.audits.build_status_box_paragraphs() || []).forEach((node: any) => status_box.appendChild(node));
            plate.appendChild(status_box);

            const filter_section = this.Helpers.create_element('section', { class_name: 'backup-filter-section' });

            const mode_wrapper = this.Helpers.create_element('div', { class_name: 'backup-filter-mode' });
            mode_wrapper.appendChild(this.Helpers.create_element('label', { text_content: t('backup_filter_mode_label'), attributes: { for: 'backup-filter-mode-select' } }));
            const mode_select = this.Helpers.create_element('select', { attributes: { id: 'backup-filter-mode-select', name: 'backup-mode-filter' } });
            const add_mode_opt = (value: BackupMode, label: string) => {
                const opt = this.Helpers.create_element('option', { text_content: label, attributes: { value } });
                if (this.mode === value) opt.selected = true;
                mode_select.appendChild(opt);
            };
            add_mode_opt('audits', t('backup_filter_mode_audits'));
            add_mode_opt('rulefiles', t('backup_filter_mode_rulefiles'));
            mode_select.addEventListener('change', (e: any) => {
                void this._handle_mode_change((e?.target?.value as BackupMode) || 'audits');
            });
            mode_wrapper.appendChild(mode_select);
            filter_section.appendChild(mode_wrapper);

            const search_wrapper = this.Helpers.create_element('div', { class_name: 'backup-filter-search' });
            search_wrapper.appendChild(this.Helpers.create_element('label', {
                text_content: this.mode === 'audits' ? t('backup_filter_search_label') : t('backup_rulefile_filter_search_label'),
                attributes: { for: 'backup-filter-search-input' }
            }));
            const current_text = this.mode === 'audits' ? this.audits.filter_text : this.rulefiles.filter_text;
            const search_input = this.Helpers.create_element('input', { attributes: { id: 'backup-filter-search-input', type: 'text', value: current_text } });
            search_input.addEventListener('input', (ev: any) => {
                const next_text = ev?.target?.value || '';
                if (this.mode === 'audits') {
                    this.audits.filter_text = next_text;
                    this.audits.apply_filters();
                } else {
                    this.rulefiles.filter_text = next_text;
                    this.rulefiles.apply_filters();
                }
                this._refresh_backup_overview_table_only();
            });
            search_wrapper.appendChild(search_input);
            filter_section.appendChild(search_wrapper);

            const status_wrapper = this.Helpers.create_element('div', { class_name: 'backup-filter-status' });
            status_wrapper.appendChild(this.Helpers.create_element('label', {
                text_content: this.mode === 'audits' ? t('backup_filter_status_label') : t('backup_rulefile_filter_kind_label'),
                attributes: { for: 'backup-filter-status-select' }
            }));
            const status_select = this.Helpers.create_element('select', { attributes: { id: 'backup-filter-status-select', name: 'backup-status-filter' } });
            const add_opt = (value: string, label: string) => {
                const opt = this.Helpers.create_element('option', { text_content: label, attributes: { value } });
                const current_val = this.mode === 'audits' ? this.audits.status_filter : this.rulefiles.rulefile_kind;
                if (current_val === value) opt.selected = true;
                status_select.appendChild(opt);
            };

            if (this.mode === 'audits') {
                add_opt('all', t('backup_filter_status_all'));
                add_opt('in_progress', this.audits.get_status_label('in_progress'));
                add_opt('not_started', this.audits.get_status_label('not_started'));
                add_opt('locked', this.audits.get_status_label('locked'));
                add_opt('archived', this.audits.get_status_label('archived'));
                add_opt('deleted', t('backup_status_deleted'));
            } else {
                add_opt('all', t('backup_rulefile_filter_kind_all'));
                add_opt('published', t('backup_rulefile_filter_kind_published'));
                add_opt('working', t('backup_rulefile_filter_kind_working'));
            }
            status_wrapper.appendChild(status_select);
            filter_section.appendChild(status_wrapper);

            filter_section.addEventListener('change', (ev: Event) => {
                const el = ev.target as HTMLElement | null;
                if (!el || el.id !== 'backup-filter-status-select') return;
                const v = (el as HTMLSelectElement).value;
                if (this.mode === 'audits') {
                    this.audits.status_filter = v || 'all';
                    this.audits.apply_filters();
                } else {
                    this.rulefiles.rulefile_kind = (v as RulefileKind) || 'all';
                    this.rulefiles.apply_filters();
                }
                this._refresh_backup_overview_table_only();
            });

            plate.appendChild(filter_section);

            const overview_section = this.Helpers.create_element('section', { class_name: 'backup-overview-section' });
            overview_section.appendChild(this.Helpers.create_element('h2', {
                attributes: { id: 'backup-overview-section-heading' },
                text_content: this._format_backup_overview_heading()
            }));
            const overview_table_root = this.Helpers.create_element('div', { class_name: 'backup-overview-table-root' });
            overview_section.appendChild(overview_table_root);
            if (this.mode === 'audits') {
                this.audits.render_audits_overview({ root: overview_table_root });
            } else {
                this.rulefiles.render_rulefiles_overview({ root: overview_table_root });
            }
            plate.appendChild(overview_section);
        }

        if (this.view_name === 'backup_detail') {
            await this.audits.load_data();
            const detail_section = this.Helpers.create_element('section', { class_name: 'backup-detail-section' });
            detail_section.appendChild(this.Helpers.create_element('h1', { id: 'main-content-heading', text_content: t('backup_detail_heading'), attributes: { tabindex: '-1' } }));
            const detail_table_root = this.Helpers.create_element('div', { class_name: 'backup-detail-table-root' });
            detail_section.appendChild(detail_table_root);
            this.audits.render_audit_detail({ root: detail_table_root });
            const back_btn = this.Helpers.create_element('button', { class_name: ['button', 'button-secondary'], text_content: t('backup_detail_back_to_list'), attributes: { type: 'button' } });
            back_btn.addEventListener('click', () => this.router('backup', {}));
            detail_section.appendChild(back_btn);
            plate.appendChild(detail_section);
        }

        if (this.view_name === 'backup_rulefile_detail') {
            await this.rulefiles.load_data();
            const detail_section = this.Helpers.create_element('section', { class_name: 'backup-detail-section' });
            detail_section.appendChild(this.Helpers.create_element('h1', { id: 'main-content-heading', text_content: t('backup_rulefile_detail_heading'), attributes: { tabindex: '-1' } }));

            const detail_table_root = this.Helpers.create_element('div', { class_name: 'backup-detail-table-root' });
            detail_section.appendChild(detail_table_root);
            this.rulefiles.render_rulefile_detail({ root: detail_table_root });
            const back_btn = this.Helpers.create_element('button', { class_name: ['button', 'button-secondary'], text_content: t('backup_detail_back_to_list'), attributes: { type: 'button' } });
            back_btn.addEventListener('click', () => this.router('backup', {}));
            detail_section.appendChild(back_btn);
            plate.appendChild(detail_section);
        }

        this.root.appendChild(plate);
    }
}


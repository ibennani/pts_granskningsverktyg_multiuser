export const AuditActionsViewComponent = {
    CSS_PATH: 'css/components/audit_actions_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;

        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.ExportLogic = deps.ExportLogic;

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }

        this.handle_lock_audit = this.handle_lock_audit.bind(this);
        this.handle_unlock_audit = this.handle_unlock_audit.bind(this);
        this.handle_export_csv = this.handle_export_csv.bind(this);
        this.handle_export_excel = this.handle_export_excel.bind(this);
        this.handle_export_word = this.handle_export_word.bind(this);
        this.handle_export_word_samples = this.handle_export_word_samples.bind(this);
        this.handle_export_html = this.handle_export_html.bind(this);
    },

    handle_lock_audit() {
        const t = this.Translation.t;
        this.dispatch({ type: this.StoreActionTypes.SET_AUDIT_STATUS, payload: { status: 'locked' } });
        this.NotificationComponent.show_global_message(t('audit_locked_successfully'), 'success');
    },

    handle_unlock_audit() {
        const t = this.Translation.t;
        this.dispatch({ type: this.StoreActionTypes.SET_AUDIT_STATUS, payload: { status: 'in_progress' } });
        this.NotificationComponent.show_global_message(t('audit_unlocked_successfully'), 'success');
    },

    handle_export_csv() {
        const current_state = this.getState();
        if (this.ExportLogic?.export_to_csv) {
            this.ExportLogic.export_to_csv(current_state);
        }
    },

    handle_export_excel() {
        const current_state = this.getState();
        if (this.ExportLogic?.export_to_excel) {
            this.ExportLogic.export_to_excel(current_state);
        }
    },

    handle_export_word() {
        const current_state = this.getState();
        if (this.ExportLogic?.export_to_word_criterias) {
            this.ExportLogic.export_to_word_criterias(current_state);
        }
    },

    handle_export_word_samples() {
        const current_state = this.getState();
        if (this.ExportLogic?.export_to_word_samples) {
            this.ExportLogic.export_to_word_samples(current_state);
        }
    },

    async handle_export_html() {
        const t = this.Translation.t;
        const current_state = this.getState();
        if (!this.ExportLogic?.export_to_html) return;
        try {
            await this.ExportLogic.export_to_html(current_state);
        } catch (error) {
            this.NotificationComponent.show_global_message(`${t('error_exporting_html')} ${error?.message || ''}`.trim(), 'error');
        }
    },

    create_action_button({ label, on_click, variant = 'button-default', icon_name = null }) {
        const icon = (icon_name && this.Helpers.get_icon_svg)
            ? this.Helpers.get_icon_svg(icon_name, ['currentColor'], 18)
            : '';

        return this.Helpers.create_element('button', {
            class_name: ['button', variant],
            html_content: `<span>${label}</span>${icon}`,
            event_listeners: { click: on_click }
        });
    },

    create_export_item({ label, description, on_click }) {
        const wrapper = this.Helpers.create_element('div', { class_name: 'audit-actions__export-item' });
        wrapper.appendChild(this.create_action_button({
            label,
            on_click,
            variant: 'button-default',
            icon_name: 'export'
        }));
        wrapper.appendChild(this.Helpers.create_element('p', {
            class_name: 'audit-actions__export-description',
            text_content: description
        }));
        return wrapper;
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';

        const state = this.getState();
        if (!state?.ruleFileContent) {
            const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
            plate.appendChild(this.Helpers.create_element('h1', { text_content: t('audit_actions_title') }));
            plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_no_active_audit') }));
            this.root.appendChild(plate);
            return;
        }

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
        plate.appendChild(this.Helpers.create_element('h1', { text_content: t('audit_actions_title') }));

        // Statusåtgärder
        const status_section = this.Helpers.create_element('section', {});
        status_section.appendChild(this.Helpers.create_element('h2', { class_name: 'audit-actions__section-title', text_content: t('audit_actions_status_section_title') }));

        const status_actions = this.Helpers.create_element('div', { class_name: ['form-actions'] });
        if (state.auditStatus === 'locked') {
            status_actions.appendChild(this.create_action_button({
                label: t('unlock_audit'),
                on_click: this.handle_unlock_audit,
                variant: 'button-primary',
                icon_name: 'unlock_audit'
            }));
        } else if (state.auditStatus === 'in_progress') {
            status_actions.appendChild(this.create_action_button({
                label: t('lock_audit'),
                on_click: this.handle_lock_audit,
                variant: 'button-primary',
                icon_name: 'lock_audit'
            }));
        }

        status_actions.appendChild(this.create_action_button({
            label: t('update_rulefile_button'),
            on_click: () => this.router('update_rulefile'),
            variant: 'button-default',
            icon_name: 'update'
        }));

        const updated_reqs_count = (state.samples || [])
            .flatMap(s => Object.values(s.requirementResults || {}))
            .filter(r => r.needsReview === true)
            .length;

        if (updated_reqs_count > 0) {
            status_actions.appendChild(this.create_action_button({
                label: t('handle_updated_assessments', { count: updated_reqs_count }),
                on_click: () => this.router('confirm_updates'),
                variant: 'button-info',
                icon_name: 'info'
            }));
        }

        status_section.appendChild(status_actions);
        plate.appendChild(status_section);

        // Export
        const export_section = this.Helpers.create_element('section', { class_name: 'audit-actions__export-section' });
        export_section.appendChild(this.Helpers.create_element('h2', { class_name: 'audit-actions__section-title', text_content: t('audit_actions_exports_title') }));

        if (state.auditStatus !== 'locked') {
            export_section.appendChild(this.Helpers.create_element('p', {
                class_name: 'audit-actions__section-lead',
                text_content: t('audit_not_locked_for_export', { status: state.auditStatus })
            }));
        } else {
            const export_actions = this.Helpers.create_element('div', { class_name: 'audit-actions__export-list' });
            if (this.ExportLogic?.export_to_csv) {
                export_actions.appendChild(this.create_export_item({
                    label: t('export_to_csv'),
                    description: t('audit_actions_export_csv_description'),
                    on_click: this.handle_export_csv
                }));
            }
            if (this.ExportLogic?.export_to_excel) {
                export_actions.appendChild(this.create_export_item({
                    label: t('export_to_excel'),
                    description: t('audit_actions_export_excel_description'),
                    on_click: this.handle_export_excel
                }));
            }
            if (this.ExportLogic?.export_to_word_criterias) {
                export_actions.appendChild(this.create_export_item({
                    label: t('export_to_word'),
                    description: t('audit_actions_export_word_requirements_description'),
                    on_click: this.handle_export_word
                }));
            }
            if (this.ExportLogic?.export_to_word_samples) {
                export_actions.appendChild(this.create_export_item({
                    label: t('export_to_word_samples'),
                    description: t('audit_actions_export_word_samples_description'),
                    on_click: this.handle_export_word_samples
                }));
            }
            if (this.ExportLogic?.export_to_html) {
                export_actions.appendChild(this.create_export_item({
                    label: t('export_to_html'),
                    description: t('audit_actions_export_html_description'),
                    on_click: this.handle_export_html
                }));
            }
            export_section.appendChild(export_actions);
        }

        plate.appendChild(export_section);
        this.root.appendChild(plate);
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
    }
};


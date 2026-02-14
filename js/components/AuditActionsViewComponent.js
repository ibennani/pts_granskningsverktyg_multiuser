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
        this.AuditLogic = deps.AuditLogic;

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }

        this.handle_lock_audit = this.handle_lock_audit.bind(this);
        this.handle_mark_all_unreviewed_as_passed = this.handle_mark_all_unreviewed_as_passed.bind(this);
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

    count_unreviewed_requirements() {
        const state = this.getState();
        if (!state?.ruleFileContent?.requirements || !state?.samples?.length || !this.AuditLogic) {
            return { req_count: 0, sample_count: 0 };
        }
        let req_count = 0;
        let samples_with_unreviewed = 0;
        (state.samples || []).forEach(sample => {
            let sample_has_unreviewed = false;
            const relevant_reqs = this.AuditLogic.get_relevant_requirements_for_sample(state.ruleFileContent, sample);
            relevant_reqs.forEach(req_def => {
                const req_key = req_def.key || req_def.id;
                const existing = (sample.requirementResults || {})[req_key];
                const status = this.AuditLogic.calculate_requirement_status(req_def, existing);
                if (status === 'not_audited' || status === 'partially_audited') {
                    req_count++;
                    sample_has_unreviewed = true;
                }
            });
            if (sample_has_unreviewed) samples_with_unreviewed++;
        });
        return { req_count, sample_count: samples_with_unreviewed };
    },

    handle_mark_all_unreviewed_as_passed(event) {
        const t = this.Translation.t;
        const { req_count, sample_count } = this.count_unreviewed_requirements();
        if (req_count === 0) return;

        const trigger_button = event?.currentTarget || null;
        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;

        ModalComponent.show(
            {
                h1_text: t('mark_all_unreviewed_passed_confirm_title'),
                message_text: ''
            },
            (container, modal) => {
                const msg_wrapper = this.Helpers.create_element('div', { class_name: 'modal-message-block' });
                const p1 = this.Helpers.create_element('p', {
                    text_content: t('mark_all_unreviewed_passed_confirm_p1', { req_count, sample_count })
                });
                const p2 = this.Helpers.create_element('p', {
                    text_content: t('mark_all_unreviewed_passed_confirm_p2')
                });
                const p3 = this.Helpers.create_element('p', {
                    text_content: t('mark_all_unreviewed_passed_confirm_p3')
                });
                const p4 = this.Helpers.create_element('p', {
                    text_content: t('mark_all_unreviewed_passed_confirm_p4')
                });
                msg_wrapper.append(p1, p2, p3, p4);
                const existing_msg = container.querySelector('.modal-message');
                if (existing_msg) existing_msg.replaceWith(msg_wrapper);

                const actions_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const yes_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('mark_all_unreviewed_passed_confirm_yes')
                });
                yes_btn.addEventListener('click', () => {
                    modal.close(trigger_button);
                    this.dispatch({ type: this.StoreActionTypes.MARK_ALL_UNREVIEWED_AS_PASSED });
                    this.NotificationComponent.show_global_message(t('mark_all_unreviewed_passed_toast'), 'success');
                    this.render();
                });
                const no_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('mark_all_unreviewed_passed_confirm_no')
                });
                no_btn.addEventListener('click', () => modal.close(trigger_button));
                actions_wrapper.append(yes_btn, no_btn);
                container.appendChild(actions_wrapper);
            }
        );
    },

    create_action_button({ label, on_click, variant = 'button-default', icon_name = null, id = null, aria_describedby = null }) {
        const icon = (icon_name && this.Helpers.get_icon_svg)
            ? this.Helpers.get_icon_svg(icon_name, ['currentColor'], 18)
            : '';

        const attributes = {};
        if (id) attributes.id = id;
        if (aria_describedby) attributes['aria-describedby'] = aria_describedby;

        return this.Helpers.create_element('button', {
            class_name: ['button', variant],
            html_content: `<span>${label}</span>${icon}`,
            attributes,
            event_listeners: { click: on_click }
        });
    },

    create_export_item({ label, description, on_click, id_suffix }) {
        const btn_id = id_suffix ? `audit-action-btn-${id_suffix}` : null;
        const desc_id = id_suffix ? `audit-action-desc-${id_suffix}` : null;

        const wrapper = this.Helpers.create_element('div', {
            class_name: 'audit-actions__export-item',
            attributes: btn_id ? { role: 'group', 'aria-labelledby': btn_id } : {}
        });
        wrapper.appendChild(this.create_action_button({
            label,
            on_click,
            variant: 'button-default',
            icon_name: 'export',
            id: btn_id,
            aria_describedby: desc_id || undefined
        }));
        const desc_el = this.Helpers.create_element('p', {
            class_name: 'audit-actions__export-description',
            text_content: description,
            attributes: desc_id ? { id: desc_id } : {}
        });
        wrapper.appendChild(desc_el);
        return wrapper;
    },

    create_status_action_item({ label, description, on_click, variant = 'button-default', icon_name = null, id_suffix }) {
        const btn_id = id_suffix ? `audit-action-btn-${id_suffix}` : null;
        const desc_id = id_suffix ? `audit-action-desc-${id_suffix}` : null;

        const wrapper = this.Helpers.create_element('div', {
            class_name: 'audit-actions__status-item',
            attributes: btn_id ? { role: 'group', 'aria-labelledby': btn_id } : {}
        });
        wrapper.appendChild(this.create_action_button({
            label,
            on_click,
            variant,
            icon_name,
            id: btn_id,
            aria_describedby: desc_id || undefined
        }));
        const desc_el = this.Helpers.create_element('p', {
            class_name: 'audit-actions__status-description',
            text_content: description,
            attributes: desc_id ? { id: desc_id } : {}
        });
        wrapper.appendChild(desc_el);
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

        const status_actions = this.Helpers.create_element('div', { class_name: 'audit-actions__status-list' });

        if (state.auditStatus !== 'locked') {
            status_actions.appendChild(this.create_status_action_item({
                label: t('update_rulefile_button'),
                description: t('audit_actions_update_rulefile_description'),
                on_click: () => this.router('update_rulefile'),
                variant: 'button-default',
                icon_name: 'update',
                id_suffix: 'update-rulefile'
            }));
        }

        const { req_count: unreviewed_count } = this.count_unreviewed_requirements();
        if (state.auditStatus === 'in_progress' && unreviewed_count > 0) {
            status_actions.appendChild(this.create_status_action_item({
                label: t('mark_all_unreviewed_passed_button'),
                description: t('mark_all_unreviewed_passed_description'),
                on_click: this.handle_mark_all_unreviewed_as_passed,
                variant: 'button-default',
                icon_name: 'check',
                id_suffix: 'mark-all-unreviewed'
            }));
        }

        if (state.auditStatus === 'locked') {
            status_actions.appendChild(this.create_status_action_item({
                label: t('unlock_audit'),
                description: t('audit_actions_unlock_audit_description'),
                on_click: this.handle_unlock_audit,
                variant: 'button-primary',
                icon_name: 'unlock_audit',
                id_suffix: 'unlock-audit'
            }));
        } else if (state.auditStatus === 'in_progress') {
            status_actions.appendChild(this.create_status_action_item({
                label: t('lock_audit'),
                description: t('audit_actions_lock_audit_description'),
                on_click: this.handle_lock_audit,
                variant: 'button-primary',
                icon_name: 'lock_audit',
                id_suffix: 'lock-audit'
            }));
        }

        const updated_reqs_count = (state.samples || [])
            .flatMap(s => Object.values(s.requirementResults || {}))
            .filter(r => r.needsReview === true)
            .length;

        if (updated_reqs_count > 0) {
            status_actions.appendChild(this.create_status_action_item({
                label: t('handle_updated_assessments', { count: updated_reqs_count }),
                description: t('audit_actions_handle_updated_description'),
                on_click: () => this.router('confirm_updates'),
                variant: 'button-info',
                icon_name: 'info',
                id_suffix: 'handle-updated'
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
                    on_click: this.handle_export_csv,
                    id_suffix: 'export-csv'
                }));
            }
            if (this.ExportLogic?.export_to_excel) {
                export_actions.appendChild(this.create_export_item({
                    label: t('export_to_excel'),
                    description: t('audit_actions_export_excel_description'),
                    on_click: this.handle_export_excel,
                    id_suffix: 'export-excel'
                }));
            }
            if (this.ExportLogic?.export_to_word_criterias) {
                export_actions.appendChild(this.create_export_item({
                    label: t('export_to_word'),
                    description: t('audit_actions_export_word_requirements_description'),
                    on_click: this.handle_export_word,
                    id_suffix: 'export-word-reqs'
                }));
            }
            if (this.ExportLogic?.export_to_word_samples) {
                export_actions.appendChild(this.create_export_item({
                    label: t('export_to_word_samples'),
                    description: t('audit_actions_export_word_samples_description'),
                    on_click: this.handle_export_word_samples,
                    id_suffix: 'export-word-samples'
                }));
            }
            if (this.ExportLogic?.export_to_html) {
                export_actions.appendChild(this.create_export_item({
                    label: t('export_to_html'),
                    description: t('audit_actions_export_html_description'),
                    on_click: this.handle_export_html,
                    id_suffix: 'export-html'
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


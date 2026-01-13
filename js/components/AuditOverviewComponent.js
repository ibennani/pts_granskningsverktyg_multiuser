import { SampleListComponent } from './SampleListComponent.js';
import { ScoreAnalysisComponent } from './ScoreAnalysisComponent.js';
import { AuditInfoComponent } from './AuditInfoComponent.js';
import { ProgressBarComponent } from './ProgressBarComponent.js';
import "../../css/components/audit_overview_component.css";

export const AuditOverviewComponent = {
    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;

        // Extract dependencies for easier access
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.subscribe = deps.subscribe;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.ExportLogic = deps.ExportLogic;
        this.AuditLogic = deps.AuditLogic;

        // Internal state
        this.unsubscribe_from_store_function = null;
        this.sample_list_container_element = null;
        this.audit_info_container_element = null;
        this.scoreAnalysisContainerElement = null;
        this.previously_focused_element = null;

        this.global_message_element_ref = this.NotificationComponent.get_global_message_element_reference();

        // Bind methods
        this.handle_store_update = this.handle_store_update.bind(this);
        this.handle_edit_sample_request_from_list = this.handle_edit_sample_request_from_list.bind(this);
        this.handle_delete_sample_request_from_list = this.handle_delete_sample_request_from_list.bind(this);
        this.handle_lock_audit = this.handle_lock_audit.bind(this);
        this.handle_unlock_audit = this.handle_unlock_audit.bind(this);
        this.handle_export_csv = this.handle_export_csv.bind(this);
        this.handle_export_excel = this.handle_export_excel.bind(this);
        this.handle_export_word = this.handle_export_word.bind(this);
        this.handle_export_to_word_samples = this.handle_export_to_word_samples.bind(this);

        await this.init_sub_components();

        if (!this.unsubscribe_from_store_function && typeof this.subscribe === 'function') {
            this.unsubscribe_from_store_function = this.subscribe(this.handle_store_update);
        }
    },

    async init_sub_components() {
        this.audit_info_container_element = this.Helpers.create_element('div', { id: 'audit-info-component-container', class_name: 'dashboard-panel' });
        await AuditInfoComponent.init({
            root: this.audit_info_container_element,
            deps: {
                router: this.router,
                getState: this.getState,
                Translation: this.Translation,
                Helpers: this.Helpers
            }
        });

        this.sample_list_container_element = this.Helpers.create_element('div', { id: 'overview-sample-list-area-container' });
        await SampleListComponent.init({
            root: this.sample_list_container_element,
            deps: {
                on_edit: this.handle_edit_sample_request_from_list,
                on_delete: this.handle_delete_sample_request_from_list,
                router: this.router,
                getState: this.getState,
                Translation: this.Translation,
                Helpers: this.Helpers,
                AuditLogic: this.AuditLogic
            }
        });

        this.scoreAnalysisContainerElement = this.Helpers.create_element('div', { id: 'score-analysis-component-container' });
        await ScoreAnalysisComponent.init({
            root: this.scoreAnalysisContainerElement,
            deps: {
                Helpers: this.Helpers,
                Translation: this.Translation,
                getState: this.getState,
                ScoreCalculator: window.ScoreCalculator // ScoreCalculator seems to be global, or we could look for it in deps if main.js passes it
            }
        });
    },

    handle_edit_sample_request_from_list(sample_id) {
        this.router('sample_form', { editSampleId: sample_id });
    },

    handle_delete_sample_request_from_list(sample_id) {
        const t = this.Translation.t;
        const current_global_state = this.getState();

        if (current_global_state.samples.length <= 1) {
            this.NotificationComponent.show_global_message(t('error_cannot_delete_last_sample'), "warning");
            return;
        }

        const sample_to_delete = current_global_state.samples.find(s => s.id === sample_id);
        const sample_name_for_confirm = sample_to_delete ? this.Helpers.escape_html(sample_to_delete.description) : sample_id;

        this.previously_focused_element = document.activeElement;

        if (confirm(t('confirm_delete_sample', { sampleName: sample_name_for_confirm }))) {
            this.dispatch({
                type: this.StoreActionTypes.DELETE_SAMPLE,
                payload: { sampleId: sample_id }
            });
            this.NotificationComponent.show_global_message(t('sample_deleted_successfully', { sampleName: sample_name_for_confirm }), "success");
        } else {
            if (this.previously_focused_element) {
                this.previously_focused_element.focus();
                this.previously_focused_element = null;
            }
        }
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
        const t = this.Translation.t;
        const current_global_state = this.getState();
        if (current_global_state.auditStatus !== 'locked') {
            this.NotificationComponent.show_global_message(t('audit_not_locked_for_export', { status: current_global_state.auditStatus }), 'warning');
            return;
        }
        if (this.ExportLogic?.export_to_csv) {
            this.ExportLogic.export_to_csv(current_global_state);
        }
    },

    handle_export_excel() {
        const t = this.Translation.t;
        const current_global_state = this.getState();
        if (current_global_state.auditStatus !== 'locked') {
            this.NotificationComponent.show_global_message(t('audit_not_locked_for_export', { status: current_global_state.auditStatus }), 'warning');
            return;
        }
        if (this.ExportLogic?.export_to_excel) {
            this.ExportLogic.export_to_excel(current_global_state);
        }
    },

    handle_export_word() {
        console.log('[AuditOverview] handle_export_word called');
        const t = this.Translation.t;
        const current_global_state = this.getState();
        console.log('[AuditOverview] Current audit status:', current_global_state.auditStatus);
        if (current_global_state.auditStatus !== 'locked') {
            console.log('[AuditOverview] Audit not locked, showing warning');
            this.NotificationComponent.show_global_message(t('audit_not_locked_for_export', { status: current_global_state.auditStatus }), 'warning');
            return;
        }
        console.log('[AuditOverview] Calling ExportLogic_export_to_word');
        if (this.ExportLogic?.export_to_word) {
            this.ExportLogic.export_to_word(current_global_state);
        }
    },

    handle_export_to_word_samples() {
        const t = this.Translation.t;
        const current_global_state = this.getState();
        if (current_global_state.auditStatus !== 'locked') {
            this.NotificationComponent.show_global_message(t('audit_not_locked_for_export', { status: current_global_state.auditStatus }), 'warning');
            return;
        }
        if (this.ExportLogic?.export_to_word_samples) {
            this.ExportLogic.export_to_word_samples(current_global_state);
        }
    },

    handle_store_update(new_state) {
        // Handled by main.js subscription triggering render()
    },

    create_actions_bar(state) {
        const t = this.Translation.t;
        const actions_div = this.Helpers.create_element('div', { class_name: 'audit-overview-actions' });

        if (state.auditStatus === 'locked') {
            // Custom layout for locked state: vertical stack
            // Row 1: Unlock button (Primary)
            // Row 2: Export buttons
            
            // Override default flex styles for this state if needed, or rely on rows
            actions_div.style.flexDirection = 'column';
            actions_div.style.alignItems = 'flex-start';
            
            // Row 1
            const row1 = this.Helpers.create_element('div', { 
                class_name: 'action-row-primary',
                style: { width: '100%' } 
            });
            
            row1.appendChild(this.Helpers.create_element('button', {
                class_name: ['button', 'button-primary'], // Changed from secondary to primary
                html_content: `<span>${t('unlock_audit')}</span>` + this.Helpers.get_icon_svg('unlock_audit', ['currentColor'], 18),
                event_listeners: { click: this.handle_unlock_audit }
            }));
            
            actions_div.appendChild(row1);

            // Row 2
            const row2 = this.Helpers.create_element('div', { 
                class_name: 'action-row-exports',
                style: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', width: '100%' }
            });

            if (this.ExportLogic?.export_to_csv) {
                row2.appendChild(this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    html_content: `<span>${t('export_to_csv')}</span>` + this.Helpers.get_icon_svg('export', ['currentColor'], 18),
                    event_listeners: { click: this.handle_export_csv }
                }));
            }
            if (this.ExportLogic?.export_to_excel) {
                row2.appendChild(this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    html_content: `<span>${t('export_to_excel')}</span>` + this.Helpers.get_icon_svg('export', ['currentColor'], 18),
                    event_listeners: { click: this.handle_export_excel }
                }));
            }
            if (this.ExportLogic?.export_to_word) {
                const word_export_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    html_content: `<span>${t('export_to_word')}</span>` + this.Helpers.get_icon_svg('export', ['currentColor'], 18),
                    event_listeners: { click: this.handle_export_word }
                });
                row2.appendChild(word_export_button);
            }
            
            if (this.ExportLogic?.export_to_word_samples) {
                const text_export_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    html_content: `<span>${t('export_to_word_samples')}</span>` + this.Helpers.get_icon_svg('export', ['currentColor'], 18),
                    event_listeners: { click: this.handle_export_to_word_samples }
                });
                row2.appendChild(text_export_button);
            }

            actions_div.appendChild(row2);

        } else {
            // Default layout for in_progress
            const left_group = this.Helpers.create_element('div', { class_name: 'action-group-left' });
            const right_group = this.Helpers.create_element('div', { class_name: 'action-group-right' });

            if (state.auditStatus === 'in_progress') {
                left_group.appendChild(this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    html_content: `<span>${t('update_rulefile_button')}</span>` + this.Helpers.get_icon_svg('update', ['currentColor'], 18),
                    event_listeners: { click: () => this.router('update_rulefile') }
                }));

                const updated_reqs_count = state.samples.flatMap(s => Object.values(s.requirementResults || {})).filter(r => r.needsReview === true).length;
                if (updated_reqs_count > 0) {
                    left_group.appendChild(this.Helpers.create_element('button', {
                        class_name: ['button', 'button-info'],
                        html_content: `<span>${t('handle_updated_assessments', { count: updated_reqs_count })}</span>` + this.Helpers.get_icon_svg('info', ['currentColor'], 18),
                        event_listeners: { click: () => this.router('confirm_updates') }
                    }));
                }

                right_group.appendChild(this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    html_content: `<span>${t('lock_audit')}</span>` + this.Helpers.get_icon_svg('lock_audit', ['currentColor'], 18),
                    event_listeners: { click: this.handle_lock_audit }
                }));
            }

            if (left_group.hasChildNodes()) actions_div.appendChild(left_group);
            if (right_group.hasChildNodes()) actions_div.appendChild(right_group);
        }

        return actions_div;
    },

    render() {
        const t = this.Translation.t;
        this.root.innerHTML = '';

        const current_global_state = this.getState();

        if (!current_global_state || !current_global_state.ruleFileContent) {
            // Anropa inte NotificationComponent här om elementet inte är redo eller root är fel
            if (this.root) {
                this.root.innerHTML = '';
                const error_div = this.Helpers.create_element('div', { class_name: 'content-plate' });
                error_div.textContent = t("error_no_active_audit");
                this.root.appendChild(error_div);
            }
            return;
        }

        const plate_element = this.Helpers.create_element('div', { class_name: 'content-plate audit-overview-plate' });
        this.root.appendChild(plate_element);

        if (this.global_message_element_ref) {
            plate_element.appendChild(this.global_message_element_ref);
        }
        plate_element.appendChild(this.Helpers.create_element('h1', { text_content: t('audit_overview_title') }));

        const dashboard_container = this.Helpers.create_element('div', { class_name: 'overview-dashboard' });

        if (this.audit_info_container_element) {
            dashboard_container.appendChild(this.audit_info_container_element);
            AuditInfoComponent.render();
        }

        const score_panel = this.Helpers.create_element('div', { class_name: ['dashboard-panel', 'score-panel'] });
        score_panel.appendChild(this.Helpers.create_element('h2', {
            class_name: 'dashboard-panel__title',
            text_content: t('result_summary_and_deficiency_analysis', { defaultValue: "Result Summary" })
        }));

        const progress_data = this.AuditLogic.calculate_overall_audit_progress(current_global_state);
        const lang_code = this.Translation.get_current_language_code();
        const percentage = (progress_data.total > 0) ? (progress_data.audited / progress_data.total) * 100 : 0;
        const formatted_percentage = this.Helpers.format_number_locally(percentage, lang_code, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const valueText = `${progress_data.audited} / ${progress_data.total} (${formatted_percentage} %)`;

        score_panel.appendChild(this.Helpers.create_element('h3', {
            class_name: 'dashboard-panel__subtitle',
            text_content: t('total_audit_progress_header', { defaultValue: "Klart hittills" })
        }));
        const progress_container = this.Helpers.create_element('div', { class_name: 'info-item--progress-container' });
        progress_container.appendChild(this.Helpers.create_element('p', { class_name: 'progress-text-wrapper', html_content: `<strong>${t('total_requirements_audited_label')}:</strong><span class="value">${valueText}</span>` }));

        if (ProgressBarComponent) {
            progress_container.appendChild(ProgressBarComponent.create(progress_data.audited, progress_data.total));
        }
        score_panel.appendChild(progress_container);

        const divider = this.Helpers.create_element('div', {
            style: {
                borderBottom: '1px dashed var(--secondary-color)',
                margin: '1.5rem 0'
            }
        });
        score_panel.appendChild(divider);

        if (this.scoreAnalysisContainerElement) {
            score_panel.appendChild(this.scoreAnalysisContainerElement);
            ScoreAnalysisComponent.render();
        }
        dashboard_container.appendChild(score_panel);

        plate_element.appendChild(dashboard_container);

        const top_actions_section = this.Helpers.create_element('section', { class_name: 'audit-overview-section' });
        top_actions_section.appendChild(this.Helpers.create_element('h2', { text_content: t('audit_actions_title') }));
        top_actions_section.appendChild(this.create_actions_bar(current_global_state));
        plate_element.appendChild(top_actions_section);

        const sample_section = this.Helpers.create_element('section', { class_name: 'audit-overview-section' });
        const sample_management_header_div = this.Helpers.create_element('div', { class_name: 'sample-list-header' });
        const number_of_samples = current_global_state.samples ? current_global_state.samples.length : 0;
        sample_management_header_div.appendChild(this.Helpers.create_element('h2', { text_content: t('sample_list_title_with_count', { count: number_of_samples }) }));
        if (current_global_state.auditStatus === 'in_progress') {
            const add_sample_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default', 'button-small'],
                html_content: `<span>${t('add_new_sample')}</span>` + this.Helpers.get_icon_svg('add', ['currentColor'], 18)
            });
            add_sample_button.addEventListener('click', () => { this.router('sample_form'); });
            sample_management_header_div.appendChild(add_sample_button);
        }
        sample_section.appendChild(sample_management_header_div);
        if (this.sample_list_container_element) {
            sample_section.appendChild(this.sample_list_container_element);
            SampleListComponent.render();
        }
        plate_element.appendChild(sample_section);

        const bottom_actions_section = this.Helpers.create_element('section', { class_name: 'audit-overview-section' });
        bottom_actions_section.appendChild(this.Helpers.create_element('h2', { text_content: t('audit_actions_title') }));
        bottom_actions_section.appendChild(this.create_actions_bar(current_global_state));
        plate_element.appendChild(bottom_actions_section);
    },

    destroy() {
        if (this.unsubscribe_from_store_function) {
            this.unsubscribe_from_store_function();
            this.unsubscribe_from_store_function = null;
        }
        SampleListComponent.destroy();
        AuditInfoComponent.destroy();
        ScoreAnalysisComponent.destroy();

        this.sample_list_container_element = null;
        this.scoreAnalysisContainerElement = null;
        this.audit_info_container_element = null;
        this.previously_focused_element = null;

        this.root = null;
        this.deps = null;
        // clear other deps
    }
};

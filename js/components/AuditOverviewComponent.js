// js/components/AuditOverviewComponent.js
import { SampleListComponent } from './SampleListComponent.js';
import { ScoreAnalysisComponent } from './ScoreAnalysisComponent.js';
import { AuditInfoComponent } from './AuditInfoComponent.js'; 

export const AuditOverviewComponent = (function () {
    'use-strict';

    const CSS_PATH = './css/components/audit_overview_component.css';
    let app_container_ref;
    let router_ref;

    let local_getState;
    let local_dispatch;
    let local_StoreActionTypes;
    let local_subscribe_func;

    // Dependencies
    let Translation_t;
    let Helpers_create_element, Helpers_get_icon_svg, Helpers_format_iso_to_local_datetime, Helpers_escape_html, Helpers_load_css, Helpers_add_protocol_if_missing, Helpers_format_number_locally;
    let NotificationComponent_show_global_message, NotificationComponent_clear_global_message, NotificationComponent_get_global_message_element_reference;
    let ExportLogic_export_to_csv, ExportLogic_export_to_excel, ExportLogic_export_to_word;
    let AuditLogic_calculate_overall_audit_progress;
    
    let global_message_element_ref;
    let sample_list_component_instance;
    let sample_list_container_element;
    
    let audit_info_component_instance = null;
    let audit_info_container_element = null;
    
    let scoreAnalysisComponentInstance = null;
    let scoreAnalysisContainerElement = null;

    let previously_focused_element = null;
    let unsubscribe_from_store_function = null;
    
    function assign_globals_once() {
        if (Translation_t) return;
        Translation_t = window.Translation?.t;
        Helpers_create_element = window.Helpers?.create_element;
        Helpers_get_icon_svg = window.Helpers?.get_icon_svg;
        Helpers_format_iso_to_local_datetime = window.Helpers?.format_iso_to_local_datetime;
        Helpers_escape_html = window.Helpers?.escape_html;
        Helpers_add_protocol_if_missing = window.Helpers?.add_protocol_if_missing;
        Helpers_load_css = window.Helpers?.load_css;
        Helpers_format_number_locally = window.Helpers?.format_number_locally;
        NotificationComponent_show_global_message = window.NotificationComponent?.show_global_message;
        NotificationComponent_clear_global_message = window.NotificationComponent?.clear_global_message;
        NotificationComponent_get_global_message_element_reference = window.NotificationComponent?.get_global_message_element_reference;
        ExportLogic_export_to_csv = window.ExportLogic?.export_to_csv;
        ExportLogic_export_to_excel = window.ExportLogic?.export_to_excel;
        ExportLogic_export_to_word = window.ExportLogic?.export_to_word;
        AuditLogic_calculate_overall_audit_progress = window.AuditLogic?.calculate_overall_audit_progress;
    }

    function handle_edit_sample_request_from_list(sample_id) {
        router_ref('sample_form', { editSampleId: sample_id });
    }

    function handle_delete_sample_request_from_list(sample_id) {
        const t = Translation_t;
        const current_global_state = local_getState();

        if (current_global_state.samples.length <= 1) {
            NotificationComponent_show_global_message(t('error_cannot_delete_last_sample'), "warning");
            return;
        }

        const sample_to_delete = current_global_state.samples.find(s => s.id === sample_id);
        const sample_name_for_confirm = sample_to_delete ? Helpers_escape_html(sample_to_delete.description) : sample_id;

        previously_focused_element = document.activeElement;

        if (confirm(t('confirm_delete_sample', { sampleName: sample_name_for_confirm }))) {
            local_dispatch({
                type: local_StoreActionTypes.DELETE_SAMPLE,
                payload: { sampleId: sample_id }
            });
            NotificationComponent_show_global_message(t('sample_deleted_successfully', { sampleName: sample_name_for_confirm }), "success");
        } else {
            if (previously_focused_element) {
                previously_focused_element.focus();
                previously_focused_element = null;
            }
        }
    }

    function handle_lock_audit() {
        const t = Translation_t;
        local_dispatch({ type: local_StoreActionTypes.SET_AUDIT_STATUS, payload: { status: 'locked' } });
        NotificationComponent_show_global_message(t('audit_locked_successfully'), 'success');
    }

    function handle_unlock_audit() {
        const t = Translation_t;
        local_dispatch({ type: local_StoreActionTypes.SET_AUDIT_STATUS, payload: { status: 'in_progress' } });
        NotificationComponent_show_global_message(t('audit_unlocked_successfully'), 'success');
    }

    function handle_export_csv() {
        const t = Translation_t;
        const current_global_state = local_getState();
        if (current_global_state.auditStatus !== 'locked') {
            NotificationComponent_show_global_message(t('audit_not_locked_for_export', { status: current_global_state.auditStatus }), 'warning');
            return;
        }
        ExportLogic_export_to_csv(current_global_state);
    }

    function handle_export_excel() {
        const t = Translation_t;
        const current_global_state = local_getState();
        if (current_global_state.auditStatus !== 'locked') {
            NotificationComponent_show_global_message(t('audit_not_locked_for_export', { status: current_global_state.auditStatus }), 'warning');
            return;
        }
        ExportLogic_export_to_excel(current_global_state);
    }

    function handle_export_word() {
        console.log('[AuditOverview] handle_export_word called');
        const t = Translation_t;
        const current_global_state = local_getState();
        console.log('[AuditOverview] Current audit status:', current_global_state.auditStatus);
        if (current_global_state.auditStatus !== 'locked') {
            console.log('[AuditOverview] Audit not locked, showing warning');
            NotificationComponent_show_global_message(t('audit_not_locked_for_export', { status: current_global_state.auditStatus }), 'warning');
            return;
        }
        console.log('[AuditOverview] Calling ExportLogic_export_to_word');
        ExportLogic_export_to_word(current_global_state);
    }

    async function init_sub_components() {
        assign_globals_once();
        
        audit_info_container_element = Helpers_create_element('div', { id: 'audit-info-component-container', class_name: 'dashboard-panel' });
        audit_info_component_instance = AuditInfoComponent;
        await audit_info_component_instance.init(audit_info_container_element, router_ref, local_getState);

        sample_list_container_element = Helpers_create_element('div', { id: 'overview-sample-list-area-container' });
        sample_list_component_instance = SampleListComponent;
        await sample_list_component_instance.init(
            sample_list_container_element,
            { 
                on_edit: handle_edit_sample_request_from_list,
                on_delete: handle_delete_sample_request_from_list
            },
            router_ref,
            local_getState
        );
        
        scoreAnalysisContainerElement = Helpers_create_element('div', { id: 'score-analysis-component-container' });
        scoreAnalysisComponentInstance = ScoreAnalysisComponent;
        
        await scoreAnalysisComponentInstance.init(scoreAnalysisContainerElement, {
            Helpers: window.Helpers,
            Translation: window.Translation,
            getState: local_getState,
            ScoreCalculator: window.ScoreCalculator 
        });
    }

    function handle_store_update(new_state) {
        // Handled by main.js subscription
    }
    
    async function init(_app_container, _router, _params, _getState, _dispatch, _StoreActionTypes, _subscribe) {
        assign_globals_once();
        app_container_ref = _app_container;
        router_ref = _router;
        local_getState = _getState;
        local_dispatch = _dispatch;
        local_StoreActionTypes = _StoreActionTypes;
        local_subscribe_func = _subscribe;
        
        global_message_element_ref = NotificationComponent_get_global_message_element_reference();
        
        await init_sub_components();

        try {
            await window.Helpers.load_css_safely(CSS_PATH, 'AuditOverviewComponent', { 
                timeout: 5000, 
                maxRetries: 2 
            });
        } catch (error) {
            // Fel hanteras redan i load_css_safely med användarvarning
            console.warn('[AuditOverviewComponent] Continuing without CSS due to loading failure');
        }

        if (!unsubscribe_from_store_function && typeof local_subscribe_func === 'function') {
            unsubscribe_from_store_function = local_subscribe_func(handle_store_update);
        }
    }

    function create_actions_bar(state) {
        const t = Translation_t;
        const actions_div = Helpers_create_element('div', { class_name: 'audit-overview-actions' });
        const left_group = Helpers_create_element('div', { class_name: 'action-group-left' });
        const right_group = Helpers_create_element('div', { class_name: 'action-group-right' });

        if (state.auditStatus === 'in_progress') {
            left_group.appendChild(Helpers_create_element('button', {
                class_name: ['button', 'button-default'],
                html_content: `<span>${t('update_rulefile_button')}</span>` + Helpers_get_icon_svg('update', ['currentColor'], 18),
                event_listeners: { click: () => router_ref('update_rulefile') }
            }));

            const updated_reqs_count = state.samples.flatMap(s => Object.values(s.requirementResults || {})).filter(r => r.needsReview === true).length;
            if (updated_reqs_count > 0) {
                left_group.appendChild(Helpers_create_element('button', {
                    class_name: ['button', 'button-info'],
                    html_content: `<span>${t('handle_updated_assessments', { count: updated_reqs_count })}</span>` + Helpers_get_icon_svg('info', ['currentColor'], 18),
                    event_listeners: { click: () => router_ref('confirm_updates') }
                }));
            }

            right_group.appendChild(Helpers_create_element('button', {
                class_name: ['button', 'button-primary'],
                html_content: `<span>${t('lock_audit')}</span>` + Helpers_get_icon_svg('lock_audit', ['currentColor'], 18),
                event_listeners: { click: handle_lock_audit }
            }));
        }

        if (state.auditStatus === 'locked') {
            left_group.appendChild(Helpers_create_element('button', {
                class_name: ['button', 'button-secondary'],
                html_content: `<span>${t('unlock_audit')}</span>` + Helpers_get_icon_svg('unlock_audit', ['currentColor'], 18),
                event_listeners: { click: handle_unlock_audit }
            }));
            if (ExportLogic_export_to_csv) {
                left_group.appendChild(Helpers_create_element('button', {
                    class_name: ['button', 'button-default'],
                    html_content: `<span>${t('export_to_csv')}</span>` + Helpers_get_icon_svg('export', ['currentColor'], 18),
                    event_listeners: { click: handle_export_csv }
                }));
            }
            if (ExportLogic_export_to_excel) {
                left_group.appendChild(Helpers_create_element('button', {
                    class_name: ['button', 'button-default'],
                    html_content: `<span>${t('export_to_excel')}</span>` + Helpers_get_icon_svg('export', ['currentColor'], 18),
                    event_listeners: { click: handle_export_excel }
                }));
            }
            if (ExportLogic_export_to_word) {
                console.log('[AuditOverview] Creating Word export button');
                const word_export_button = Helpers_create_element('button', {
                    class_name: ['button', 'button-default'],
                    html_content: `<span>${t('export_to_word')}</span>` + Helpers_get_icon_svg('export', ['currentColor'], 18),
                    event_listeners: { click: handle_export_word }
                });
                console.log('[AuditOverview] Word export button created:', word_export_button);
                left_group.appendChild(word_export_button);
            } else {
                console.log('[AuditOverview] ExportLogic_export_to_word not available');
            }
        }

        if (left_group.hasChildNodes()) actions_div.appendChild(left_group);
        if (right_group.hasChildNodes()) actions_div.appendChild(right_group);
        
        return actions_div;
    }

    function render() {
        const t = Translation_t;
        app_container_ref.innerHTML = '';
        
        const current_global_state = local_getState();
        
        if (!current_global_state || !current_global_state.ruleFileContent) {
            NotificationComponent_show_global_message(t("error_no_active_audit"), "error");
            return;
        }

        const plate_element = Helpers_create_element('div', { class_name: 'content-plate audit-overview-plate' });
        app_container_ref.appendChild(plate_element);

        if (global_message_element_ref) {
            plate_element.appendChild(global_message_element_ref);
        }
        plate_element.appendChild(Helpers_create_element('h1', { text_content: t('audit_overview_title') }));
        
        const dashboard_container = Helpers_create_element('div', { class_name: 'overview-dashboard' });

        if (audit_info_component_instance) {
            dashboard_container.appendChild(audit_info_container_element);
            audit_info_component_instance.render();
        }

        const score_panel = Helpers_create_element('div', { class_name: ['dashboard-panel', 'score-panel'] });
        score_panel.appendChild(Helpers_create_element('h2', { 
            class_name: 'dashboard-panel__title',
            text_content: t('result_summary_and_deficiency_analysis', {defaultValue: "Result Summary"})
        }));
        
        const progress_data = AuditLogic_calculate_overall_audit_progress(current_global_state);
        const lang_code = window.Translation.get_current_language_code();
        const percentage = (progress_data.total > 0) ? (progress_data.audited / progress_data.total) * 100 : 0;
        const formatted_percentage = Helpers_format_number_locally(percentage, lang_code, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const valueText = `${progress_data.audited} / ${progress_data.total} (${formatted_percentage} %)`;

        score_panel.appendChild(Helpers_create_element('h3', { 
            class_name: 'dashboard-panel__subtitle',
            text_content: t('total_audit_progress_header', { defaultValue: "Klart hittills" })
        }));
        const progress_container = Helpers_create_element('div', { class_name: 'info-item--progress-container' });
        progress_container.appendChild(Helpers_create_element('p', { class_name: 'progress-text-wrapper', html_content: `<strong>${t('total_requirements_audited_label')}:</strong><span class="value">${valueText}</span>` }));
        progress_container.appendChild(window.ProgressBarComponent.create(progress_data.audited, progress_data.total));
        score_panel.appendChild(progress_container);
        
        const divider = Helpers_create_element('div', {
            style: {
                borderBottom: '1px dashed var(--secondary-color)',
                margin: '1.5rem 0'
            }
        });
        score_panel.appendChild(divider);
        
        if (scoreAnalysisComponentInstance) {
            score_panel.appendChild(scoreAnalysisContainerElement);
            scoreAnalysisComponentInstance.render();
        }
        dashboard_container.appendChild(score_panel);
        
        plate_element.appendChild(dashboard_container);
        
        const top_actions_section = Helpers_create_element('section', { class_name: 'audit-overview-section' });
        top_actions_section.appendChild(Helpers_create_element('h2', { text_content: t('audit_actions_title') }));
        top_actions_section.appendChild(create_actions_bar(current_global_state));
        plate_element.appendChild(top_actions_section);
        
        const sample_section = Helpers_create_element('section', { class_name: 'audit-overview-section' });
        const sample_management_header_div = Helpers_create_element('div', { class_name: 'sample-list-header' });
        const number_of_samples = current_global_state.samples ? current_global_state.samples.length : 0;
        sample_management_header_div.appendChild(Helpers_create_element('h2', { text_content: t('sample_list_title_with_count', { count: number_of_samples }) }));
        if (current_global_state.auditStatus === 'in_progress') {
            const add_sample_button = Helpers_create_element('button', {
                class_name: ['button', 'button-default', 'button-small'],
                html_content: `<span>${t('add_new_sample')}</span>` + Helpers_get_icon_svg('add', ['currentColor'], 18)
            });
            add_sample_button.addEventListener('click', () => { router_ref('sample_form'); });
            sample_management_header_div.appendChild(add_sample_button);
        }
        sample_section.appendChild(sample_management_header_div);
        if (sample_list_container_element) {
            sample_section.appendChild(sample_list_container_element);
            sample_list_component_instance.render(); 
        }
        plate_element.appendChild(sample_section);

        const bottom_actions_section = Helpers_create_element('section', { class_name: 'audit-overview-section' });
        bottom_actions_section.appendChild(Helpers_create_element('h2', { text_content: t('audit_actions_title') }));
        bottom_actions_section.appendChild(create_actions_bar(current_global_state));
        plate_element.appendChild(bottom_actions_section);
    }

    function destroy() {
        if (unsubscribe_from_store_function) { 
            unsubscribe_from_store_function(); 
            unsubscribe_from_store_function = null; 
        }
        if (sample_list_component_instance?.destroy) sample_list_component_instance.destroy();
        
        if (audit_info_component_instance?.destroy) audit_info_component_instance.destroy();
        
        if (scoreAnalysisComponentInstance?.destroy) {
            scoreAnalysisComponentInstance.destroy();
        }

        sample_list_container_element = null;
        sample_list_component_instance = null;
        scoreAnalysisContainerElement = null;
        scoreAnalysisComponentInstance = null;
        audit_info_container_element = null;
        audit_info_component_instance = null;
        previously_focused_element = null;
    }

    return { init, render, destroy };
})();
// js/components/UpdateRulefileViewComponent.js

export const UpdateRulefileViewComponent = (function () {
    'use-strict';

    const CSS_PATH = 'css/components/update_rulefile_view.css';
    let app_container_ref;
    let router_ref;

    let local_getState;
    let local_dispatch;
    let local_StoreActionTypes;

    let Translation_t;
    let Helpers_create_element, Helpers_get_icon_svg, Helpers_load_css, Helpers_escape_html;
    let NotificationComponent_show_global_message, NotificationComponent_get_global_message_element_reference;
    let SaveAuditLogic_save_audit_to_json_file;
    let ValidationLogic_validate_rule_file_json;

    let global_message_element_ref;
    let plate_element_ref;

    const VIEW_STEPS = {
        WARNING: 'WARNING',
        UPLOAD: 'UPLOAD',
        CONFIRM: 'CONFIRM'
    };
    let current_step = VIEW_STEPS.WARNING;
    let staged_new_rule_file_content = null;
    let staged_analysis_report = null;


    function get_t_internally() {
        return window.Translation?.t || ((key) => `**${key}**`);
    }

    function assign_globals_once() {
        if (Translation_t && Helpers_create_element) return;

        Translation_t = window.Translation?.t;
        Helpers_create_element = window.Helpers?.create_element;
        Helpers_get_icon_svg = window.Helpers?.get_icon_svg;
        Helpers_load_css = window.Helpers?.load_css;
        Helpers_escape_html = window.Helpers?.escape_html;
        NotificationComponent_show_global_message = window.NotificationComponent?.show_global_message;
        NotificationComponent_get_global_message_element_reference = window.NotificationComponent?.get_global_message_element_reference;
        SaveAuditLogic_save_audit_to_json_file = window.SaveAuditLogic?.save_audit_to_json_file;
        ValidationLogic_validate_rule_file_json = window.ValidationLogic?.validate_rule_file_json;
    }
    
    async function init(_app_container, _router, _params, _getState, _dispatch, _StoreActionTypes) {
        assign_globals_once();
        app_container_ref = _app_container;
        router_ref = _router;
        local_getState = _getState;
        local_dispatch = _dispatch;
        local_StoreActionTypes = _StoreActionTypes;

        if (NotificationComponent_get_global_message_element_reference) {
            global_message_element_ref = NotificationComponent_get_global_message_element_reference();
        }

        if (Helpers_load_css && CSS_PATH) {
            try {
                const link_tag = document.querySelector(`link[href="${CSS_PATH}"]`);
                if (!link_tag) {
                    await Helpers_load_css(CSS_PATH);
                }
            } catch (error) {
                console.warn("CSS for UpdateRulefileViewComponent not found yet, skipping load.", error);
            }
        }
        current_step = VIEW_STEPS.WARNING;
        staged_new_rule_file_content = null;
        staged_analysis_report = null;
    }

    function handle_backup_click() {
        const t = get_t_internally();
        if (SaveAuditLogic_save_audit_to_json_file) {
            SaveAuditLogic_save_audit_to_json_file(local_getState(), t, NotificationComponent_show_global_message);
            current_step = VIEW_STEPS.UPLOAD;
            render();
        } else {
            console.error("SaveAuditLogic not available to perform backup.");
            if (NotificationComponent_show_global_message) {
                NotificationComponent_show_global_message(t('error_saving_audit'), 'error');
            }
        }
    }

    function handle_new_rule_file_upload(event) {
        const t = get_t_internally();
        const file = event.target.files[0];
        if (!file) return;
        
        if (!window.RulefileUpdaterLogic) {
            console.error("CRITICAL: RulefileUpdaterLogic is not available on the window object.");
            NotificationComponent_show_global_message(t('error_internal_reload'), 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const new_rule_content = JSON.parse(e.target.result);
                const validation = ValidationLogic_validate_rule_file_json(new_rule_content);

                if (!validation.isValid) {
                    NotificationComponent_show_global_message(validation.message, 'error');
                    return;
                }

                const report = window.RulefileUpdaterLogic.analyze_rule_file_changes(local_getState(), new_rule_content);
                staged_analysis_report = report;
                staged_new_rule_file_content = new_rule_content;

                current_step = VIEW_STEPS.CONFIRM;
                render();

            } catch (error) {
                console.error("Fel vid uppdatering av regelfil:", error);
                NotificationComponent_show_global_message(
                    t('rule_file_invalid_json_with_detail', { errorMessage: error.message }),
                    'error'
                );
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    }
    
    function handle_confirm_update_click() {
        const t = get_t_internally();
        if (!staged_new_rule_file_content || !staged_analysis_report) {
            console.error("Bekräftelse misslyckades: temporär data saknas.");
            NotificationComponent_show_global_message(t('error_internal'), 'error');
            return;
        }

        const final_reconciled_state = window.RulefileUpdaterLogic.apply_rule_file_update(
            local_getState(),
            staged_new_rule_file_content,
            staged_analysis_report
        );
        
        local_dispatch({
            type: local_StoreActionTypes.REPLACE_RULEFILE_AND_RECONCILE,
            payload: final_reconciled_state
        });

        NotificationComponent_show_global_message(t('update_rulefile_success'), 'success');
        router_ref('audit_overview');
    }

    function render() {
        assign_globals_once();
        
        if (!plate_element_ref) {
            app_container_ref.innerHTML = '';
            plate_element_ref = Helpers_create_element('div', { class_name: 'content-plate update-rulefile-view-plate' });
            app_container_ref.appendChild(plate_element_ref);
        }
        
        plate_element_ref.innerHTML = '';

        if (global_message_element_ref) {
            plate_element_ref.appendChild(global_message_element_ref);
        }

        plate_element_ref.appendChild(Helpers_create_element('h1', { text_content: get_t_internally()('update_rulefile_title') }));

        switch (current_step) {
            case VIEW_STEPS.WARNING:
                render_warning_step();
                break;
            case VIEW_STEPS.UPLOAD:
                render_upload_step();
                break;
            case VIEW_STEPS.CONFIRM:
                render_confirm_step(staged_analysis_report);
                break;
        }
    }

    function render_warning_step() {
        const t = get_t_internally();
        plate_element_ref.appendChild(Helpers_create_element('p', { class_name: 'view-intro-text', text_content: t('update_rulefile_warning_intro') }));
        
        const warning_list = Helpers_create_element('ul', { class_name: 'warning-list' });
        warning_list.innerHTML = `
            <li>${t('update_rulefile_warning_li1')}</li>
            <li>${t('update_rulefile_warning_li2')}</li>
        `;
        plate_element_ref.appendChild(warning_list);

        plate_element_ref.appendChild(Helpers_create_element('h2', { style: { 'font-size': '1.2rem', 'margin-top': '1.5rem' }, text_content: t('update_rulefile_recommendation') }));
        plate_element_ref.appendChild(Helpers_create_element('p', { text_content: t('update_rulefile_backup_text') }));

        const backup_button = Helpers_create_element('button', {
            class_name: ['button', 'button-primary'],
            html_content: `<span>${t('save_audit_to_file')}</span>` + (Helpers_get_icon_svg ? Helpers_get_icon_svg('save') : '')
        });
        backup_button.addEventListener('click', handle_backup_click);
        
        const actions_div = Helpers_create_element('div', { class_name: 'form-actions', style: { 'margin-top': '2rem' } });
        actions_div.append(backup_button);
        plate_element_ref.appendChild(actions_div);
    }
    
    function render_upload_step() {
        const t = get_t_internally();
        
        plate_element_ref.appendChild(Helpers_create_element('div', {
            class_name: 'backup-confirmation',
            html_content: (Helpers_get_icon_svg ? Helpers_get_icon_svg('check_circle') : '✔') + ` <span>${t('update_rulefile_backup_saved')}</span>`
        }));
        
        plate_element_ref.appendChild(Helpers_create_element('h2', { style: { 'font-size': '1.2rem', 'margin-top': '1.5rem' }, text_content: t('update_rulefile_step2_title') }));
        plate_element_ref.appendChild(Helpers_create_element('p', { text_content: t('update_rulefile_step2_text') }));

        const file_input = Helpers_create_element('input', { id: 'new-rule-file-input', attributes: { type: 'file', accept: '.json', style: 'display: none;' } });
        file_input.addEventListener('change', handle_new_rule_file_upload);

        const upload_button = Helpers_create_element('button', {
            class_name: ['button', 'button-primary'],
            html_content: `<span>${t('upload_new_rulefile_btn')}</span>` + (Helpers_get_icon_svg ? Helpers_get_icon_svg('upload_file') : '')
        });
        upload_button.addEventListener('click', () => file_input.click());
        
        const actions_div = Helpers_create_element('div', { class_name: 'form-actions', style: { 'margin-top': '2rem' } });
        actions_div.appendChild(upload_button);
        
        plate_element_ref.appendChild(file_input);
        plate_element_ref.appendChild(actions_div);
    }

    function render_confirm_step(report) {
        const t = get_t_internally();
        const old_reqs = local_getState().ruleFileContent.requirements;

        plate_element_ref.appendChild(Helpers_create_element('p', { class_name: 'view-intro-text', text_content: t('update_rulefile_confirm_intro') }));

        const render_report_section = (title_key, items) => {
            const section = Helpers_create_element('div', { class_name: 'report-section' });
            section.appendChild(Helpers_create_element('h3', { text_content: `${t(title_key)} (${items.length})` }));
            if (items.length > 0) {
                const ul = Helpers_create_element('ul', { class_name: 'report-list' });
                items.forEach(item => {
                    const old_req_def = old_reqs[item.id];
                    const ref_text = old_req_def?.standardReference?.text;
                    
                    let display_text = item.title;
                    if (ref_text) {
                        display_text += ` (${ref_text})`;
                    }
                    
                    ul.appendChild(Helpers_create_element('li', { text_content: Helpers_escape_html(display_text) }));
                });
                section.appendChild(ul);
            } else {
                section.appendChild(Helpers_create_element('p', { class_name: 'text-muted', text_content: t('no_items_in_category') }));
            }
            return section;
        };
        
        plate_element_ref.appendChild(render_report_section('update_report_updated_reqs_title', report.updated_requirements));
        plate_element_ref.appendChild(render_report_section('update_report_removed_reqs_title', report.removed_requirements));

        const confirm_button = Helpers_create_element('button', {
            class_name: ['button', 'button-success'],
            html_content: `<span>${t('update_rulefile_confirm_button')}</span>` + (Helpers_get_icon_svg ? Helpers_get_icon_svg('check_circle') : '')
        });
        confirm_button.addEventListener('click', handle_confirm_update_click);

        const cancel_button = Helpers_create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('update_rulefile_continue_with_old')
        });
        cancel_button.addEventListener('click', () => router_ref('audit_overview'));
        
        const actions_div = Helpers_create_element('div', { class_name: 'form-actions', style: { 'margin-top': '2rem' } });
        
        actions_div.append(confirm_button, cancel_button);
        plate_element_ref.appendChild(actions_div);
    }

    function destroy() {
        app_container_ref.innerHTML = '';
        plate_element_ref = null;
        global_message_element_ref = null;
        current_step = VIEW_STEPS.WARNING;
        staged_analysis_report = null;
        staged_new_rule_file_content = null;
    }

    return {
        init,
        render,
        destroy
    };
})();

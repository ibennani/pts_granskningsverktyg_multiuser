// js/components/ConfirmSampleEditViewComponent.js

export const ConfirmSampleEditViewComponent = (function () {
    'use-strict';

    let app_container_ref;
    let router_ref;
    
    let local_getState;
    let local_dispatch;
    let local_StoreActionTypes;

    let Translation_t;
    let Helpers_create_element, Helpers_get_icon_svg, Helpers_escape_html;
    let NotificationComponent_show_global_message, NotificationComponent_get_global_message_element_reference;

    let plate_element_ref;

    function assign_globals_once() {
        if (Translation_t) return;
        Translation_t = window.Translation?.t;
        Helpers_create_element = window.Helpers?.create_element;
        Helpers_get_icon_svg = window.Helpers?.get_icon_svg;
        Helpers_escape_html = window.Helpers?.escape_html;
        NotificationComponent_show_global_message = window.NotificationComponent?.show_global_message;
        NotificationComponent_get_global_message_element_reference = window.NotificationComponent?.get_global_message_element_reference;
    }
    
    async function init(_app_container, _router_cb, _params, _getState, _dispatch, _StoreActionTypes) {
        assign_globals_once();
        app_container_ref = _app_container;
        router_ref = _router_cb;
        local_getState = _getState;
        local_dispatch = _dispatch;
        local_StoreActionTypes = _StoreActionTypes;
    }

    function handle_confirm_and_save() {
        const t = Translation_t;
        const pending_changes = local_getState().pendingSampleChanges;
        if (!pending_changes) {
            NotificationComponent_show_global_message(t('error_no_pending_sample_changes'), 'error');
            router_ref('audit_overview'); // Fallback
            return;
        }

        local_dispatch({ 
            type: local_StoreActionTypes.UPDATE_SAMPLE, 
            payload: { 
                sampleId: pending_changes.sampleId, 
                updatedSampleData: pending_changes.updatedSampleData
            } 
        });

        local_dispatch({ type: local_StoreActionTypes.CLEAR_STAGED_SAMPLE_CHANGES });
        
        NotificationComponent_show_global_message(t('sample_updated_successfully'), "success");
        
        const current_state = local_getState();
        const return_view = (current_state.auditStatus === 'not_started') ? 'sample_management' : 'audit_overview';
        router_ref(return_view);
    }

    function handle_discard_and_return() {
        local_dispatch({ type: local_StoreActionTypes.CLEAR_STAGED_SAMPLE_CHANGES });
        
        const current_state = local_getState();
        const return_view = (current_state.auditStatus === 'not_started') ? 'sample_management' : 'audit_overview';
        router_ref(return_view);
    }

    function render() {
        assign_globals_once();
        const t = Translation_t;
        const current_state = local_getState();
        const pending_changes = current_state.pendingSampleChanges;

        app_container_ref.innerHTML = '';
        plate_element_ref = Helpers_create_element('div', { class_name: 'content-plate' });
        app_container_ref.appendChild(plate_element_ref);

        const global_message_element = NotificationComponent_get_global_message_element_reference();
        if (global_message_element) {
            plate_element_ref.appendChild(global_message_element);
        }

        if (!pending_changes) {
            plate_element_ref.appendChild(Helpers_create_element('h1', { text_content: t('error_internal') }));
            plate_element_ref.appendChild(Helpers_create_element('p', { text_content: t('error_no_pending_sample_changes') }));
            const back_button = Helpers_create_element('button', {
                class_name: ['button', 'button-default'],
                text_content: t('back_to_audit_overview')
            });
            back_button.addEventListener('click', () => router_ref('audit_overview'));
            plate_element_ref.appendChild(back_button);
            return;
        }

        plate_element_ref.appendChild(Helpers_create_element('h1', { text_content: t('sample_edit_confirm_dialog_title') }));

        const { added_reqs, removed_reqs, data_will_be_lost } = pending_changes.analysis;
        const rule_file = current_state.ruleFileContent;

        const render_req_list = (req_ids) => {
            const ul = Helpers_create_element('ul', { class_name: 'report-list' });
            req_ids.forEach(id => {
                const req = rule_file.requirements[id];
                if (req) {
                    const ref_text = req.standardReference?.text ? ` (${req.standardReference.text})` : '';
                    ul.appendChild(Helpers_create_element('li', { text_content: `${req.title}${ref_text}` }));
                }
            });
            return ul;
        };

        if (added_reqs.length > 0) {
            const section = Helpers_create_element('div', { class_name: 'report-section' });
            section.appendChild(Helpers_create_element('h3', { text_content: t('sample_edit_confirm_added_reqs_header') }));
            section.appendChild(render_req_list(added_reqs));
            plate_element_ref.appendChild(section);
        }

        if (removed_reqs.length > 0) {
            const section = Helpers_create_element('div', { class_name: 'report-section' });
            section.appendChild(Helpers_create_element('h3', { text_content: t('sample_edit_confirm_removed_reqs_header') }));
            section.appendChild(render_req_list(removed_reqs));
            plate_element_ref.appendChild(section);
        }
        
        if (data_will_be_lost) {
            const warning_div = Helpers_create_element('div', { style: 'margin-top: 1rem; padding: 1rem; border: 2px solid var(--danger-color); border-radius: var(--border-radius); background-color: var(--danger-color-light);' });
            warning_div.appendChild(Helpers_create_element('h4', { 
                html_content: (Helpers_get_icon_svg ? Helpers_get_icon_svg('warning', ['var(--danger-color)']) + ' ' : '') + t('sample_edit_confirm_data_loss_warning_header')
            }));
            warning_div.appendChild(Helpers_create_element('p', { text_content: t('sample_edit_confirm_data_loss_warning_text') }));
            plate_element_ref.appendChild(warning_div);
        }

        const actions_div = Helpers_create_element('div', { class_name: 'form-actions', style: 'margin-top: 2rem;' });
        const confirm_btn = Helpers_create_element('button', { 
            class_name: ['button', 'button-primary'], 
            text_content: t('sample_edit_confirm_action_button') 
        });
        const discard_btn = Helpers_create_element('button', { 
            class_name: ['button', 'button-danger'], 
            text_content: t('sample_edit_discard_action_button') 
        });

        confirm_btn.addEventListener('click', handle_confirm_and_save);
        discard_btn.addEventListener('click', handle_discard_and_return);

        actions_div.append(confirm_btn, discard_btn);
        plate_element_ref.appendChild(actions_div);
    }

    function destroy() {
        app_container_ref.innerHTML = '';
        plate_element_ref = null;
    }

    return { init, render, destroy };
})();
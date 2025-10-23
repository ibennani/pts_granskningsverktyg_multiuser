// js/components/requirement_audit/ChecklistHandler.js

import { marked } from '../../utils/markdown.js';

export const ChecklistHandler = (function () {
    'use-strict';

    let container_ref;
    let on_status_change_callback;
    let on_autosave_callback;

    let Translation_t;
    let Helpers_create_element, Helpers_get_icon_svg;
    
    let is_audit_locked = false;
    let requirement_definition_ref = null;
    let requirement_result_ref = null;

    let is_dom_built = false;

    // --- NY HJÄLPFUNKTION ---
    function _safe_parse_markdown_inline(markdown_string) {
        if (typeof marked === 'undefined' || !window.Helpers.escape_html) {
            return window.Helpers.escape_html(markdown_string);
        }

        const renderer = new marked.Renderer();
        renderer.link = (href, title, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        renderer.html = (html) => window.Helpers.escape_html(html);

        return marked.parseInline(String(markdown_string || ''), { renderer, breaks: true, gfm: true });
    }

    function assign_globals_once() {
        if (Translation_t && Helpers_create_element) return;
        Translation_t = window.Translation?.t;
        Helpers_create_element = window.Helpers?.create_element;
        Helpers_get_icon_svg = window.Helpers?.get_icon_svg;
    }

    function init(_container, _callbacks) {
        assign_globals_once();
        container_ref = _container;
        on_status_change_callback = _callbacks.onStatusChange;
        on_autosave_callback = _callbacks.onAutosave;
        is_dom_built = false;

        container_ref.addEventListener('click', handle_checklist_click);
        container_ref.addEventListener('input', handle_textarea_input);
        // Add keyboard support for accessibility
        container_ref.addEventListener('keydown', handle_checklist_keydown);
    }
    
    function handle_checklist_click(event) {
        const target_button = event.target.closest('button[data-action]');
        if (!target_button) return;

        const action = target_button.dataset.action;
        const check_item_element = target_button.closest('.check-item[data-check-id]');
        const pc_item_element = target_button.closest('.pass-criterion-item[data-pc-id]');
        
        if (!check_item_element) return;
        const check_id = check_item_element.dataset.checkId;

        let change_info = { type: null, checkId: check_id };

        if (action === 'set-check-complies') {
            change_info.type = 'check_overall_status_change';
            change_info.newStatus = 'passed';
        } else if (action === 'set-check-not-complies') {
            change_info.type = 'check_overall_status_change';
            change_info.newStatus = 'failed';
        } else if (pc_item_element) {
            const pc_id = pc_item_element.dataset.pcId;
            change_info.pcId = pc_id;
            if (action === 'set-pc-passed') {
                change_info.type = 'pc_status_change';
                change_info.newStatus = 'passed';
            } else if (action === 'set-pc-failed') {
                change_info.type = 'pc_status_change';
                change_info.newStatus = 'failed';
            }
        }
        
        if (change_info.type && on_status_change_callback) {
            on_status_change_callback(change_info);
        }
    }

    function handle_checklist_keydown(event) {
        // Handle keyboard navigation for accessibility
        if (event.key === 'Enter' || event.key === ' ') {
            const target_button = event.target.closest('button[data-action]');
            if (!target_button) return;
            
            event.preventDefault();
            // Trigger the same action as click
            handle_checklist_click(event);
        }
    }
    
    function handle_textarea_input(event) {
        const textarea = event.target;
        if (!textarea.classList.contains('pc-observation-detail-textarea')) return;
        
        const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
        const check_item = textarea.closest('.check-item[data-check-id]');
        if (pc_item && check_item) {
            const check_id = check_item.dataset.checkId;
            const pc_id = pc_item.dataset.pcId;
            if (on_autosave_callback) {
                on_autosave_callback({ 
                    type: 'pc_observation', 
                    checkId: check_id, 
                    pcId: pc_id, 
                    value: textarea.value 
                });
            }
        }
    }

    function build_initial_dom() {
        const t = Translation_t;
        container_ref.innerHTML = '';

        if (!requirement_definition_ref?.checks?.length) {
            container_ref.appendChild(Helpers_create_element('p', { class_name: 'text-muted', text_content: t('no_checks_for_this_requirement') }));
            is_dom_built = true;
            return;
        }

        container_ref.appendChild(Helpers_create_element('h2', { text_content: t('checks_title') }));
        
        requirement_definition_ref.checks.forEach((check_definition, check_index) => {
            const check_wrapper = Helpers_create_element('div', { 
                class_name: 'check-item',
                attributes: {'data-check-id': check_definition.id }
            });

            // --- ÄNDRING: Använd Markdown-parser ---
            const check_title_label = `${t('check_item_title')} ${check_index + 1}`;
            // Rad 1: "Kontrollpunkt N" som rubrik (fetstil via h3)
            const condition_h3 = Helpers_create_element('h3', { 
                class_name: 'check-condition-title', 
                html_content: window.Helpers.escape_html(check_title_label) 
            });
            check_wrapper.appendChild(condition_h3);
            // Rad 2: Själva villkorstexten (markdown-renderad) på ny rad, inte fet
            const condition_text_div = Helpers_create_element('div', { 
                class_name: ['check-condition-text','markdown-content'], 
                html_content: _safe_parse_markdown_inline(check_definition.condition) 
            });
            check_wrapper.appendChild(condition_text_div);
            
            const actions_div = Helpers_create_element('div', { class_name: 'condition-actions' });
            const check_icon = Helpers_get_icon_svg ? Helpers_get_icon_svg('check_circle', [], 16) : '';
            const cancel_icon = Helpers_get_icon_svg ? Helpers_get_icon_svg('cancel', [], 16) : '';
            actions_div.append(
                Helpers_create_element('button', { 
                    class_name: ['button', 'button-success', 'button-small'],
                    attributes: { 'data-action': 'set-check-complies' },
                    html_content: `<span>${t('check_complies')}</span>${check_icon}`
                }),
                Helpers_create_element('button', {
                    class_name: ['button', 'button-danger', 'button-small'],
                    attributes: { 'data-action': 'set-check-not-complies' },
                    html_content: `<span>${t('check_does_not_comply')}</span>${cancel_icon}`
                })
            );
            check_wrapper.appendChild(actions_div);
            
            check_wrapper.appendChild(Helpers_create_element('p', { class_name: 'check-status-display' }));
            
            const pc_list = Helpers_create_element('ul', { class_name: 'pass-criteria-list' });
            (check_definition.passCriteria || []).forEach((pc_def, pc_index) => {
                const pc_item_li = Helpers_create_element('li', { 
                    class_name: 'pass-criterion-item', 
                    attributes: {'data-pc-id': pc_def.id }
                });

                // --- ÄNDRING: Använd Markdown-parser ---
                const numbering = `${check_index + 1}.${pc_index + 1}`;
                // Rad 1: "Godkännandekriterium X.Y"
                const pc_title_div = Helpers_create_element('div', {
                    class_name: 'pass-criterion-title',
                    html_content: `<strong>${window.Helpers.escape_html(t('pass_criterion_label'))} ${window.Helpers.escape_html(numbering)}</strong>`
                });
                pc_item_li.appendChild(pc_title_div);
                // Rad 2: Själva kriterietexten (markdown-renderad) på ny rad
                const requirement_content_div = Helpers_create_element('div', { 
                    class_name: ['pass-criterion-requirement', 'markdown-content'],
                    html_content: _safe_parse_markdown_inline(pc_def.requirement)
                });
                pc_item_li.appendChild(requirement_content_div);
                
                pc_item_li.appendChild(Helpers_create_element('div', { class_name: 'pass-criterion-status' }));
                
                const pc_actions_div = Helpers_create_element('div', { class_name: 'pass-criterion-actions' });
                const thumb_up_icon = Helpers_get_icon_svg ? Helpers_get_icon_svg('thumb_up', [], 16) : '';
                const thumb_down_icon = Helpers_get_icon_svg ? Helpers_get_icon_svg('thumb_down', [], 16) : '';
                pc_actions_div.append(
                    Helpers_create_element('button', {
                        class_name: ['button', 'button-success', 'button-small'],
                        attributes: { 'data-action': 'set-pc-passed' },
                        html_content: `<span>${t('pass_criterion_approved')}</span>${thumb_up_icon}`
                    }),
                    Helpers_create_element('button', {
                        class_name: ['button', 'button-danger', 'button-small'],
                        attributes: { 'data-action': 'set-pc-failed' },
                        html_content: `<span>${t('pass_criterion_failed')}</span>${thumb_down_icon}`
                    })
                );
                pc_item_li.appendChild(pc_actions_div);

                const observation_wrapper = Helpers_create_element('div', { class_name: 'pc-observation-detail-wrapper form-group' });
                const observation_label = Helpers_create_element('label', { 
                    attributes: { for: `pc-observation-${check_definition.id}-${pc_def.id}` }, 
                    text_content: t('pc_observation_detail_label') 
                });
                observation_wrapper.appendChild(observation_label);
                const observation_textarea = Helpers_create_element('textarea', {
                    id: `pc-observation-${check_definition.id}-${pc_def.id}`,
                    class_name: 'form-control pc-observation-detail-textarea',
                    attributes: { rows: '4' }
                });
                observation_wrapper.appendChild(observation_textarea);
                
                pc_item_li.appendChild(observation_wrapper);
                pc_list.appendChild(pc_item_li);
            });
            check_wrapper.appendChild(pc_list);

            check_wrapper.appendChild(Helpers_create_element('p', { class_name: 'text-muted compliance-info-text', style: 'font-style: italic;' }));
            
            container_ref.appendChild(check_wrapper);
        });

        is_dom_built = true;
    }

    function update_dom() {
        const t = Translation_t;
        
        container_ref.querySelectorAll('.check-item[data-check-id]').forEach(check_wrapper => {
            const check_id = check_wrapper.dataset.checkId;
            const check_result_data = requirement_result_ref.checkResults[check_id];
            const calculated_check_status = check_result_data?.status || 'not_audited';
            const overall_manual_status = check_result_data?.overallStatus || 'not_audited';

            check_wrapper.className = `check-item status-${calculated_check_status}`;

            const complies_btn = check_wrapper.querySelector('button[data-action="set-check-complies"]');
            const not_complies_btn = check_wrapper.querySelector('button[data-action="set-check-not-complies"]');
            
            if (complies_btn && not_complies_btn) {
                complies_btn.classList.toggle('active', overall_manual_status === 'passed');
                not_complies_btn.classList.toggle('active', overall_manual_status === 'failed');
                complies_btn.parentElement.style.display = is_audit_locked ? 'none' : 'flex';
            }
            
            const status_text_container = check_wrapper.querySelector('.check-status-display');
            // Clear existing content before adding new status
            status_text_container.innerHTML = '';
            const status_text = t(`audit_status_${calculated_check_status}`);
            const strong_element = Helpers_create_element('strong', { text_content: t('check_status') });
            status_text_container.appendChild(strong_element);
            status_text_container.appendChild(document.createTextNode(': '));
            const status_span = Helpers_create_element('span', { 
                class_name: `status-text status-${calculated_check_status}`, 
                text_content: status_text 
            });
            status_text_container.appendChild(status_span);
            
            const pc_list = check_wrapper.querySelector('.pass-criteria-list');
            const compliance_info_text = check_wrapper.querySelector('.compliance-info-text');

            pc_list.style.display = (overall_manual_status === 'passed' && pc_list.children.length > 0) ? '' : 'none';
            compliance_info_text.style.display = (overall_manual_status === 'failed') ? '' : 'none';
            if (overall_manual_status === 'failed') {
                compliance_info_text.textContent = t('check_marked_as_not_compliant_criteria_passed');
            }

            check_wrapper.querySelectorAll('.pass-criterion-item[data-pc-id]').forEach(pc_item_li => {
                const pc_id = pc_item_li.dataset.pcId;
                const pc_data = check_result_data?.passCriteria[pc_id] || { status: 'not_audited', observationDetail: '' };
                const current_pc_status = pc_data.status;

                const pc_status_text_container = pc_item_li.querySelector('.pass-criterion-status');
                // Clear existing content before adding new status
                pc_status_text_container.innerHTML = '';
                const pc_status_text = t(`audit_status_${current_pc_status}`);
                const pc_strong_element = Helpers_create_element('strong', { text_content: t('status') });
                pc_status_text_container.appendChild(pc_strong_element);
                pc_status_text_container.appendChild(document.createTextNode(': '));
                const pc_status_span = Helpers_create_element('span', { 
                    class_name: `status-text status-${current_pc_status}`, 
                    text_content: pc_status_text 
                });
                pc_status_text_container.appendChild(pc_status_span);

                const passed_btn = pc_item_li.querySelector('button[data-action="set-pc-passed"]');
                const failed_btn = pc_item_li.querySelector('button[data-action="set-pc-failed"]');

                if (passed_btn && failed_btn) {
                    passed_btn.classList.toggle('active', current_pc_status === 'passed');
                    failed_btn.classList.toggle('active', current_pc_status === 'failed');
                    passed_btn.parentElement.style.display = is_audit_locked ? 'none' : 'flex';
                }

                const observation_wrapper = pc_item_li.querySelector('.pc-observation-detail-wrapper');
                const observation_textarea = observation_wrapper.querySelector('textarea');

                const was_hidden = observation_wrapper.hidden;
                observation_wrapper.hidden = (current_pc_status !== 'failed');
                
                if (was_hidden && !observation_wrapper.hidden && !is_audit_locked) {
                    // Only focus if not in focus protection mode
                    if (!window.focusProtectionActive && !window.customFocusApplied) {
                        observation_textarea.focus();
                    }
                }
                
                observation_textarea.readOnly = is_audit_locked;
                if (observation_textarea.value !== (pc_data.observationDetail || '')) {
                    observation_textarea.value = pc_data.observationDetail || '';
                }
                if (window.Helpers?.init_auto_resize_for_textarea) {
                    window.Helpers.init_auto_resize_for_textarea(observation_textarea);
                }
            });
        });
    }

    function render(requirement_definition, requirement_result, locked_status) {
        requirement_definition_ref = requirement_definition;
        requirement_result_ref = requirement_result;
        is_audit_locked = locked_status;

        if (!is_dom_built) {
            build_initial_dom();
        }

        update_dom();
    }

    function destroy() {
        if (container_ref) {
            container_ref.removeEventListener('click', handle_checklist_click);
            container_ref.removeEventListener('input', handle_textarea_input);
            container_ref.innerHTML = '';
        }
        is_dom_built = false;
    }

    return {
        init,
        render,
        destroy
    };
})();

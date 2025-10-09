// js/components/EditRulefileRequirementComponent.js

export const EditRulefileRequirementComponent = (function () {
    'use-strict';

    const CSS_PATH_SHARED = 'css/components/requirement_audit_component.css';
    const CSS_PATH_SPECIFIC = 'css/components/edit_rulefile_requirement_component.css';
    let app_container_ref;
    let router_ref;
    let params_ref;

    let local_getState;
    let local_dispatch;
    let local_StoreActionTypes;
    let Translation_t;
    let Helpers_create_element, Helpers_get_icon_svg, Helpers_load_css, Helpers_generate_uuid_v4, Helpers_sanitize_id_for_css_selector;
    let NotificationComponent_show_global_message;
    
    let form_element_ref;
    let local_requirement_data = null;

    function _create_move_check_button(direction, check) {
        const t = Translation_t;
        const is_up = direction === 'up';
        const icon_name = is_up ? 'arrow_upward' : 'arrow_downward';
        return Helpers_create_element('button', {
            type: 'button',
            class_name: 'button button-default button-small move-item-btn',
            attributes: {
                'data-action': is_up ? 'move-check-up' : 'move-check-down',
                'aria-label': t(is_up ? 'move_check_up_aria_label' : 'move_check_down_aria_label', {
                    conditionText: check.condition || t('aria_label_empty_content')
                })
            },
            html_content: `<span>${t(is_up ? 'move_item_up' : 'move_item_down')}</span>` + Helpers_get_icon_svg(icon_name, ['currentColor'], 16)
        });
    }

    function _create_move_pass_criterion_button(direction, check, pass_criterion) {
        const t = Translation_t;
        const is_up = direction === 'up';
        const icon_name = is_up ? 'arrow_upward' : 'arrow_downward';
        return Helpers_create_element('button', {
            type: 'button',
            class_name: 'button button-default button-small move-item-btn',
            attributes: {
                'data-action': is_up ? 'move-pass-criterion-up' : 'move-pass-criterion-down',
                'aria-label': t(is_up ? 'move_pass_criterion_up_aria_label' : 'move_pass_criterion_down_aria_label', {
                    criterionText: pass_criterion.requirement || t('aria_label_empty_content')
                })
            },
            html_content: `<span>${t(is_up ? 'move_item_up' : 'move_item_down')}</span>` + Helpers_get_icon_svg(icon_name, ['currentColor'], 16)
        });
    }

    function assign_globals_once() {
        if (Translation_t) return;
        Translation_t = window.Translation.t;
        Helpers_create_element = window.Helpers.create_element;
        Helpers_get_icon_svg = window.Helpers.get_icon_svg;
        Helpers_load_css = window.Helpers.load_css;
        Helpers_generate_uuid_v4 = window.Helpers.generate_uuid_v4;
        Helpers_sanitize_id_for_css_selector = window.Helpers.sanitize_id_for_css_selector;
        NotificationComponent_show_global_message = window.NotificationComponent.show_global_message;
    }

    async function init(_app_container, _router_cb, _params, _getState, _dispatch, _StoreActionTypes) {
        assign_globals_once();
        app_container_ref = _app_container;
        router_ref = _router_cb;
        params_ref = _params;
        local_getState = _getState;
        local_dispatch = _dispatch;
        local_StoreActionTypes = _StoreActionTypes;
        
        await Helpers_load_css(CSS_PATH_SHARED).catch(e => console.warn(e));
        await Helpers_load_css(CSS_PATH_SPECIFIC).catch(e => console.warn(e));
    }

    // --- NY FUNKTION: Uppdaterar local_requirement_data från formuläret ---
    function _update_local_data_from_form() {
        if (!form_element_ref) return;
        
        local_requirement_data.title = form_element_ref.querySelector('#title')?.value || '';
        local_requirement_data.expectedObservation = form_element_ref.querySelector('#expectedObservation')?.value || '';
        local_requirement_data.instructions = form_element_ref.querySelector('#instructions')?.value || '';
        local_requirement_data.exceptions = form_element_ref.querySelector('#exceptions')?.value || '';
        local_requirement_data.commonErrors = form_element_ref.querySelector('#commonErrors')?.value || '';
        local_requirement_data.tips = form_element_ref.querySelector('#tips')?.value || '';
        local_requirement_data.examples = form_element_ref.querySelector('#examples')?.value || '';
        
        if (!local_requirement_data.standardReference) {
            local_requirement_data.standardReference = { text: '', url: '' };
        }
        local_requirement_data.standardReference.text = form_element_ref.querySelector('#standardReferenceText')?.value || '';
        local_requirement_data.standardReference.url = form_element_ref.querySelector('#standardReferenceUrl')?.value || '';

        if (!local_requirement_data.metadata) {
            local_requirement_data.metadata = {};
        }
        if (!local_requirement_data.metadata.mainCategory) {
            local_requirement_data.metadata.mainCategory = { text: '' };
        }
        local_requirement_data.metadata.mainCategory.text = form_element_ref.querySelector('#mainCategoryText')?.value || '';

        if (!local_requirement_data.metadata.subCategory) {
            local_requirement_data.metadata.subCategory = { text: '' };
        }
        local_requirement_data.metadata.subCategory.text = form_element_ref.querySelector('#subCategoryText')?.value || '';

        if (!local_requirement_data.metadata.impact) {
            local_requirement_data.metadata.impact = {};
        }
        local_requirement_data.metadata.impact.isCritical = form_element_ref.querySelector('#isCritical')?.checked || false;
        local_requirement_data.metadata.impact.primaryScore = parseInt(form_element_ref.querySelector('#primaryScore')?.value, 10) || 0;
        local_requirement_data.metadata.impact.secondaryScore = parseInt(form_element_ref.querySelector('#secondaryScore')?.value, 10) || 0;

        local_requirement_data.contentType = Array.from(form_element_ref.querySelectorAll('input[name="contentType"]:checked')).map(cb => cb.value);

        const existing_classifications = Array.isArray(local_requirement_data.classifications) ? local_requirement_data.classifications : [];
        const preserved_classifications = existing_classifications.filter(c => c?.taxonomyId && c.taxonomyId !== 'wcag22-pour');
        const selected_pour_concept_ids = Array.from(form_element_ref.querySelectorAll('input[name="classification"]:checked')).map(cb => cb.value);
        const unique_pour_concepts = Array.from(new Set(selected_pour_concept_ids)).map(conceptId => ({
            taxonomyId: 'wcag22-pour',
            conceptId
        }));
        local_requirement_data.classifications = [...preserved_classifications, ...unique_pour_concepts];

        const checks_data = [];
        form_element_ref.querySelectorAll('.check-item-edit').forEach(check_el => {
            const check_id = check_el.dataset.checkId;
            const sane_check_id = Helpers_sanitize_id_for_css_selector(check_id);
            const check_obj = {
                id: check_id,
                condition: check_el.querySelector(`#check_${sane_check_id}_condition`)?.value || '',
                logic: check_el.querySelector(`input[name="check_${sane_check_id}_logic"]:checked`)?.value || 'AND',
                passCriteria: []
            };

            check_el.querySelectorAll('.pc-item-edit').forEach(pc_el => {
                const pc_id = pc_el.dataset.pcId;
                const sane_pc_id = Helpers_sanitize_id_for_css_selector(pc_id);
                check_obj.passCriteria.push({
                    id: pc_id,
                    requirement: pc_el.querySelector(`#pc_${sane_check_id}_${sane_pc_id}_requirement`)?.value || '',
                    failureStatementTemplate: pc_el.querySelector(`#pc_${sane_check_id}_${sane_pc_id}_failureTemplate`)?.value || ''
                });
            });
            checks_data.push(check_obj);
        });
        local_requirement_data.checks = checks_data;
    }

    function handle_form_submit(event) {
        event.preventDefault();
        _update_local_data_from_form(); // Använd den nya funktionen

        const t = Translation_t;
        if (!local_requirement_data.title.trim()) {
            NotificationComponent_show_global_message(t('field_is_required', { fieldName: t('requirement_title') }), 'error');
            // Only focus if not in focus protection mode
            if (!window.focusProtectionActive && !window.customFocusApplied) {
                form_element_ref.querySelector('#title')?.focus();
            }
            return;
        }
        
        const is_new_requirement = params_ref.id === 'new';
        
        if (is_new_requirement) {
            // Generera nytt ID och key för nytt krav
            const new_id = Helpers_generate_uuid_v4();
            const new_key = (local_requirement_data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 50) || 'req') + '-' + new_id.substring(0, 8);
            
            local_requirement_data.id = new_id;
            local_requirement_data.key = new_key;
            
            local_dispatch({
                type: local_StoreActionTypes.ADD_REQUIREMENT_DEFINITION,
                payload: {
                    requirementId: new_key,
                    newRequirementData: local_requirement_data
                }
            });
            
            NotificationComponent_show_global_message(t('requirement_added_successfully', { reqTitle: local_requirement_data.title }), 'success');
            router_ref('rulefile_view_requirement', { id: new_key });
        } else {
            local_dispatch({
                type: local_StoreActionTypes.UPDATE_REQUIREMENT_DEFINITION,
                payload: {
                    requirementId: params_ref.id,
                    updatedRequirementData: local_requirement_data
                }
            });
            
            NotificationComponent_show_global_message(t('rulefile_requirement_saved'), 'success');
            router_ref('rulefile_view_requirement', { id: params_ref.id });
        }
    }
    
    function handle_form_click(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        event.stopPropagation();
        event.preventDefault();
        
        // Uppdatera modellen från DOM innan vi ändrar modellen
        _update_local_data_from_form();

        const previous_layout = _capture_positions();

        const action = button.dataset.action;
        let check_id, pc_id;

        switch (action) {
            case 'add-check':
                const new_check_id = `new-check-${Helpers_generate_uuid_v4()}`;
                local_requirement_data.checks.push({
                    id: new_check_id,
                    condition: '',
                    logic: 'AND',
                    passCriteria: []
                });

                // Spara ändringarna till global state direkt (endast för befintliga krav)
                const is_new_requirement = params_ref.id === 'new';
                if (!is_new_requirement) {
                    // Endast för befintliga krav - spara till state
                    if (typeof window !== 'undefined') {
                        window.skipRulefileRequirementRender = (Number(window.skipRulefileRequirementRender) || 0) + 1;
                    }
                    local_dispatch({
                        type: local_StoreActionTypes.UPDATE_REQUIREMENT_DEFINITION,
                        payload: { requirementId: params_ref.id, updatedRequirementData: local_requirement_data }
                    });
                }
                // För nya krav: håll allt lokalt tills kravet sparas

                // Lägg bara till det nya elementet istället för att rendera om allt
                _add_new_check_element(new_check_id);
                break;

            case 'delete-check':
                check_id = button.closest('.check-item-edit')?.dataset.checkId;
                if (check_id) {
                    const is_new_requirement = params_ref.id === 'new';
                    if (is_new_requirement) {
                        // För nya krav, ta bort kontrollpunkten direkt från local_requirement_data
                        local_requirement_data.checks = local_requirement_data.checks.filter(c => c.id !== check_id);
                        _rerender_checks_section();
                    } else {
                        router_ref('confirm_delete', { type: 'check', reqId: params_ref.id, checkId: check_id });
                    }
                }
                break;

            case 'move-check-up':
            case 'move-check-down':
                check_id = button.closest('.check-item-edit')?.dataset.checkId;
                if (check_id) {
                    const checks = local_requirement_data.checks || [];
                    const current_index = checks.findIndex(c => c.id === check_id);
                    if (current_index !== -1) {
                        const direction = action === 'move-check-up' ? -1 : 1;
                        const target_index = current_index + direction;
                        if (target_index >= 0 && target_index < checks.length) {
                            const [moved_check] = checks.splice(current_index, 1);
                            checks.splice(target_index, 0, moved_check);
                            const available_actions = [];
                            if (target_index > 0) available_actions.push('move-check-up');
                            if (target_index < checks.length - 1) available_actions.push('move-check-down');
                            let preferred_action;
                            if (direction === -1 && available_actions.includes('move-check-up')) {
                                preferred_action = 'move-check-up';
                            } else if (direction === 1 && available_actions.includes('move-check-down')) {
                                preferred_action = 'move-check-down';
                            } else {
                                preferred_action = direction === -1 ? 'move-check-down' : 'move-check-up';
                            }
                            const action_order = [];
                            if (preferred_action && available_actions.includes(preferred_action)) {
                                action_order.push(preferred_action);
                            }
                            available_actions.forEach(a => { if (!action_order.includes(a)) action_order.push(a); });
                            action_order.push('delete-check');
                            const focus_target = {
                                type: 'check',
                                checkId: moved_check.id,
                                actionOrder: action_order,
                                forceScroll: true
                            };
                            _rerender_all_sections({
                                focusTarget: focus_target,
                                animateInfo: {
                                    type: 'check',
                                    checkId: moved_check.id,
                                    animationClass: 'item-swap-animation',
                                    animationDuration: 1000
                                },
                                previousLayout: previous_layout
                            });
                        }
                    }
                }
                break;

            case 'add-pass-criterion':
                check_id = button.closest('.check-item-edit')?.dataset.checkId;
                const check = local_requirement_data.checks.find(c => c.id === check_id);
                if (check) {
                    const new_pc_id = `new-pc-${Helpers_generate_uuid_v4()}`;
                    check.passCriteria.push({
                        id: new_pc_id,
                        requirement: '',
                        failureStatementTemplate: ''
                    });

                    // Spara ändringarna till global state direkt (endast för befintliga krav)
                    const is_new_requirement = params_ref.id === 'new';
                    if (!is_new_requirement) {
                        // Endast för befintliga krav - spara till state
                        if (typeof window !== 'undefined') {
                            window.skipRulefileRequirementRender = (Number(window.skipRulefileRequirementRender) || 0) + 1;
                        }
                        local_dispatch({
                            type: local_StoreActionTypes.UPDATE_REQUIREMENT_DEFINITION,
                            payload: { requirementId: params_ref.id, updatedRequirementData: local_requirement_data }
                        });
                    }
                    // För nya krav: håll allt lokalt tills kravet sparas

                    // Lägg bara till det nya elementet istället för att rendera om allt
                    _add_new_pass_criterion_element(check_id, new_pc_id);
                }
                break;

            case 'delete-pass-criterion':
                const pc_item = button.closest('.pc-item-edit');
                check_id = button.closest('.check-item-edit')?.dataset.checkId;
                pc_id = pc_item?.dataset.pcId;
                if (check_id && pc_id) {
                    const is_new_requirement = params_ref.id === 'new';
                    if (is_new_requirement) {
                        // För nya krav, ta bort kriteriet direkt från local_requirement_data
                        const check = local_requirement_data.checks.find(c => c.id === check_id);
                        if (check) {
                            check.passCriteria = check.passCriteria.filter(pc => pc.id !== pc_id);
                            _rerender_checks_section();
                        }
                    } else {
                        router_ref('confirm_delete', { type: 'criterion', reqId: params_ref.id, checkId: check_id, pcId: pc_id });
                    }
                }
                break;

            case 'move-pass-criterion-up':
            case 'move-pass-criterion-down':
                check_id = button.closest('.check-item-edit')?.dataset.checkId;
                pc_id = button.closest('.pc-item-edit')?.dataset.pcId;
                if (check_id && pc_id) {
                    const check_for_move = local_requirement_data.checks.find(c => c.id === check_id);
                    if (check_for_move && Array.isArray(check_for_move.passCriteria)) {
                        const current_pc_index = check_for_move.passCriteria.findIndex(pc => pc.id === pc_id);
                        if (current_pc_index !== -1) {
                            const direction = action === 'move-pass-criterion-up' ? -1 : 1;
                            const target_pc_index = current_pc_index + direction;
                            if (target_pc_index >= 0 && target_pc_index < check_for_move.passCriteria.length) {
                                const [moved_pc] = check_for_move.passCriteria.splice(current_pc_index, 1);
                                check_for_move.passCriteria.splice(target_pc_index, 0, moved_pc);
                                const available_pc_actions = [];
                                if (target_pc_index > 0) available_pc_actions.push('move-pass-criterion-up');
                                if (target_pc_index < check_for_move.passCriteria.length - 1) available_pc_actions.push('move-pass-criterion-down');
                                let preferred_pc_action;
                                if (direction === -1 && available_pc_actions.includes('move-pass-criterion-up')) {
                                    preferred_pc_action = 'move-pass-criterion-up';
                                } else if (direction === 1 && available_pc_actions.includes('move-pass-criterion-down')) {
                                    preferred_pc_action = 'move-pass-criterion-down';
                                } else {
                                    preferred_pc_action = direction === -1 ? 'move-pass-criterion-down' : 'move-pass-criterion-up';
                                }
                                const pc_action_order = [];
                                if (preferred_pc_action && available_pc_actions.includes(preferred_pc_action)) {
                                    pc_action_order.push(preferred_pc_action);
                                }
                                available_pc_actions.forEach(a => { if (!pc_action_order.includes(a)) pc_action_order.push(a); });
                                pc_action_order.push('delete-pass-criterion');
                                const focus_target_pc = {
                                    type: 'passCriterion',
                                    checkId: check_id,
                                    passCriterionId: moved_pc.id,
                                    actionOrder: pc_action_order,
                                    forceScroll: true
                                };
                                _rerender_all_sections({
                                    focusTarget: focus_target_pc,
                                    animateInfo: {
                                        type: 'passCriterion',
                                        checkId: check_id,
                                        passCriterionId: moved_pc.id,
                                        animationClass: 'item-swap-animation',
                                        animationDuration: 1000
                                    },
                                    previousLayout: previous_layout
                                });
                            }
                        }
                    }
                }
                break;
        }
    }

    function _create_form_group(label_key, id, value, is_textarea = false, input_type = 'text', label_text_override = null) {
        const t = Translation_t;
        const form_group = Helpers_create_element('div', { class_name: 'form-group' });
        const label_text = label_text_override || t(label_key);
        form_group.appendChild(Helpers_create_element('label', { attributes: { for: id }, text_content: label_text }));
        
        let input;
        if (is_textarea) {
            input = Helpers_create_element('textarea', { id: id, name: id, class_name: 'form-control', attributes: { rows: 4 } });
            input.value = Array.isArray(value) ? value.join('\n') : (value || '');
            window.Helpers.init_auto_resize_for_textarea(input);
        } else {
            input = Helpers_create_element('input', { id: id, name: id, class_name: 'form-control', attributes: { type: input_type }});
            input.value = value || ''; 
        }
        form_group.appendChild(input);
        return form_group;
    }
    
    function _create_action_buttons(position) {
        const t = Translation_t;
        const actions_div = Helpers_create_element('div', { 
            class_name: 'form-actions', 
            style: { 
                marginTop: position === 'top' ? '1.5rem' : '2rem',
                marginBottom: position === 'top' ? '2rem' : '0',
                paddingBottom: position === 'top' ? '1.5rem' : '0',
                borderBottom: position === 'top' ? '1px dashed var(--secondary-color)' : 'none'
            } 
        });
        
        const save_button = Helpers_create_element('button', {
            type: 'submit',
            class_name: ['button', 'button-primary'],
            html_content: `<span>${t('save_changes_button')}</span>` + Helpers_get_icon_svg('save')
        });

        const cancel_button = Helpers_create_element('button', {
            type: 'button',
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('cancel_and_return_to_list')}</span>`
        });
        cancel_button.addEventListener('click', () => router_ref('rulefile_requirements'));
        
        actions_div.append(save_button, cancel_button);
        return actions_div;
    }
    
    function _create_classification_section(metadata, classifications) {
        const t = Translation_t;
        const fragment = document.createDocumentFragment();
        
        const section_wrapper = Helpers_create_element('div', { class_name: 'audit-section' });
        section_wrapper.appendChild(Helpers_create_element('h2', { text_content: t('classification_title') }));
        section_wrapper.appendChild(_create_form_group('main_category_text', 'mainCategoryText', metadata?.mainCategory?.text));
        section_wrapper.appendChild(_create_form_group('sub_category_text', 'subCategoryText', metadata?.subCategory?.text));
        fragment.appendChild(section_wrapper);

        const current_state = local_getState();
        const pour_taxonomy = current_state.ruleFileContent.metadata.taxonomies.find(tax => tax.id === 'wcag22-pour');
        
        if (pour_taxonomy && pour_taxonomy.concepts) {
            const pour_section = Helpers_create_element('div', { class_name: 'audit-section' });
            const fieldset = Helpers_create_element('div', { class_name: 'classification-group' });
            const legend_text = t('wcag_principles_title');
            pour_section.appendChild(Helpers_create_element('h2', { text_content: legend_text }));

            const selected_concepts = new Set((classifications || []).map(c => c.conceptId));
            
            pour_taxonomy.concepts.forEach(concept => {
                const wrapper = Helpers_create_element('div', { class_name: 'form-check' });
                const checkbox = Helpers_create_element('input', {
                    id: `classification-${concept.id}`,
                    class_name: 'form-check-input',
                    attributes: { type: 'checkbox', name: 'classification', value: concept.id }
                });
                if (selected_concepts.has(concept.id)) {
                    checkbox.checked = true;
                }
                const label = Helpers_create_element('label', { attributes: { for: `classification-${concept.id}` }, text_content: concept.label });
                wrapper.append(checkbox, label);
                fieldset.appendChild(wrapper);
            });
            pour_section.appendChild(fieldset);
            fragment.appendChild(pour_section);
        }
        
        return fragment;
    }

    function _create_impact_section(metadata) {
        const t = Translation_t;
        const section_wrapper = Helpers_create_element('div', { class_name: 'audit-section' });
        section_wrapper.appendChild(Helpers_create_element('h2', { text_content: t('impact_title') }));
        
        const impact_group = Helpers_create_element('div', { class_name: 'impact-group' });
        impact_group.appendChild(_create_form_group('primary_score', 'primaryScore', metadata?.impact?.primaryScore, false, 'number'));
        impact_group.appendChild(_create_form_group('secondary_score', 'secondaryScore', metadata?.impact?.secondaryScore, false, 'number'));

        const critical_wrapper = Helpers_create_element('div', { class_name: 'form-check' });
        const critical_checkbox = Helpers_create_element('input', { id: 'isCritical', name: 'isCritical', class_name: 'form-check-input', attributes: { type: 'checkbox' }});
        if (metadata?.impact?.isCritical) {
            critical_checkbox.checked = true;
        }
        critical_wrapper.appendChild(critical_checkbox);
        critical_wrapper.appendChild(Helpers_create_element('label', { attributes: { for: 'isCritical' }, text_content: t('is_critical') }));
        impact_group.appendChild(critical_wrapper);

        section_wrapper.appendChild(impact_group);
        return section_wrapper;
    }

    function _update_parent_checkbox_state(parent_checkbox) {
        const parent_id = parent_checkbox.dataset.parentId;
        if (!parent_id) return;

        const children = form_element_ref.querySelectorAll(`input[data-child-for="${parent_id}"]`);
        if (children.length === 0) return;

        const total_children = children.length;
        const checked_children = Array.from(children).filter(child => child.checked).length;

        if (checked_children === 0) {
            parent_checkbox.checked = false;
            parent_checkbox.indeterminate = false;
        } else if (checked_children === total_children) {
            parent_checkbox.checked = true;
            parent_checkbox.indeterminate = false;
        } else {
            parent_checkbox.checked = false;
            parent_checkbox.indeterminate = true;
        }
    }

    function _handle_content_type_change(event) {
        const target = event.target;
        if (target.type !== 'checkbox') return;

        if (target.dataset.parentId) {
            const parent_id = target.dataset.parentId;
            const children = form_element_ref.querySelectorAll(`input[data-child-for="${parent_id}"]`);
            children.forEach(child => child.checked = target.checked);
        } else if (target.dataset.childFor) {
            const parent_id = target.dataset.childFor;
            const parent_checkbox = form_element_ref.querySelector(`input[data-parent-id="${parent_id}"]`);
            if (parent_checkbox) {
                _update_parent_checkbox_state(parent_checkbox);
            }
        }
    }

    function _create_content_types_section(all_content_types, selected_content_types) {
        const t = Translation_t;
        const section_wrapper = Helpers_create_element('div', { class_name: 'audit-section' });
        section_wrapper.appendChild(Helpers_create_element('h2', { text_content: t('content_types_section_title') }));
        section_wrapper.addEventListener('change', _handle_content_type_change);

        all_content_types.forEach(group => {
            const fieldset = Helpers_create_element('fieldset', { class_name: 'content-type-parent-group-edit' });
            
            const legend = Helpers_create_element('legend');
            const parent_id = `ct-parent-${group.id}`;
            const parent_checkbox = Helpers_create_element('input', { id: parent_id, class_name: 'form-check-input', attributes: { type: 'checkbox', 'data-parent-id': group.id } });
            const parent_label = Helpers_create_element('label', { attributes: { for: parent_id }, text_content: group.text });
            legend.append(parent_checkbox, parent_label);
            fieldset.appendChild(legend);

            (group.types || []).forEach(child => {
                const child_id = `ct-child-${child.id}`;
                const is_checked = selected_content_types.includes(child.id);

                const child_wrapper = Helpers_create_element('div', { class_name: 'form-check content-type-child-item-edit' });
                const child_checkbox = Helpers_create_element('input', { 
                    id: child_id, 
                    class_name: 'form-check-input', 
                    attributes: { type: 'checkbox', name: 'contentType', value: child.id, 'data-child-for': group.id } 
                });
                if (is_checked) {
                    child_checkbox.checked = true;
                }
                const child_label = Helpers_create_element('label', { attributes: { for: child_id }, text_content: child.text });
                
                child_wrapper.append(child_checkbox, child_label);
                fieldset.appendChild(child_wrapper);
            });
            section_wrapper.appendChild(fieldset);
        });
        return section_wrapper;
    }
    
    function _rerender_all_sections(options = {}) {
        if (typeof options === 'boolean') {
            options = { animate_last_item: options };
        }
        const focus_target = options.focusTarget || null;
        const focus_animation_duration = options.animateInfo?.animationDuration || 0;
        const previous_layout = options.previousLayout || null;
        const t = Translation_t;
        const scroll_position = window.scrollY;
        
        // Spara referens till det element som hade fokus
        const active_element_id = (!focus_target && document.activeElement) ? document.activeElement.id : null;

        form_element_ref.innerHTML = ''; // Rensa hela formuläret

        const current_state = local_getState();
        
        form_element_ref.appendChild(_create_action_buttons('top'));

        const basic_info_section = Helpers_create_element('div', { class_name: 'audit-section' });
        basic_info_section.appendChild(Helpers_create_element('h2', { text_content: t('requirement_general_info_title') }));
        basic_info_section.appendChild(_create_form_group('requirement_title', 'title', local_requirement_data.title));
        basic_info_section.appendChild(_create_form_group('requirement_standard_reference_text', 'standardReferenceText', local_requirement_data.standardReference?.text));
        basic_info_section.appendChild(_create_form_group('requirement_standard_reference_url', 'standardReferenceUrl', local_requirement_data.standardReference?.url));
        form_element_ref.appendChild(basic_info_section);
        
        const help_texts_section = Helpers_create_element('div', { class_name: 'audit-section' });
        help_texts_section.appendChild(Helpers_create_element('h2', { text_content: t('help_texts_title') }));
        help_texts_section.appendChild(_create_form_group('requirement_expected_observation', 'expectedObservation', local_requirement_data.expectedObservation, true));
        help_texts_section.appendChild(_create_form_group('requirement_instructions', 'instructions', local_requirement_data.instructions, true));
        help_texts_section.appendChild(_create_form_group('requirement_exceptions', 'exceptions', local_requirement_data.exceptions, true));
        help_texts_section.appendChild(_create_form_group('requirement_common_errors', 'commonErrors', local_requirement_data.commonErrors, true));
        help_texts_section.appendChild(_create_form_group('requirement_tips', 'tips', local_requirement_data.tips, true));
        help_texts_section.appendChild(_create_form_group('requirement_examples', 'examples', local_requirement_data.examples, true));
        form_element_ref.appendChild(help_texts_section);
        
        const checks_container_wrapper = Helpers_create_element('div', { class_name: 'checks-container-edit' });
        form_element_ref.appendChild(checks_container_wrapper);
        _rerender_checks_section(options);
        _apply_flip_animation(previous_layout, options.animateInfo);
        
        form_element_ref.appendChild(_create_classification_section(local_requirement_data.metadata, local_requirement_data.classifications));
        form_element_ref.appendChild(_create_impact_section(local_requirement_data.metadata));

        const all_content_types = current_state.ruleFileContent.metadata.contentTypes || [];
        const selected_content_types = local_requirement_data.contentType || [];
        form_element_ref.appendChild(_create_content_types_section(all_content_types, selected_content_types));
        
        form_element_ref.appendChild(_create_action_buttons('bottom'));

        form_element_ref.querySelectorAll('input[data-parent-id]').forEach(_update_parent_checkbox_state);

        window.scrollTo(0, scroll_position);

        // Återställ fokus
        if (active_element_id) {
            const elementToFocus = document.getElementById(active_element_id);
            elementToFocus?.focus();
        }

        if (focus_target) {
            requestAnimationFrame(() => {
                _apply_focus_target(focus_target, focus_animation_duration);
            });
        }
    }

    function _rerender_checks_section(options = {}) {
        if (typeof options === 'boolean') {
            options = { animate_last_item: options };
        }
        const t = Translation_t;
        let checks_section = form_element_ref.querySelector('.checks-container-edit');
        if (!checks_section) return;

        checks_section.innerHTML = '';
        const checks_heading = Helpers_create_element('h2', { 
            id: 'checks-section-heading',
            text_content: t('checks_title'),
            attributes: { tabindex: '-1' }
        });
        checks_section.appendChild(checks_heading);

        const checks = local_requirement_data.checks || [];
        checks.forEach((check, index) => {
            const check_el = _create_check_fieldset(check, index, checks.length);
            checks_section.appendChild(check_el);
        });

        const add_check_button = Helpers_create_element('button', { type: 'button', class_name: ['button', 'button-primary'], attributes: { 'data-action': 'add-check' }, text_content: t('add_check_button') });
        checks_section.appendChild(add_check_button);

        _apply_animation_info(options.animateInfo);
    }

    function _focus_element_simple(element, animation_duration, shouldForceScroll) {
        setTimeout(() => {
            try {
                if (shouldForceScroll && typeof element.scrollIntoView === 'function') {
                    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
                element.focus();
            } catch (_) {
                element.focus();
            }
        }, 200);
    }


    function _focus_element_with_delay(element, animation_duration, shouldForceScroll) {
        const focusDelay = Math.max(120, Math.min(animation_duration || 300, 500));

        if (shouldForceScroll && typeof element.scrollIntoView === 'function') {
            requestAnimationFrame(() => {
                try {
                    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
                } catch (_) {
                    element.scrollIntoView();
                }
            });
        }

        window.customFocusApplied = true;
        const protectFocus = (event) => {
            if (window.customFocusApplied && event.target !== element) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        document.addEventListener('focusin', protectFocus, true);

        const releaseProtection = () => {
            document.removeEventListener('focusin', protectFocus, true);
            window.customFocusApplied = false;
        };

        setTimeout(() => {
            try {
                if (shouldForceScroll) {
                    element.focus();
                } else {
                    element.focus({ preventScroll: true });
                }
            } catch (_) {
                element.focus();
            } finally {
                setTimeout(releaseProtection, 600);
            }
        }, focusDelay);
    }

    function _apply_focus_target(focus_target, animation_duration = 0) {
        if (!focus_target || !form_element_ref) return;
        const shouldForceScroll = focus_target.forceScroll === true;

        // Handle new checkpoint focus
        if (focus_target.type === 'new_check') {
            const check_element = form_element_ref.querySelector(`.check-item-edit[data-check-id="${focus_target.checkId}"]`);
            if (!check_element) return;
            
            // Focus on the first input field in the new checkpoint
            const first_input = check_element.querySelector('textarea, input[type="text"]');
            if (first_input) {
                // Use a simple, direct approach
                _focus_element_simple(first_input, animation_duration, shouldForceScroll);
            }
            return;
        }

        // Handle new pass criterion focus
        if (focus_target.type === 'new_pass_criterion') {
            const pc_element = form_element_ref.querySelector(`.pc-item-edit[data-pc-id="${focus_target.passCriterionId}"]`);
            if (!pc_element) return;
            
            // Focus on the first input field in the new pass criterion
            const first_input = pc_element.querySelector('textarea, input[type="text"]');
            if (first_input) {
                // Use a simple, direct approach
                _focus_element_simple(first_input, animation_duration, shouldForceScroll);
            }
            return;
        }

        // Handle legacy control focus (for backwards compatibility)
        if (focus_target.type === 'control' && typeof focus_target.selector === 'string') {
            const control_element = form_element_ref.querySelector(focus_target.selector);
            if (control_element) {
                _focus_element_with_delay(control_element, animation_duration, shouldForceScroll);
            }
            return;
        }

        // Handle other focus types (check, passCriterion for existing items)
        let container = null;
        if (focus_target.type === 'check') {
            container = form_element_ref.querySelector(`.check-item-edit[data-check-id="${focus_target.checkId}"]`);
        } else if (focus_target.type === 'passCriterion') {
            const check_container = form_element_ref.querySelector(`.check-item-edit[data-check-id="${focus_target.checkId}"]`);
            container = check_container?.querySelector(`.pc-item-edit[data-pc-id="${focus_target.passCriterionId}"]`);
        }
        if (!container) return;

        const action_order = Array.isArray(focus_target.actionOrder) ? focus_target.actionOrder : [];
        let button_to_focus = null;
        for (const action_name of action_order) {
            if (typeof action_name !== 'string' || !action_name) continue;
            const candidate = container.querySelector(`button[data-action="${action_name}"]`);
            if (candidate) {
                button_to_focus = candidate;
                break;
            }
        }
        if (!button_to_focus) {
            button_to_focus = container.querySelector('button[data-action^="move-"]') || container.querySelector('button');
        }
        if (!button_to_focus) return;

        _focus_element_with_delay(button_to_focus, animation_duration, shouldForceScroll);
    }

    function _apply_animation_info(animate_info) {
        if (!animate_info || !form_element_ref) return;
        const animation_class = animate_info.animationClass || 'new-item-animation';
        const animation_duration = animate_info.animationDuration || 400;

        requestAnimationFrame(() => {
            let target_element = null;
            if (animate_info.type === 'check') {
                target_element = form_element_ref.querySelector(`.check-item-edit[data-check-id="${animate_info.checkId}"]`);
            } else if (animate_info.type === 'passCriterion') {
                const check_container = form_element_ref.querySelector(`.check-item-edit[data-check-id="${animate_info.checkId}"]`);
                target_element = check_container?.querySelector(`.pc-item-edit[data-pc-id="${animate_info.passCriterionId}"]`);
            }
            if (!target_element) return;

            const zIndexValue = (animate_info.animationClass === 'item-swap-animation') ? '50' : '20';
            target_element.style.zIndex = zIndexValue;
            target_element.classList.add(animation_class);

            if (animate_info.animationClass === 'item-swap-animation') {
                const is_dark = document.documentElement.getAttribute('data-theme') === 'dark';
                const start_color = is_dark ? 'rgba(120, 180, 255, 0.65)' : 'rgba(0, 123, 255, 0.45)';
                const end_color = is_dark ? 'rgba(120, 180, 255, 0)' : 'rgba(0, 123, 255, 0)';
                target_element.animate([
                    { boxShadow: `0 0 0 6px ${start_color}` },
                    { boxShadow: `0 0 0 0 ${end_color}` }
                ], {
                    duration: animation_duration,
                    easing: 'ease-out'
                });
            }

            setTimeout(() => {
                target_element.classList.remove(animation_class);
                target_element.style.removeProperty('z-index');
            }, animation_duration);
        });
    }

    function _capture_positions() {
        if (!form_element_ref) return null;
        const layout = { checks: {}, passCriteria: {} };
        form_element_ref.querySelectorAll('.check-item-edit').forEach(checkEl => {
            const check_id = checkEl.dataset.checkId;
            if (!check_id) return;
            layout.checks[check_id] = checkEl.getBoundingClientRect();
            checkEl.querySelectorAll('.pc-item-edit').forEach(pcEl => {
                const pc_id = pcEl.dataset.pcId;
                if (!pc_id) return;
                layout.passCriteria[`${check_id}::${pc_id}`] = pcEl.getBoundingClientRect();
            });
        });
        return layout;
    }

    function _add_new_check_element(check_id) {
        const t = Translation_t;
        const checks_section = form_element_ref.querySelector('.checks-container-edit');
        if (!checks_section) return;
        
        const checks = local_requirement_data.checks || [];
        const check = checks.find(c => c.id === check_id);
        if (!check) return;
        
        const index = checks.findIndex(c => c.id === check_id);
        const check_el = _create_check_fieldset(check, index, checks.length);
        
        // Lägg till elementet före "Lägg till kontrollpunkt"-knappen
        const add_button = checks_section.querySelector('button[data-action="add-check"]');
        if (add_button) {
            checks_section.insertBefore(check_el, add_button);
        } else {
            checks_section.appendChild(check_el);
        }
        
        const heading = check_el.querySelector('[data-focus-target="check-heading"]');
        const target_for_focus = heading || check_el.querySelector('textarea, input[type="text"]');
        if (target_for_focus) {
            if (typeof window !== 'undefined') {
                window.customFocusApplied = true;
            }
            requestAnimationFrame(() => {
                check_el.classList.add('new-item-animation');
                setTimeout(() => {
                    check_el.classList.remove('new-item-animation');
                }, 500);
            });
            setTimeout(() => {
                try {
                    target_for_focus.focus({ preventScroll: false });
                } catch (_) {
                    target_for_focus.focus();
                }

                setTimeout(() => {
                    if (typeof window !== 'undefined') {
                        window.customFocusApplied = false;
                    }
                }, 2000);
            }, 150);
        }
    }
    
    function _add_new_pass_criterion_element(check_id, pc_id) {
        const t = Translation_t;
        const check_element = form_element_ref.querySelector(`.check-item-edit[data-check-id="${check_id}"]`);
        if (!check_element) return;
        
        const pc_container = check_element.querySelector('.pc-container-edit');
        if (!pc_container) return;
        
        const check = local_requirement_data.checks.find(c => c.id === check_id);
        if (!check) return;
        
        const pc = check.passCriteria.find(pc => pc.id === pc_id);
        if (!pc) return;
        
        const pc_index = check.passCriteria.findIndex(pc => pc.id === pc_id);
        const check_index = local_requirement_data.checks.findIndex(c => c.id === check_id);
        const pc_el = _create_pc_item(check, pc, Helpers_sanitize_id_for_css_selector(check_id), pc_index, check.passCriteria.length, check_index);
        
        // Lägg till elementet före "Lägg till kriterium"-knappen
        const add_button = pc_container.querySelector('button[data-action="add-pass-criterion"]');
        if (add_button) {
            pc_container.insertBefore(pc_el, add_button);
        } else {
            pc_container.appendChild(pc_el);
        }
        
        const criterionHeading = pc_el.querySelector('[data-focus-target="criterion-heading"]');
        const pc_focus_target = criterionHeading || pc_el.querySelector('textarea, input[type="text"]');
        if (pc_focus_target) {
            if (typeof window !== 'undefined') {
                window.customFocusApplied = true;
            }
            requestAnimationFrame(() => {
                pc_el.classList.add('new-item-animation');
                setTimeout(() => {
                    pc_el.classList.remove('new-item-animation');
                }, 500);
            });
            setTimeout(() => {
                try {
                    pc_focus_target.focus({ preventScroll: false });
                } catch (_) {
                    pc_focus_target.focus();
                }

                setTimeout(() => {
                    if (typeof window !== 'undefined') {
                        window.customFocusApplied = false;
                    }
                }, 2000);
            }, 150);
        }
    }

    function _apply_flip_animation(previous_layout, animate_info) {
        if (!previous_layout || !form_element_ref) return;
        const flip_duration = animate_info?.animationDuration || 250;

        requestAnimationFrame(() => {
            const animate_element = (element, prev_rect, context) => {
                if (!element || !prev_rect) return;
                const new_rect = element.getBoundingClientRect();
                const delta_x = prev_rect.left - new_rect.left;
                const delta_y = prev_rect.top - new_rect.top;
                if (Math.abs(delta_x) < 1 && Math.abs(delta_y) < 1) return;
                const is_target = animate_info && (
                    (animate_info.type === 'check' && context?.checkId === animate_info.checkId && !context?.passCriterionId) ||
                    (animate_info.type === 'passCriterion' && context?.checkId === animate_info.checkId && context?.passCriterionId === animate_info.passCriterionId)
                );
                if (is_target) {
                    element.style.zIndex = '50';
                }
                const animation = element.animate([
                    { transform: `translate(${delta_x}px, ${delta_y}px)` },
                    { transform: 'translate(0, 0)' }
                ], {
                    duration: flip_duration,
                    easing: 'ease-out'
                });
                animation.onfinish = animation.oncancel = () => {
                    if (is_target) {
                        element.style.removeProperty('z-index');
                    }
                };
            };

            form_element_ref.querySelectorAll('.check-item-edit').forEach(checkEl => {
                const check_id = checkEl.dataset.checkId;
                animate_element(checkEl, previous_layout.checks?.[check_id], { checkId: check_id });
                checkEl.querySelectorAll('.pc-item-edit').forEach(pcEl => {
                    const pc_id = pcEl.dataset.pcId;
                    animate_element(pcEl, previous_layout.passCriteria?.[`${check_id}::${pc_id}`], { checkId: check_id, passCriterionId: pc_id });
                });
            });
        });
    }
    
    function _create_check_fieldset(check, index, total_checks) {
        const t = Translation_t;
        const sane_check_id = Helpers_sanitize_id_for_css_selector(check.id);
        const check_el = Helpers_create_element('div', { class_name: 'check-item-edit', attributes: { 'data-check-id': check.id }});

        const header_wrapper = Helpers_create_element('div', { class_name: 'form-group-header' });
        const check_label_text = `${t('check_item_title')} ${index + 1}`;
        header_wrapper.appendChild(Helpers_create_element('label', {
            attributes: {
                for: `check_${sane_check_id}_condition`,
                tabindex: '-1',
                'data-focus-target': 'check-heading'
            },
            text_content: check_label_text
        }));

        const header_actions = Helpers_create_element('div', { class_name: 'form-group-header-actions' });
        if (index > 0) {
            header_actions.appendChild(_create_move_check_button('up', check));
        }
        if (index < total_checks - 1) {
            header_actions.appendChild(_create_move_check_button('down', check));
        }
        const delete_check_btn = Helpers_create_element('button', {
            type: 'button', 
            class_name: 'button button-danger button-small delete-item-btn', 
            attributes: {
                'data-action': 'delete-check',
                'aria-label': t('delete_check_aria_label', { conditionText: check.condition || t('aria_label_empty_content') })
            }, 
            html_content: `<span>${t('delete_check_button')}</span>` + Helpers_get_icon_svg('delete')
        });
        header_actions.appendChild(delete_check_btn);
        header_wrapper.appendChild(header_actions);
        check_el.appendChild(header_wrapper);
        
        check_el.appendChild(_create_form_group('check_condition_label', `check_${sane_check_id}_condition`, check.condition, true));

        const logic_fieldset = Helpers_create_element('fieldset', { class_name: 'check-logic-group' });
        logic_fieldset.appendChild(Helpers_create_element('legend', { text_content: t('check_logic_title') }));
        const logic_and = Helpers_create_element('input', { id: `logic_${sane_check_id}_and`, name: `check_${sane_check_id}_logic`, value: 'AND', attributes: { type: 'radio' } });
        if (!check.logic || check.logic.toUpperCase() === 'AND') logic_and.checked = true;
        const logic_or = Helpers_create_element('input', { id: `logic_${sane_check_id}_or`, name: `check_${sane_check_id}_logic`, value: 'OR', attributes: { type: 'radio' } });
        if (check.logic?.toUpperCase() === 'OR') logic_or.checked = true;
        
        logic_fieldset.append(
            Helpers_create_element('div', { class_name: 'form-check', children: [logic_and, Helpers_create_element('label', { attributes: { for: `logic_${sane_check_id}_and` }, text_content: t('check_logic_and') })] }),
            Helpers_create_element('div', { class_name: 'form-check', children: [logic_or, Helpers_create_element('label', { attributes: { for: `logic_${sane_check_id}_or` }, text_content: t('check_logic_or') })] })
        );
        check_el.appendChild(logic_fieldset);
        
        const pc_container = Helpers_create_element('div', { class_name: 'pc-container-edit' });
        const pc_heading = Helpers_create_element('h3', { 
            id: `pass-criteria-heading-${sane_check_id}`,
            text_content: t('pass_criteria_title'),
            attributes: { tabindex: '-1' }
        });
        pc_container.appendChild(pc_heading);
        
        const pass_criteria = check.passCriteria || [];
        pass_criteria.forEach((pc, pc_index) => {
            pc_container.appendChild(_create_pc_item(check, pc, sane_check_id, pc_index, pass_criteria.length, index));
        });
        
        const add_pc_button = Helpers_create_element('button', { type: 'button', class_name: ['button', 'button-default', 'button-small'], attributes: { 'data-action': 'add-pass-criterion' }, text_content: t('add_criterion_button') });
        pc_container.appendChild(add_pc_button);
        check_el.appendChild(pc_container);

        return check_el;
    }

    function _create_pc_item(check, pc, sane_check_id, pc_index, total_pass_criteria, check_index) {
        const t = Translation_t;
        const sane_pc_id = Helpers_sanitize_id_for_css_selector(pc.id);
        const pc_el = Helpers_create_element('div', { class_name: 'pc-item-edit', attributes: { 'data-pc-id': pc.id } });

        const numbering = `${check_index + 1}.${pc_index + 1}`;
        const numbered_label_text = `${t('pass_criterion_label')} ${numbering}`;

        const header_wrapper = Helpers_create_element('div', { class_name: 'form-group-header' });
        header_wrapper.appendChild(Helpers_create_element('span', {
            class_name: 'form-group-header-title',
            text_content: numbered_label_text,
            attributes: {
                tabindex: '-1',
                'data-focus-target': 'criterion-heading',
                role: 'heading',
                'aria-level': '4'
            }
        }));

        const header_actions = Helpers_create_element('div', { class_name: 'form-group-header-actions' });
        if (pc_index > 0) {
            header_actions.appendChild(_create_move_pass_criterion_button('up', check, pc));
        }
        if (pc_index < total_pass_criteria - 1) {
            header_actions.appendChild(_create_move_pass_criterion_button('down', check, pc));
        }

        const delete_pc_btn = Helpers_create_element('button', {
            type: 'button', 
            class_name: 'button button-danger button-small delete-item-btn', 
            attributes: {
                'data-action': 'delete-pass-criterion',
                'aria-label': t('delete_criterion_aria_label', { criterionText: pc.requirement || t('aria_label_empty_content') })
            }, 
            html_content: `<span>${t('delete_criterion_button')}</span>` + Helpers_get_icon_svg('delete')
        });
        header_actions.appendChild(delete_pc_btn);
        header_wrapper.appendChild(header_actions);
        pc_el.appendChild(header_wrapper);
        const requirement_group = _create_form_group('pass_criterion_field_label', `pc_${sane_check_id}_${sane_pc_id}_requirement`, pc.requirement, true);
        const requirement_textarea = requirement_group.querySelector('textarea');
        if (requirement_textarea) {
            requirement_textarea.setAttribute('aria-label', numbered_label_text);
        }
        pc_el.appendChild(requirement_group);
        pc_el.appendChild(_create_form_group('failure_template_label', `pc_${sane_check_id}_${sane_pc_id}_failureTemplate`, pc.failureStatementTemplate, true));
        return pc_el;
    }

    function render() {
        const t = Translation_t;
        app_container_ref.innerHTML = '';
        const plate_element = Helpers_create_element('div', { class_name: 'content-plate requirement-audit-plate' });
        
        const requirement_id = params_ref?.id;
        const current_state = local_getState();
        const is_new_requirement = requirement_id === 'new';
        
        if (is_new_requirement) {
            // Skapa tom kravstruktur för nytt krav
            local_requirement_data = {
                title: '',
                expectedObservation: '',
                instructions: '',
                exceptions: '',
                commonErrors: '',
                tips: '',
                examples: '',
                standardReference: { text: '', url: '' },
                metadata: {
                    mainCategory: { text: '' },
                    subCategory: { text: '' },
                    impact: {
                        isCritical: false,
                        primaryScore: 0,
                        secondaryScore: 0
                    }
                },
                contentType: [],
                classifications: [],
                checks: []
            };
        } else {
            const requirement_from_store = current_state?.ruleFileContent?.requirements[requirement_id];
            if (!requirement_from_store) {
                plate_element.appendChild(Helpers_create_element('h1', { text_content: t('error_internal') }));
                app_container_ref.appendChild(plate_element);
                return;
            }
            local_requirement_data = JSON.parse(JSON.stringify(requirement_from_store));
        }

        const page_title = is_new_requirement 
            ? t('rulefile_add_requirement_title')
            : `${t('rulefile_edit_requirement_title')}: ${local_requirement_data.title}`;
        plate_element.appendChild(Helpers_create_element('h1', { text_content: page_title }));
        
        form_element_ref = Helpers_create_element('form');
        form_element_ref.addEventListener('submit', handle_form_submit);
        form_element_ref.addEventListener('click', handle_form_click);
        
        _rerender_all_sections();
        
        plate_element.appendChild(form_element_ref);
        app_container_ref.appendChild(plate_element);

        setTimeout(() => {
            const focusSelector = sessionStorage.getItem('focusAfterLoad');
            if (focusSelector) {
                sessionStorage.removeItem('focusAfterLoad');
                const elementToFocus = form_element_ref.querySelector(focusSelector);
                if (elementToFocus) {
                    try {
                        elementToFocus.focus();
                        window.customFocusApplied = true;
                    } catch (_) {
                        elementToFocus.focus();
                        window.customFocusApplied = true;
                    }
                    setTimeout(() => { window.customFocusApplied = false; }, 400);
                }
            }
        }, 100);
    }

    function destroy() {
        if (form_element_ref) {
            form_element_ref.removeEventListener('submit', handle_form_submit);
            form_element_ref.removeEventListener('click', handle_form_click);
        }
        app_container_ref.innerHTML = '';
        form_element_ref = null;
        local_requirement_data = null;
    }

    return { init, render, destroy };
})();

// js/components/EditRulefileRequirementComponent.js

export const EditRulefileRequirementComponent = {
    CSS_PATH_SHARED: 'css/components/requirement_audit_component.css',
    CSS_PATH_SPECIFIC: 'css/components/edit_rulefile_requirement_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.params = deps.params;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        
        this.form_element_ref = null;
        this.local_requirement_data = null;
        this.initial_requirement_snapshot = null;
        this.debounceTimerFormFields = null;

        // Bind methods
        this.handle_form_submit = this.handle_form_submit.bind(this);
        this.handle_form_click = this.handle_form_click.bind(this);
        this._handle_content_type_change = this._handle_content_type_change.bind(this);
        this.debounced_autosave_form = this.debounced_autosave_form.bind(this);
        
        await this.Helpers.load_css(this.CSS_PATH_SHARED).catch(e => console.warn(e));
        await this.Helpers.load_css(this.CSS_PATH_SPECIFIC).catch(e => console.warn(e));
    },

    _create_move_check_button(direction, check) {
        const t = this.Translation.t;
        const is_up = direction === 'up';
        const icon_name = is_up ? 'arrow_upward' : 'arrow_downward';
        return this.Helpers.create_element('button', {
            type: 'button',
            class_name: 'button button-default button-small move-item-btn',
            attributes: {
                'data-action': is_up ? 'move-check-up' : 'move-check-down',
                'aria-label': t(is_up ? 'move_check_up_aria_label' : 'move_check_down_aria_label', {
                    conditionText: check.condition || t('aria_label_empty_content')
                })
            },
            html_content: `<span>${t(is_up ? 'move_item_up' : 'move_item_down')}</span>` + this.Helpers.get_icon_svg(icon_name, ['currentColor'], 16)
        });
    },

    _create_move_pass_criterion_button(direction, check, pass_criterion) {
        const t = this.Translation.t;
        const is_up = direction === 'up';
        const icon_name = is_up ? 'arrow_upward' : 'arrow_downward';
        return this.Helpers.create_element('button', {
            type: 'button',
            class_name: 'button button-default button-small move-item-btn',
            attributes: {
                'data-action': is_up ? 'move-pass-criterion-up' : 'move-pass-criterion-down',
                'aria-label': t(is_up ? 'move_pass_criterion_up_aria_label' : 'move_pass_criterion_down_aria_label', {
                    criterionText: pass_criterion.requirement || t('aria_label_empty_content')
                })
            },
            html_content: `<span>${t(is_up ? 'move_item_up' : 'move_item_down')}</span>` + this.Helpers.get_icon_svg(icon_name, ['currentColor'], 16)
        });
    },

    _get_default_block_name(block_id) {
        const t = this.Translation.t;
        const name_map = {
            'expectedObservation': t('requirement_expected_observation'),
            'instructions': t('requirement_instructions'),
            'examples': t('requirement_examples'),
            'tips': t('requirement_tips'),
            'commonErrors': t('requirement_common_errors'),
            'exceptions': t('requirement_exceptions')
        };
        return name_map[block_id] || block_id;
    },

    _get_translation_key_for_block(block_id) {
        const key_map = {
            'expectedObservation': 'requirement_expected_observation',
            'instructions': 'requirement_instructions',
            'examples': 'requirement_examples',
            'tips': 'requirement_tips',
            'commonErrors': 'requirement_common_errors',
            'exceptions': 'requirement_exceptions'
        };
        return key_map[block_id];
    },

    _update_local_data_from_form() {
        if (!this.form_element_ref) return;
        
        // Trim alla strängvärden när de läses från formulärfält
        const titleValue = this.form_element_ref.querySelector('#title')?.value || '';
        this.local_requirement_data.title = typeof titleValue === 'string' ? titleValue.trim() : titleValue;
        
        // Support both old format (direct fields) and new format (infoBlocks)
        const has_info_blocks = this.local_requirement_data.infoBlocks && typeof this.local_requirement_data.infoBlocks === 'object';
        const current_state = this.getState();
        const block_order = current_state?.ruleFileContent?.metadata?.blockOrders?.infoBlocks || [];
        
        if (has_info_blocks) {
            // New format: update infoBlocks structure
            if (!this.local_requirement_data.infoBlocks) {
                this.local_requirement_data.infoBlocks = {};
            }
            
            const ordered_block_ids = [...block_order];
            const extra_block_ids = Array.from(this.form_element_ref.querySelectorAll('[data-block-id]'))
                .map(el => el.dataset.blockId)
                .filter(id => !ordered_block_ids.includes(id));
            ordered_block_ids.push(...extra_block_ids);
            
            ordered_block_ids.forEach(block_id => {
                if (!this.local_requirement_data.infoBlocks[block_id]) {
                    this.local_requirement_data.infoBlocks[block_id] = {
                        name: this._get_default_block_name(block_id),
                        expanded: true,
                        text: ''
                    };
                }
                
                const expanded_checkbox = this.form_element_ref.querySelector(`#infoBlock_${block_id}_expanded`);
                const text_textarea = this.form_element_ref.querySelector(`#infoBlock_${block_id}_text`);
                
                // Block name is now displayed as h2 and not editable, so we keep the existing name
                // No need to update it from form
                
                if (expanded_checkbox) {
                    this.local_requirement_data.infoBlocks[block_id].expanded = expanded_checkbox.checked;
                }
                if (text_textarea) {
                    const textValue = text_textarea.value || '';
                    this.local_requirement_data.infoBlocks[block_id].text = typeof textValue === 'string' ? textValue.trim() : textValue;
                }
            });
        } else {
            // Old format: fallback to direct fields (for backward compatibility)
            const expectedObservationValue = this.form_element_ref.querySelector('#expectedObservation')?.value || '';
            this.local_requirement_data.expectedObservation = typeof expectedObservationValue === 'string' ? expectedObservationValue.trim() : expectedObservationValue;
            
            const instructionsValue = this.form_element_ref.querySelector('#instructions')?.value || '';
            this.local_requirement_data.instructions = typeof instructionsValue === 'string' ? instructionsValue.trim() : instructionsValue;
            
            const exceptionsValue = this.form_element_ref.querySelector('#exceptions')?.value || '';
            this.local_requirement_data.exceptions = typeof exceptionsValue === 'string' ? exceptionsValue.trim() : exceptionsValue;
            
            const commonErrorsValue = this.form_element_ref.querySelector('#commonErrors')?.value || '';
            this.local_requirement_data.commonErrors = typeof commonErrorsValue === 'string' ? commonErrorsValue.trim() : commonErrorsValue;
            
            const tipsValue = this.form_element_ref.querySelector('#tips')?.value || '';
            this.local_requirement_data.tips = typeof tipsValue === 'string' ? tipsValue.trim() : tipsValue;
            
            const examplesValue = this.form_element_ref.querySelector('#examples')?.value || '';
            this.local_requirement_data.examples = typeof examplesValue === 'string' ? examplesValue.trim() : examplesValue;
        }
        
        if (!this.local_requirement_data.standardReference) {
            this.local_requirement_data.standardReference = { text: '', url: '' };
        }
        const standardRefTextValue = this.form_element_ref.querySelector('#standardReferenceText')?.value || '';
        this.local_requirement_data.standardReference.text = typeof standardRefTextValue === 'string' ? standardRefTextValue.trim() : standardRefTextValue;
        
        const standardRefUrlValue = this.form_element_ref.querySelector('#standardReferenceUrl')?.value || '';
        this.local_requirement_data.standardReference.url = typeof standardRefUrlValue === 'string' ? standardRefUrlValue.trim() : standardRefUrlValue;

        if (!this.local_requirement_data.metadata) {
            this.local_requirement_data.metadata = {};
        }
        if (!this.local_requirement_data.metadata.mainCategory) {
            this.local_requirement_data.metadata.mainCategory = { text: '' };
        }
        const mainCategoryTextValue = this.form_element_ref.querySelector('#mainCategoryText')?.value || '';
        this.local_requirement_data.metadata.mainCategory.text = typeof mainCategoryTextValue === 'string' ? mainCategoryTextValue.trim() : mainCategoryTextValue;

        if (!this.local_requirement_data.metadata.subCategory) {
            this.local_requirement_data.metadata.subCategory = { text: '' };
        }
        const subCategoryTextValue = this.form_element_ref.querySelector('#subCategoryText')?.value || '';
        this.local_requirement_data.metadata.subCategory.text = typeof subCategoryTextValue === 'string' ? subCategoryTextValue.trim() : subCategoryTextValue;

        if (!this.local_requirement_data.metadata.impact) {
            this.local_requirement_data.metadata.impact = {};
        }
        this.local_requirement_data.metadata.impact.isCritical = this.form_element_ref.querySelector('#isCritical')?.checked || false;
        this.local_requirement_data.metadata.impact.primaryScore = parseInt(this.form_element_ref.querySelector('#primaryScore')?.value, 10) || 0;
        this.local_requirement_data.metadata.impact.secondaryScore = parseInt(this.form_element_ref.querySelector('#secondaryScore')?.value, 10) || 0;

        this.local_requirement_data.contentType = Array.from(this.form_element_ref.querySelectorAll('input[name="contentType"]:checked')).map(cb => cb.value);

        const existing_classifications = Array.isArray(this.local_requirement_data.classifications) ? this.local_requirement_data.classifications : [];
        const preserved_classifications = existing_classifications.filter(c => c?.taxonomyId && c.taxonomyId !== 'wcag22-pour');
        const selected_pour_concept_ids = Array.from(this.form_element_ref.querySelectorAll('input[name="classification"]:checked')).map(cb => cb.value);
        const unique_pour_concepts = Array.from(new Set(selected_pour_concept_ids)).map(conceptId => ({
            taxonomyId: 'wcag22-pour',
            conceptId
        }));
        this.local_requirement_data.classifications = [...preserved_classifications, ...unique_pour_concepts];

        const checks_data = [];
        this.form_element_ref.querySelectorAll('.check-item-edit').forEach(check_el => {
            const check_id = check_el.dataset.checkId;
            const sane_check_id = this.Helpers.sanitize_id_for_css_selector(check_id);
            const conditionValue = check_el.querySelector(`#check_${sane_check_id}_condition`)?.value || '';
            const check_obj = {
                id: check_id,
                condition: typeof conditionValue === 'string' ? conditionValue.trim() : conditionValue,
                logic: check_el.querySelector(`input[name="check_${sane_check_id}_logic"]:checked`)?.value || 'AND',
                passCriteria: []
            };

            check_el.querySelectorAll('.pc-item-edit').forEach(pc_el => {
                const pc_id = pc_el.dataset.pcId;
                const sane_pc_id = this.Helpers.sanitize_id_for_css_selector(pc_id);
                const requirementValue = pc_el.querySelector(`#pc_${sane_check_id}_${sane_pc_id}_requirement`)?.value || '';
                const failureTemplateValue = pc_el.querySelector(`#pc_${sane_check_id}_${sane_pc_id}_failureTemplate`)?.value || '';
                check_obj.passCriteria.push({
                    id: pc_id,
                    requirement: typeof requirementValue === 'string' ? requirementValue.trim() : requirementValue,
                    failureStatementTemplate: typeof failureTemplateValue === 'string' ? failureTemplateValue.trim() : failureTemplateValue
                });
            });
            checks_data.push(check_obj);
        });
        this.local_requirement_data.checks = checks_data;
    },

    debounced_autosave_form() {
        const is_new_requirement = this.params?.id === 'new';
        if (is_new_requirement || !this.local_requirement_data) return;
        
        clearTimeout(this.debounceTimerFormFields);
        this.debounceTimerFormFields = setTimeout(() => {
            this.save_form_data_immediately();
        }, 250);
    },

    save_form_data_immediately() {
        const is_new_requirement = this.params?.id === 'new';
        if (is_new_requirement || !this.local_requirement_data) return; 
        
        this._update_local_data_from_form();
        if (typeof window !== 'undefined') {
            window.skipRulefileRequirementRender = (Number(window.skipRulefileRequirementRender) || 0) + 1;
        }
        this.dispatch({
            type: this.StoreActionTypes.UPDATE_REQUIREMENT_DEFINITION,
            payload: { requirementId: this.params.id, updatedRequirementData: this.local_requirement_data }
        });
    },

    handle_form_submit(event) {
        event.preventDefault();
        this._update_local_data_from_form(); 

        const t = this.Translation.t;
        if (!this.local_requirement_data.title.trim()) {
            this.NotificationComponent.show_global_message(t('field_is_required', { fieldName: t('requirement_title') }), 'error');
            if (!window.focusProtectionActive && !window.customFocusApplied) {
                this.form_element_ref.querySelector('#title')?.focus();
            }
            return;
        }
        
        const is_new_requirement = this.params.id === 'new';
        
        if (is_new_requirement) {
            const new_id = this.Helpers.generate_uuid_v4();
            const new_key = (this.local_requirement_data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 50) || 'req') + '-' + new_id.substring(0, 8);
            
            this.local_requirement_data.id = new_id;
            this.local_requirement_data.key = new_key;
            
            this.dispatch({
                type: this.StoreActionTypes.ADD_REQUIREMENT_DEFINITION,
                payload: {
                    requirementId: new_key,
                    newRequirementData: this.local_requirement_data
                }
            });
            if (window.DraftManager?.commitCurrentDraft) {
                window.DraftManager.commitCurrentDraft();
            }
            
            this.NotificationComponent.show_global_message(t('requirement_added_successfully', { reqTitle: this.local_requirement_data.title }), 'success');
            this.router('rulefile_view_requirement', { id: new_key });
        } else {
            this.dispatch({
                type: this.StoreActionTypes.UPDATE_REQUIREMENT_DEFINITION,
                payload: {
                    requirementId: this.params.id,
                    updatedRequirementData: this.local_requirement_data
                }
            });
            if (window.DraftManager?.commitCurrentDraft) {
                window.DraftManager.commitCurrentDraft();
            }
            
            this.NotificationComponent.show_global_message(t('rulefile_requirement_saved'), 'success');
            this.router('rulefile_view_requirement', { id: this.params.id });
        }
    },
    
    handle_form_click(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        event.stopPropagation();
        event.preventDefault();
        
        this._update_local_data_from_form();

        const previous_layout = this._capture_positions();

        const action = button.dataset.action;
        let check_id, pc_id;

        switch (action) {
            case 'add-check':
                const new_check_id = `new-check-${this.Helpers.generate_uuid_v4()}`;
                this.local_requirement_data.checks.push({
                    id: new_check_id,
                    condition: '',
                    logic: 'AND',
                    passCriteria: []
                });

                const is_new_requirement_check = this.params.id === 'new';
                if (!is_new_requirement_check) {
                    if (typeof window !== 'undefined') {
                        window.skipRulefileRequirementRender = (Number(window.skipRulefileRequirementRender) || 0) + 1;
                    }
                    this.dispatch({
                        type: this.StoreActionTypes.UPDATE_REQUIREMENT_DEFINITION,
                        payload: { requirementId: this.params.id, updatedRequirementData: this.local_requirement_data }
                    });
                }
                this._add_new_check_element(new_check_id);
                break;

            case 'delete-check':
                check_id = button.closest('.check-item-edit')?.dataset.checkId;
                if (check_id) {
                    const is_new_req_del = this.params.id === 'new';
                    if (is_new_req_del) {
                        this.local_requirement_data.checks = this.local_requirement_data.checks.filter(c => c.id !== check_id);
                        this._rerender_checks_section();
                    } else {
                        this.router('confirm_delete', { type: 'check', reqId: this.params.id, checkId: check_id });
                    }
                }
                break;

            case 'move-check-up':
            case 'move-check-down':
                check_id = button.closest('.check-item-edit')?.dataset.checkId;
                if (check_id) {
                    const checks = this.local_requirement_data.checks || [];
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
                            this._rerender_all_sections({
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
                const check = this.local_requirement_data.checks.find(c => c.id === check_id);
                if (check) {
                    const new_pc_id = `new-pc-${this.Helpers.generate_uuid_v4()}`;
                    check.passCriteria.push({
                        id: new_pc_id,
                        requirement: '',
                        failureStatementTemplate: ''
                    });

                    const is_new_req_pc = this.params.id === 'new';
                    if (!is_new_req_pc) {
                        if (typeof window !== 'undefined') {
                            window.skipRulefileRequirementRender = (Number(window.skipRulefileRequirementRender) || 0) + 1;
                        }
                        this.dispatch({
                            type: this.StoreActionTypes.UPDATE_REQUIREMENT_DEFINITION,
                            payload: { requirementId: this.params.id, updatedRequirementData: this.local_requirement_data }
                        });
                    }
                    this._add_new_pass_criterion_element(check_id, new_pc_id);
                }
                break;

            case 'delete-pass-criterion':
                const pc_item = button.closest('.pc-item-edit');
                check_id = button.closest('.check-item-edit')?.dataset.checkId;
                pc_id = pc_item?.dataset.pcId;
                if (check_id && pc_id) {
                    const is_new_req_del_pc = this.params.id === 'new';
                    if (is_new_req_del_pc) {
                        const check = this.local_requirement_data.checks.find(c => c.id === check_id);
                        if (check) {
                            check.passCriteria = check.passCriteria.filter(pc => pc.id !== pc_id);
                            this._rerender_checks_section();
                        }
                    } else {
                        this.router('confirm_delete', { type: 'criterion', reqId: this.params.id, checkId: check_id, pcId: pc_id });
                    }
                }
                break;

            case 'move-pass-criterion-up':
            case 'move-pass-criterion-down':
                check_id = button.closest('.check-item-edit')?.dataset.checkId;
                pc_id = button.closest('.pc-item-edit')?.dataset.pcId;
                if (check_id && pc_id) {
                    const check_for_move = this.local_requirement_data.checks.find(c => c.id === check_id);
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
                                this._rerender_all_sections({
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
    },

    _create_form_group(label_key, id, value, is_textarea = false, input_type = 'text', label_text_override = null) {
        const t = this.Translation.t;
        const form_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        const label_text = label_text_override || t(label_key);
        const label = this.Helpers.create_element('label', { attributes: { for: id }, text_content: label_text });
        
        // Wrap label text in <strong> for text inputs and textareas
        if ((is_textarea || input_type === 'text') && label_text) {
            label.innerHTML = `<strong>${label_text}</strong>`;
        }
        
        form_group.appendChild(label);
        
        let input;
        if (is_textarea) {
            input = this.Helpers.create_element('textarea', { id: id, name: id, class_name: 'form-control', attributes: { rows: 4 } });
            input.value = Array.isArray(value) ? value.join('\n') : (value || '');
            input.addEventListener('input', this.debounced_autosave_form);
            window.Helpers.init_auto_resize_for_textarea(input);
        } else {
            input = this.Helpers.create_element('input', { id: id, name: id, class_name: 'form-control', attributes: { type: input_type }});
            input.value = value || '';
            if (input_type === 'text' || input_type === 'number') {
                input.addEventListener('input', this.debounced_autosave_form);
            }
        }
        form_group.appendChild(input);
        return form_group;
    },
    
    _create_action_buttons(position) {
        const t = this.Translation.t;
        const actions_div = this.Helpers.create_element('div', { 
            class_name: 'form-actions', 
            style: { 
                marginTop: position === 'top' ? '1.5rem' : '2rem',
                marginBottom: position === 'top' ? '2rem' : '0',
                paddingBottom: position === 'top' ? '1.5rem' : '0',
                borderBottom: position === 'top' ? '1px dashed var(--secondary-color)' : 'none'
            } 
        });
        
        const save_button = this.Helpers.create_element('button', {
            type: 'submit',
            class_name: ['button', 'button-primary'],
            html_content: `<span>${t('save_changes_button')}</span>` + this.Helpers.get_icon_svg('save')
        });

        const cancel_button = this.Helpers.create_element('button', {
            type: 'button',
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('back_to_requirement_list_without_saving')}</span>`
        });
        cancel_button.addEventListener('click', () => {
            this._restore_initial_state();
            this.router('rulefile_requirements');
        });
        
        actions_div.append(save_button, cancel_button);
        return actions_div;
    },
    
    _create_classification_section(metadata, classifications) {
        const t = this.Translation.t;
        const fragment = document.createDocumentFragment();
        
        const section_wrapper = this.Helpers.create_element('div', { class_name: 'audit-section' });
        section_wrapper.appendChild(this.Helpers.create_element('h2', { text_content: t('classification_title') }));
        section_wrapper.appendChild(this._create_form_group('main_category_text', 'mainCategoryText', metadata?.mainCategory?.text));
        section_wrapper.appendChild(this._create_form_group('sub_category_text', 'subCategoryText', metadata?.subCategory?.text));
        fragment.appendChild(section_wrapper);

        const current_state = this.getState();
        const taxonomies = current_state.ruleFileContent.metadata?.vocabularies?.taxonomies || current_state.ruleFileContent.metadata?.taxonomies || [];
        const pour_taxonomy = taxonomies.find(tax => tax.id === 'wcag22-pour');
        
        if (pour_taxonomy && pour_taxonomy.concepts) {
            const pour_section = this.Helpers.create_element('div', { class_name: 'audit-section' });
            const fieldset = this.Helpers.create_element('div', { class_name: 'classification-group' });
            const legend_text = t('wcag_principles_title');
            pour_section.appendChild(this.Helpers.create_element('h2', { text_content: legend_text }));

            const selected_concepts = new Set((classifications || []).map(c => c.conceptId));
            
            pour_taxonomy.concepts.forEach(concept => {
                const wrapper = this.Helpers.create_element('div', { class_name: 'form-check' });
                const checkbox = this.Helpers.create_element('input', {
                    id: `classification-${concept.id}`,
                    class_name: 'form-check-input',
                    attributes: { type: 'checkbox', name: 'classification', value: concept.id }
                });
                if (selected_concepts.has(concept.id)) {
                    checkbox.checked = true;
                }
                const label = this.Helpers.create_element('label', { attributes: { for: `classification-${concept.id}` }, text_content: concept.label });
                wrapper.append(checkbox, label);
                fieldset.appendChild(wrapper);
            });
            pour_section.appendChild(fieldset);
            fragment.appendChild(pour_section);
        }
        
        return fragment;
    },

    _create_impact_section(metadata) {
        const t = this.Translation.t;
        const section_wrapper = this.Helpers.create_element('div', { class_name: 'audit-section' });
        section_wrapper.appendChild(this.Helpers.create_element('h2', { text_content: t('impact_title') }));
        
        const impact_group = this.Helpers.create_element('div', { class_name: 'impact-group' });
        impact_group.appendChild(this._create_form_group('primary_score', 'primaryScore', metadata?.impact?.primaryScore, false, 'number'));
        impact_group.appendChild(this._create_form_group('secondary_score', 'secondaryScore', metadata?.impact?.secondaryScore, false, 'number'));

        const critical_wrapper = this.Helpers.create_element('div', { class_name: 'form-check' });
        const critical_checkbox = this.Helpers.create_element('input', { id: 'isCritical', name: 'isCritical', class_name: 'form-check-input', attributes: { type: 'checkbox' }});
        if (metadata?.impact?.isCritical) {
            critical_checkbox.checked = true;
        }
        critical_checkbox.addEventListener('change', this.debounced_autosave_form);
        critical_wrapper.appendChild(critical_checkbox);
        critical_wrapper.appendChild(this.Helpers.create_element('label', { attributes: { for: 'isCritical' }, text_content: t('is_critical') }));
        impact_group.appendChild(critical_wrapper);

        section_wrapper.appendChild(impact_group);
        return section_wrapper;
    },

    _update_parent_checkbox_state(parent_checkbox) {
        const parent_id = parent_checkbox.dataset.parentId;
        if (!parent_id) return;

        const children = this.form_element_ref.querySelectorAll(`input[data-child-for="${parent_id}"]`);
        if (children.length === 0) return;

        const total_children = children.length;
        const checked_children = Array.from(children).filter(child => child.checked).length;

        if (checked_children === 0) {
            parent_checkbox.checked = false;
            parent_checkbox.indeterminate = false;
            parent_checkbox.setAttribute('aria-checked', 'false');
        } else if (checked_children === total_children) {
            parent_checkbox.checked = true;
            parent_checkbox.indeterminate = false;
            parent_checkbox.setAttribute('aria-checked', 'true');
        } else {
            parent_checkbox.checked = false;
            parent_checkbox.indeterminate = true;
            parent_checkbox.setAttribute('aria-checked', 'mixed');
        }
    },

    _handle_content_type_change(event) {
        const target = event.target;
        if (target.type !== 'checkbox') return;

        if (target.dataset.parentId) {
            const parent_id = target.dataset.parentId;
            const children = this.form_element_ref.querySelectorAll(`input[data-child-for="${parent_id}"]`);
            children.forEach(child => child.checked = target.checked);
        } else if (target.dataset.childFor) {
            const parent_id = target.dataset.childFor;
            const parent_checkbox = this.form_element_ref.querySelector(`input[data-parent-id="${parent_id}"]`);
            if (parent_checkbox) {
                this._update_parent_checkbox_state(parent_checkbox);
            }
        }
    },

    _create_content_types_section(all_content_types, selected_content_types) {
        const t = this.Translation.t;
        const section_wrapper = this.Helpers.create_element('div', { class_name: 'audit-section' });
        section_wrapper.appendChild(this.Helpers.create_element('h2', { text_content: t('content_types_section_title') }));
        section_wrapper.addEventListener('change', (e) => {
            this._handle_content_type_change(e);
            this.debounced_autosave_form();
        });

        all_content_types.forEach(group => {
            const fieldset = this.Helpers.create_element('fieldset', { class_name: 'content-type-parent-group-edit' });
            const group_children_id = `ct-children-${group.id}`;
            
            // Legend för skärmläsare (visuellt dold)
            const legend = this.Helpers.create_element('legend', { class_name: 'visually-hidden', text_content: group.text });
            fieldset.appendChild(legend);
            
            // Visuell wrapper för parent checkbox
            const parent_header = this.Helpers.create_element('div', { class_name: 'content-type-parent-header-edit' });
            const parent_id = `ct-parent-${group.id}`;
            const parent_checkbox = this.Helpers.create_element('input', { 
                id: parent_id, 
                class_name: 'form-check-input', 
                attributes: { 
                    type: 'checkbox', 
                    'data-parent-id': group.id,
                    'aria-controls': group_children_id,
                    'aria-label': `${group.text}, välj alla`
                } 
            });
            const parent_label = this.Helpers.create_element('label', { 
                attributes: { for: parent_id }, 
                text_content: group.text,
                class_name: 'content-type-parent-label-edit'
            });
            parent_header.append(parent_checkbox, parent_label);
            fieldset.appendChild(parent_header);
            
            // Container för children med ID för ARIA
            const children_container = this.Helpers.create_element('div', { 
                class_name: 'content-type-children-container-edit', 
                attributes: { id: group_children_id } 
            });

            (group.types || []).forEach(child => {
                const child_id = `ct-child-${child.id}`;
                const is_checked = selected_content_types.includes(child.id);

                const child_wrapper = this.Helpers.create_element('div', { class_name: 'form-check content-type-child-item-edit' });
                const child_checkbox = this.Helpers.create_element('input', { 
                    id: child_id, 
                    class_name: 'form-check-input', 
                    attributes: { 
                        type: 'checkbox', 
                        name: 'contentType', 
                        value: child.id, 
                        'data-child-for': group.id,
                        'aria-labelledby': `${child_id}-label`
                    } 
                });
                if (is_checked) {
                    child_checkbox.checked = true;
                }
                const child_label = this.Helpers.create_element('label', { 
                    attributes: { for: child_id, id: `${child_id}-label` }, 
                    text_content: child.text 
                });
                
                child_wrapper.append(child_checkbox, child_label);
                children_container.appendChild(child_wrapper);
            });
            fieldset.appendChild(children_container);
            section_wrapper.appendChild(fieldset);
        });
        return section_wrapper;
    },
    
    _rerender_all_sections(options = {}) {
        if (typeof options === 'boolean') {
            options = { animate_last_item: options };
        }
        const focus_target = options.focusTarget || null;
        const focus_animation_duration = options.animateInfo?.animationDuration || 0;
        const previous_layout = options.previousLayout || null;
        const t = this.Translation.t;
        const scroll_position = window.scrollY;
        
        // Spara referens till det element som hade fokus
        const active_element_id = (!focus_target && document.activeElement) ? document.activeElement.id : null;

        this.form_element_ref.innerHTML = ''; // Rensa hela formuläret

        const current_state = this.getState();
        
        this.form_element_ref.appendChild(this._create_action_buttons('top'));

        const basic_info_section = this.Helpers.create_element('div', { class_name: 'audit-section' });
        basic_info_section.appendChild(this.Helpers.create_element('h2', { text_content: t('requirement_general_info_title') }));
        basic_info_section.appendChild(this._create_form_group('requirement_title', 'title', this.local_requirement_data.title));
        basic_info_section.appendChild(this._create_form_group('requirement_standard_reference_text', 'standardReferenceText', this.local_requirement_data.standardReference?.text));
        basic_info_section.appendChild(this._create_form_group('requirement_standard_reference_url', 'standardReferenceUrl', this.local_requirement_data.standardReference?.url));
        this.form_element_ref.appendChild(basic_info_section);
        
        const help_texts_section = this.Helpers.create_element('div', { class_name: 'audit-section' });
        help_texts_section.appendChild(this.Helpers.create_element('h2', { text_content: t('help_texts_title') }));
        
        // Support both old format (direct fields) and new format (infoBlocks)
        const has_info_blocks = this.local_requirement_data.infoBlocks && typeof this.local_requirement_data.infoBlocks === 'object';
        const block_order = current_state.ruleFileContent.metadata?.blockOrders?.infoBlocks || [];
        
        if (has_info_blocks) {
            // New format: render infoBlocks in order
            const info_blocks = this.local_requirement_data.infoBlocks;
            const ordered_block_ids = [...block_order];
            
            // Add any blocks that exist in infoBlocks but not in the order list (render them last)
            const extra_block_ids = Object.keys(info_blocks).filter(id => !ordered_block_ids.includes(id));
            ordered_block_ids.push(...extra_block_ids);
            
            ordered_block_ids.forEach(block_id => {
                const block = info_blocks[block_id];
                if (!block) {
                    // Create empty block if it doesn't exist
                    info_blocks[block_id] = {
                        name: this._get_default_block_name(block_id),
                        expanded: true,
                        text: ''
                    };
                }
                
                const block_container = this.Helpers.create_element('div', { class_name: 'info-block-edit-container', attributes: { 'data-block-id': block_id } });
                
                // Block name as h2 heading
                const block_name = block.name || this._get_default_block_name(block_id);
                const block_heading = this.Helpers.create_element('h2', { text_content: block_name });
                block_container.appendChild(block_heading);
                
                // Expanded checkbox group
                const expanded_group = this.Helpers.create_element('div', { class_name: 'form-group' });
                const expanded_label = this.Helpers.create_element('label', { 
                    class_name: 'checkbox-label',
                    attributes: { for: `infoBlock_${block_id}_expanded` }
                });
                const expanded_checkbox = this.Helpers.create_element('input', {
                    attributes: {
                        id: `infoBlock_${block_id}_expanded`,
                        name: `infoBlock_${block_id}_expanded`,
                        type: 'checkbox',
                        checked: block.expanded !== false
                    }
                });
                expanded_label.appendChild(expanded_checkbox);
                expanded_label.appendChild(document.createTextNode(' ' + t('info_block_expanded_label')));
                expanded_group.appendChild(expanded_label);
                
                // Text field (textarea)
                const text_group = this._create_form_group(
                    this._get_translation_key_for_block(block_id) || 'info_block_text',
                    `infoBlock_${block_id}_text`,
                    block.text || '',
                    true
                );
                
                block_container.appendChild(expanded_group);
                block_container.appendChild(text_group);
                help_texts_section.appendChild(block_container);
            });
        } else {
            // Old format: fallback to direct fields (for backward compatibility)
            help_texts_section.appendChild(this._create_form_group('requirement_expected_observation', 'expectedObservation', this.local_requirement_data.expectedObservation || '', true));
            help_texts_section.appendChild(this._create_form_group('requirement_instructions', 'instructions', this.local_requirement_data.instructions || '', true));
            help_texts_section.appendChild(this._create_form_group('requirement_exceptions', 'exceptions', this.local_requirement_data.exceptions || '', true));
            help_texts_section.appendChild(this._create_form_group('requirement_common_errors', 'commonErrors', this.local_requirement_data.commonErrors || '', true));
            help_texts_section.appendChild(this._create_form_group('requirement_tips', 'tips', this.local_requirement_data.tips || '', true));
            help_texts_section.appendChild(this._create_form_group('requirement_examples', 'examples', this.local_requirement_data.examples || '', true));
        }
        
        this.form_element_ref.appendChild(help_texts_section);
        
        const checks_container_wrapper = this.Helpers.create_element('div', { class_name: 'checks-container-edit' });
        this.form_element_ref.appendChild(checks_container_wrapper);
        this._rerender_checks_section(options);
        this._apply_flip_animation(previous_layout, options.animateInfo);
        
        this.form_element_ref.appendChild(this._create_classification_section(this.local_requirement_data.metadata, this.local_requirement_data.classifications));
        this.form_element_ref.appendChild(this._create_impact_section(this.local_requirement_data.metadata));

        const all_content_types = current_state.ruleFileContent.metadata?.vocabularies?.contentTypes || current_state.ruleFileContent.metadata?.contentTypes || [];
        const selected_content_types = this.local_requirement_data.contentType || [];
        this.form_element_ref.appendChild(this._create_content_types_section(all_content_types, selected_content_types));
        
        this.form_element_ref.appendChild(this._create_action_buttons('bottom'));

        this.form_element_ref.querySelectorAll('input[data-parent-id]').forEach(el => this._update_parent_checkbox_state(el));

        window.scrollTo(0, scroll_position);

        // Återställ fokus
        if (active_element_id) {
            const elementToFocus = document.getElementById(active_element_id);
            elementToFocus?.focus();
        }

        if (focus_target) {
            requestAnimationFrame(() => {
                this._apply_focus_target(focus_target, focus_animation_duration);
            });
        }
    },

    _rerender_checks_section(options = {}) {
        if (typeof options === 'boolean') {
            options = { animate_last_item: options };
        }
        const t = this.Translation.t;
        let checks_section = this.form_element_ref.querySelector('.checks-container-edit');
        if (!checks_section) return;

        checks_section.innerHTML = '';
        const checks_heading = this.Helpers.create_element('h2', { 
            id: 'checks-section-heading',
            text_content: t('checks_title'),
            attributes: { tabindex: '-1' }
        });
        checks_section.appendChild(checks_heading);

        const checks = this.local_requirement_data.checks || [];
        checks.forEach((check, index) => {
            const check_el = this._create_check_fieldset(check, index, checks.length);
            checks_section.appendChild(check_el);
        });

        const add_check_button = this.Helpers.create_element('button', { type: 'button', class_name: ['button', 'button-primary'], attributes: { 'data-action': 'add-check' }, text_content: t('add_check_button') });
        checks_section.appendChild(add_check_button);

        this._apply_animation_info(options.animateInfo);
    },

    _focus_element_simple(element, animation_duration, shouldForceScroll) {
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
    },


    _focus_element_with_delay(element, animation_duration, shouldForceScroll) {
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
    },

    _apply_focus_target(focus_target, animation_duration = 0) {
        if (!focus_target || !this.form_element_ref) return;
        const shouldForceScroll = focus_target.forceScroll === true;

        // Handle new checkpoint focus
        if (focus_target.type === 'new_check') {
            const check_element = this.form_element_ref.querySelector(`.check-item-edit[data-check-id="${focus_target.checkId}"]`);
            if (!check_element) return;
            
            // Focus on the first input field in the new checkpoint
            const first_input = check_element.querySelector('textarea, input[type="text"]');
            if (first_input) {
                // Use a simple, direct approach
                this._focus_element_simple(first_input, animation_duration, shouldForceScroll);
            }
            return;
        }

        // Handle new pass criterion focus
        if (focus_target.type === 'new_pass_criterion') {
            const pc_element = this.form_element_ref.querySelector(`.pc-item-edit[data-pc-id="${focus_target.passCriterionId}"]`);
            if (!pc_element) return;
            
            // Focus on the first input field in the new pass criterion
            const first_input = pc_element.querySelector('textarea, input[type="text"]');
            if (first_input) {
                // Use a simple, direct approach
                this._focus_element_simple(first_input, animation_duration, shouldForceScroll);
            }
            return;
        }

        // Handle legacy control focus (for backwards compatibility)
        if (focus_target.type === 'control' && typeof focus_target.selector === 'string') {
            const control_element = this.form_element_ref.querySelector(focus_target.selector);
            if (control_element) {
                this._focus_element_with_delay(control_element, animation_duration, shouldForceScroll);
            }
            return;
        }

        // Handle other focus types (check, passCriterion for existing items)
        let container = null;
        if (focus_target.type === 'check') {
            container = this.form_element_ref.querySelector(`.check-item-edit[data-check-id="${focus_target.checkId}"]`);
        } else if (focus_target.type === 'passCriterion') {
            const check_container = this.form_element_ref.querySelector(`.check-item-edit[data-check-id="${focus_target.checkId}"]`);
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

        this._focus_element_with_delay(button_to_focus, animation_duration, shouldForceScroll);
    },

    _apply_animation_info(animate_info) {
        if (!animate_info || !this.form_element_ref) return;
        const animation_class = animate_info.animationClass || 'new-item-animation';
        const animation_duration = animate_info.animationDuration || 400;

        requestAnimationFrame(() => {
            let target_element = null;
            if (animate_info.type === 'check') {
                target_element = this.form_element_ref.querySelector(`.check-item-edit[data-check-id="${animate_info.checkId}"]`);
            } else if (animate_info.type === 'passCriterion') {
                const check_container = this.form_element_ref.querySelector(`.check-item-edit[data-check-id="${animate_info.checkId}"]`);
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
    },

    _capture_positions() {
        if (!this.form_element_ref) return null;
        const layout = { checks: {}, passCriteria: {} };
        this.form_element_ref.querySelectorAll('.check-item-edit').forEach(checkEl => {
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
    },

    _add_new_check_element(check_id) {
        const t = this.Translation.t;
        const checks_section = this.form_element_ref.querySelector('.checks-container-edit');
        if (!checks_section) return;
        
        const checks = this.local_requirement_data.checks || [];
        const check = checks.find(c => c.id === check_id);
        if (!check) return;
        
        const index = checks.findIndex(c => c.id === check_id);
        const check_el = this._create_check_fieldset(check, index, checks.length);
        
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
    },
    
    _add_new_pass_criterion_element(check_id, pc_id) {
        const t = this.Translation.t;
        const check_element = this.form_element_ref.querySelector(`.check-item-edit[data-check-id="${check_id}"]`);
        if (!check_element) return;
        
        const pc_container = check_element.querySelector('.pc-container-edit');
        if (!pc_container) return;
        
        const check = this.local_requirement_data.checks.find(c => c.id === check_id);
        if (!check) return;
        
        const pc = check.passCriteria.find(pc => pc.id === pc_id);
        if (!pc) return;
        
        const pc_index = check.passCriteria.findIndex(pc => pc.id === pc_id);
        const check_index = this.local_requirement_data.checks.findIndex(c => c.id === check_id);
        const pc_el = this._create_pc_item(check, pc, this.Helpers.sanitize_id_for_css_selector(check_id), pc_index, check.passCriteria.length, check_index);
        
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
    },

    _apply_flip_animation(previous_layout, animate_info) {
        if (!previous_layout || !this.form_element_ref) return;
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

            this.form_element_ref.querySelectorAll('.check-item-edit').forEach(checkEl => {
                const check_id = checkEl.dataset.checkId;
                animate_element(checkEl, previous_layout.checks?.[check_id], { checkId: check_id });
                checkEl.querySelectorAll('.pc-item-edit').forEach(pcEl => {
                    const pc_id = pcEl.dataset.pcId;
                    animate_element(pcEl, previous_layout.passCriteria?.[`${check_id}::${pc_id}`], { checkId: check_id, passCriterionId: pc_id });
                });
            });
        });
    },
    
    _create_check_fieldset(check, index, total_checks) {
        const t = this.Translation.t;
        const sane_check_id = this.Helpers.sanitize_id_for_css_selector(check.id);
        const check_el = this.Helpers.create_element('div', { class_name: 'check-item-edit', attributes: { 'data-check-id': check.id }});

        const header_wrapper = this.Helpers.create_element('div', { class_name: 'form-group-header' });
        const check_label_text = `${t('check_item_title')} ${index + 1}`;
        header_wrapper.appendChild(this.Helpers.create_element('label', {
            attributes: {
                for: `check_${sane_check_id}_condition`,
                tabindex: '-1',
                'data-focus-target': 'check-heading'
            },
            text_content: check_label_text
        }));

        const header_actions = this.Helpers.create_element('div', { class_name: 'form-group-header-actions' });
        if (index > 0) {
            header_actions.appendChild(this._create_move_check_button('up', check));
        }
        if (index < total_checks - 1) {
            header_actions.appendChild(this._create_move_check_button('down', check));
        }
        const delete_check_btn = this.Helpers.create_element('button', {
            type: 'button', 
            class_name: 'button button-danger button-small delete-item-btn', 
            attributes: {
                'data-action': 'delete-check',
                'aria-label': t('delete_check_aria_label', { conditionText: check.condition || t('aria_label_empty_content') })
            }, 
            html_content: `<span>${t('delete_check_button')}</span>` + this.Helpers.get_icon_svg('delete')
        });
        header_actions.appendChild(delete_check_btn);
        header_wrapper.appendChild(header_actions);
        check_el.appendChild(header_wrapper);
        
        check_el.appendChild(this._create_form_group('check_condition_label', `check_${sane_check_id}_condition`, check.condition, true));

        const logic_fieldset = this.Helpers.create_element('fieldset', { class_name: 'check-logic-group' });
        logic_fieldset.appendChild(this.Helpers.create_element('legend', { text_content: t('check_logic_title') }));
        const logic_and = this.Helpers.create_element('input', { id: `logic_${sane_check_id}_and`, name: `check_${sane_check_id}_logic`, value: 'AND', attributes: { type: 'radio' } });
        if (!check.logic || check.logic.toUpperCase() === 'AND') logic_and.checked = true;
        logic_and.addEventListener('change', this.debounced_autosave_form);
        const logic_or = this.Helpers.create_element('input', { id: `logic_${sane_check_id}_or`, name: `check_${sane_check_id}_logic`, value: 'OR', attributes: { type: 'radio' } });
        if (check.logic?.toUpperCase() === 'OR') logic_or.checked = true;
        logic_or.addEventListener('change', this.debounced_autosave_form);
        
        logic_fieldset.append(
            this.Helpers.create_element('div', { class_name: 'form-check', children: [logic_and, this.Helpers.create_element('label', { attributes: { for: `logic_${sane_check_id}_and` }, text_content: t('check_logic_and') })] }),
            this.Helpers.create_element('div', { class_name: 'form-check', children: [logic_or, this.Helpers.create_element('label', { attributes: { for: `logic_${sane_check_id}_or` }, text_content: t('check_logic_or') })] })
        );
        check_el.appendChild(logic_fieldset);
        
        const pc_container = this.Helpers.create_element('div', { class_name: 'pc-container-edit' });
        const pc_heading = this.Helpers.create_element('h3', { 
            id: `pass-criteria-heading-${sane_check_id}`,
            text_content: t('pass_criteria_title'),
            attributes: { tabindex: '-1' }
        });
        pc_container.appendChild(pc_heading);
        
        const pass_criteria = check.passCriteria || [];
        pass_criteria.forEach((pc, pc_index) => {
            pc_container.appendChild(this._create_pc_item(check, pc, sane_check_id, pc_index, pass_criteria.length, index));
        });
        
        const add_pc_button = this.Helpers.create_element('button', { type: 'button', class_name: ['button', 'button-default', 'button-small'], attributes: { 'data-action': 'add-pass-criterion' }, text_content: t('add_criterion_button') });
        pc_container.appendChild(add_pc_button);
        check_el.appendChild(pc_container);

        return check_el;
    },

    _create_pc_item(check, pc, sane_check_id, pc_index, total_pass_criteria, check_index) {
        const t = this.Translation.t;
        const sane_pc_id = this.Helpers.sanitize_id_for_css_selector(pc.id);
        const pc_el = this.Helpers.create_element('div', { class_name: 'pc-item-edit', attributes: { 'data-pc-id': pc.id } });

        const numbering = `${check_index + 1}.${pc_index + 1}`;
        const numbered_label_text = `${t('pass_criterion_label')} ${numbering}`;

        const header_wrapper = this.Helpers.create_element('div', { class_name: 'form-group-header' });
        header_wrapper.appendChild(this.Helpers.create_element('span', {
            class_name: 'form-group-header-title',
            text_content: numbered_label_text,
            attributes: {
                tabindex: '-1',
                'data-focus-target': 'criterion-heading',
                role: 'heading',
                'aria-level': '4'
            }
        }));

        const header_actions = this.Helpers.create_element('div', { class_name: 'form-group-header-actions' });
        if (pc_index > 0) {
            header_actions.appendChild(this._create_move_pass_criterion_button('up', check, pc));
        }
        if (pc_index < total_pass_criteria - 1) {
            header_actions.appendChild(this._create_move_pass_criterion_button('down', check, pc));
        }

        const delete_pc_btn = this.Helpers.create_element('button', {
            type: 'button', 
            class_name: 'button button-danger button-small delete-item-btn', 
            attributes: {
                'data-action': 'delete-pass-criterion',
                'aria-label': t('delete_criterion_aria_label', { criterionText: pc.requirement || t('aria_label_empty_content') })
            }, 
            html_content: `<span>${t('delete_criterion_button')}</span>` + this.Helpers.get_icon_svg('delete')
        });
        header_actions.appendChild(delete_pc_btn);
        header_wrapper.appendChild(header_actions);
        pc_el.appendChild(header_wrapper);
        const requirement_group = this._create_form_group('pass_criterion_field_label', `pc_${sane_check_id}_${sane_pc_id}_requirement`, pc.requirement, true);
        const requirement_textarea = requirement_group.querySelector('textarea');
        if (requirement_textarea) {
            requirement_textarea.setAttribute('aria-label', numbered_label_text);
        }
        pc_el.appendChild(requirement_group);
        pc_el.appendChild(this._create_form_group('failure_template_label', `pc_${sane_check_id}_${sane_pc_id}_failureTemplate`, pc.failureStatementTemplate, true));
        return pc_el;
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';
        const plate_element = this.Helpers.create_element('div', { class_name: 'content-plate requirement-audit-plate' });
        
        const requirement_id = this.params?.id;
        const current_state = this.getState();
        const is_new_requirement = requirement_id === 'new';
        
        if (is_new_requirement) {
            // Skapa tom kravstruktur för nytt krav
            // Use new format with infoBlocks if blockOrders exists, otherwise use old format
            const block_order = current_state.ruleFileContent.metadata?.blockOrders?.infoBlocks;
            const use_new_format = Array.isArray(block_order) && block_order.length > 0;
            
            this.local_requirement_data = {
                title: '',
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
            
            // Initialize infoBlocks if using new format
            if (use_new_format) {
                this.local_requirement_data.infoBlocks = {};
                block_order.forEach(block_id => {
                    this.local_requirement_data.infoBlocks[block_id] = {
                        name: this._get_default_block_name(block_id),
                        expanded: true,
                        text: ''
                    };
                });
            } else {
                // Old format fallback
                this.local_requirement_data.expectedObservation = '';
                this.local_requirement_data.instructions = '';
                this.local_requirement_data.exceptions = '';
                this.local_requirement_data.commonErrors = '';
                this.local_requirement_data.tips = '';
                this.local_requirement_data.examples = '';
            }
        } else {
            const requirement_from_store = current_state?.ruleFileContent?.requirements[requirement_id];
            if (!requirement_from_store) {
                plate_element.appendChild(this.Helpers.create_element('h1', { text_content: t('error_internal') }));
                this.root.appendChild(plate_element);
                return;
            }
            this.local_requirement_data = JSON.parse(JSON.stringify(requirement_from_store));
            
            // Migrate from old format to new format if needed
            const block_order = current_state.ruleFileContent.metadata?.blockOrders?.infoBlocks;
            const has_info_blocks = this.local_requirement_data.infoBlocks && typeof this.local_requirement_data.infoBlocks === 'object';
            const has_old_fields = this.local_requirement_data.expectedObservation !== undefined || 
                                   this.local_requirement_data.instructions !== undefined;
            
            if (!has_info_blocks && has_old_fields && Array.isArray(block_order) && block_order.length > 0) {
                // Migrate old format to new format
                this.local_requirement_data.infoBlocks = {};
                block_order.forEach(block_id => {
                    const old_field_map = {
                        'expectedObservation': 'expectedObservation',
                        'instructions': 'instructions',
                        'examples': 'examples',
                        'tips': 'tips',
                        'commonErrors': 'commonErrors',
                        'exceptions': 'exceptions'
                    };
                    const old_field = old_field_map[block_id];
                    this.local_requirement_data.infoBlocks[block_id] = {
                        name: this._get_default_block_name(block_id),
                        expanded: true,
                        text: this.local_requirement_data[old_field] || ''
                    };
                    // Remove old field
                    delete this.local_requirement_data[old_field];
                });
            }
            
            // Spara ursprungsläget när vyn laddas (efter migrering om nödvändigt)
            this.initial_requirement_snapshot = JSON.parse(JSON.stringify(this.local_requirement_data));
        }

        const page_title = is_new_requirement 
            ? t('rulefile_add_requirement_title')
            : `${t('rulefile_edit_requirement_title')}: ${this.local_requirement_data.title}`;
        plate_element.appendChild(this.Helpers.create_element('h1', { text_content: page_title }));
        
        this.form_element_ref = this.Helpers.create_element('form');
        this.form_element_ref.addEventListener('submit', this.handle_form_submit);
        this.form_element_ref.addEventListener('click', this.handle_form_click);
        
        this._rerender_all_sections();
        
        plate_element.appendChild(this.form_element_ref);
        this.root.appendChild(plate_element);

        setTimeout(() => {
            const focusSelector = sessionStorage.getItem('focusAfterLoad');
            if (focusSelector) {
                sessionStorage.removeItem('focusAfterLoad');
                const elementToFocus = this.form_element_ref.querySelector(focusSelector);
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
    },

    _restore_initial_state() {
        if (!this.initial_requirement_snapshot || this.params?.id === 'new') return;
        
        this.dispatch({
            type: this.StoreActionTypes.UPDATE_REQUIREMENT_DEFINITION,
            payload: {
                requirementId: this.params.id,
                updatedRequirementData: this.initial_requirement_snapshot
            }
        });
    },

    destroy() {
        // Spara autosparat data innan komponenten förstörs (vid navigering bort)
        if (this.form_element_ref && this.local_requirement_data && this.params?.id !== 'new') {
            clearTimeout(this.debounceTimerFormFields);
            this.save_form_data_immediately();
        }
        
        clearTimeout(this.debounceTimerFormFields);
        if (this.form_element_ref) {
            this.form_element_ref.removeEventListener('submit', this.handle_form_submit);
            this.form_element_ref.removeEventListener('click', this.handle_form_click);
        }
        if (this.root) this.root.innerHTML = '';
        this.form_element_ref = null;
        this.local_requirement_data = null;
        this.initial_requirement_snapshot = null;
        this.root = null;
        this.deps = null;
    }
};

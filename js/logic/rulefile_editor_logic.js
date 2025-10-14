// js/logic/rulefile_editor_logic.js
(function () { // IIFE start
    'use-strict';

    const Helpers = window.Helpers;
    const Translation = window.Translation;

    // --- GENERIC FORM HELPERS ---
    function _createFormField(labelTextKey, name, value, type = 'text', instructionTextKey = null, isRequired = false) {
        const t = Translation.t;
        const container = Helpers.create_element('div', { class_name: 'form-group' });
        const randomSuffix = Math.random().toString(36).substring(2, 7);
        const inputId = `form-${name.replace(/[\.\[\]]/g, '-')}-${randomSuffix}`;
        const labelText = isRequired ? `${t(labelTextKey)}*` : t(labelTextKey);
        const label = Helpers.create_element('label', { attributes: { for: inputId }, text_content: labelText });
        container.appendChild(label);
        if (instructionTextKey) {
            container.appendChild(Helpers.create_element('p', { class_name: 'field-instruction', text_content: t(instructionTextKey) }));
        }
        let inputElement;
        const attributes = { id: inputId, name: name };
        if (isRequired) attributes.required = true;
        if (type === 'checkbox') {
            container.innerHTML = '';
            container.classList.add('form-check');
            inputElement = Helpers.create_element('input', { class_name: 'form-check-input', attributes: { ...attributes, type: 'checkbox' } });
            inputElement.checked = !!value;
            const checkboxLabel = Helpers.create_element('label', { attributes: { for: inputId }, text_content: t(labelTextKey) });
            container.append(inputElement, checkboxLabel);
        } else if (type === 'textarea') {
            inputElement = Helpers.create_element('textarea', { class_name: 'form-control', attributes: { ...attributes, rows: '3' } });
            inputElement.value = value ?? '';
            container.appendChild(inputElement);
            Helpers.init_auto_resize_for_textarea(inputElement);
        } else {
            inputElement = Helpers.create_element('input', { class_name: 'form-control', attributes: { ...attributes, type: type } });
            inputElement.value = value ?? '';
            container.appendChild(inputElement);
        }
        return container;
    }

    function _createDynamicListButton(textKey, onClick, options = {}) {
        const { classNames = ['button', 'button-accent', 'button-small'], icon = 'add' } = options;
        const button = Helpers.create_element('button', {
            class_name: classNames,
            attributes: { type: 'button' },
            html_content: `<span>${Translation.t(textKey)}</span>` + (Helpers.get_icon_svg ? Helpers.get_icon_svg(icon) : '')
        });
        button.addEventListener('click', onClick);
        return button;
    }
    
    // --- HIERARCHY EDITOR & METADATA EDITOR LOGIC ---
    // (Placeholder, as we are focusing on the requirement editor)
    function buildMetadataEditor(metadata, onSaveCallback) {
        const container = Helpers.create_element('div');
        container.appendChild(Helpers.create_element('p', { text_content: Translation.t('metadata_editor_placeholder') }));
        return container;
    }
    
    // --- REQUIREMENTS EDITOR LOGIC ---
    function buildRequirementsEditor(requirements, allContentTypes, onSaveCallback, onDeleteCallback) {
        const t = Translation.t;
        console.log('%c[DEBUG] buildRequirementsEditor called', 'color: #0000FF; font-weight: bold;', { 
            requirements, 
            allContentTypes, 
            onSaveCallback: typeof onSaveCallback, 
            onDeleteCallback: typeof onDeleteCallback 
        });
        const container = Helpers.create_element('div', { class_name: 'rulefile-editor-section' });
        const listContainer = Helpers.create_element('div', { id: 'req-list-container' });
        const formContainer = Helpers.create_element('div', { id: 'req-form-container', style: { display: 'none' } });
        const showList = () => {
            listContainer.style.display = 'block';
            formContainer.style.display = 'none';
            formContainer.innerHTML = '';
        };
        const showForm = (reqData = {}, isNew = false) => {
            listContainer.style.display = 'none';
            formContainer.innerHTML = '';
            formContainer.style.display = 'block';
            formContainer.appendChild(
                _buildSingleRequirementForm(reqData, allContentTypes, isNew, (savedReq) => {
                    onSaveCallback(savedReq, isNew);
                    showList();
                }, showList)
            );
        };
        const list = Helpers.create_element('ul', { class_name: 'item-list' });
        const requirementsList = Object.values(requirements || {});
        console.log('%c[DEBUG] Rendering requirements list:', 'color: #0000FF; font-weight: bold;', requirementsList);
        requirementsList.sort((a,b) => Helpers.natural_sort(a.title, b.title)).forEach(req => {
            const li = Helpers.create_element('li', { class_name: 'item-list-item' });
            const infoDiv = Helpers.create_element('div', { class_name: 'sample-info' });
            infoDiv.appendChild(Helpers.create_element('h3', { text_content: req.title }));
            infoDiv.appendChild(Helpers.create_element('p', { text_content: `ID: ${req.key}`, class_name: 'text-muted' }));
            li.appendChild(infoDiv);
            const actionsWrapper = Helpers.create_element('div', { class_name: 'sample-actions-wrapper' });
            const mainActions = Helpers.create_element('div', { class_name: 'sample-actions-main' });
            const editBtn = _createDynamicListButton('edit_button_label', () => showForm(req), { classNames: ['button', 'button-default', 'button-small'], icon: 'edit' });
            const deleteBtn = _createDynamicListButton('delete_sample', () => {
                console.log('%c[DEBUG] Delete button clicked for requirement:', 'color: #FF0000; font-weight: bold;', { reqKey: req.key, reqTitle: req.title });
                if (confirm(t('confirm_delete_requirement', { reqTitle: req.title }))) {
                    console.log('%c[DEBUG] Delete confirmed, calling onDeleteCallback:', 'color: #FF0000; font-weight: bold;', req.key);
                    onDeleteCallback(req.key);
                } else {
                    console.log('%c[DEBUG] Delete cancelled by user', 'color: #FF0000; font-weight: bold;');
                }
            }, { classNames: ['button', 'button-danger', 'button-small'], icon: 'delete' });
            mainActions.append(editBtn, deleteBtn);
            actionsWrapper.appendChild(mainActions);
            li.appendChild(actionsWrapper);
            list.appendChild(li);
        });
        listContainer.appendChild(list);
        const addAction = Helpers.create_element('div', { class_name: 'form-actions', style: { justifyContent: 'flex-start' } });
        const addBtn = _createDynamicListButton('add_new_requirement_button', () => showForm({}, true));
        addAction.appendChild(addBtn);
        listContainer.appendChild(addAction);
        container.append(listContainer, formContainer);
        return container;
    }

    function _buildSingleRequirementForm(req, allContentTypes, isNew, onSave, onCancel) {
        const t = Translation.t;
        const form = Helpers.create_element('form', { noValidate: true });
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const parsedData = _parseRequirementForm(form, req, isNew);
            if (parsedData) onSave(parsedData);
        });
        form.appendChild(Helpers.create_element('h2', { text_content: isNew ? t('add_new_requirement_button') : t('edit_requirement_title') }));
        form.appendChild(_buildReqFormBasicSection(req));
        form.appendChild(_buildReqFormRefSection(req));
        form.appendChild(_buildReqFormHelpTextsSection(req));
        form.appendChild(_buildReqFormChecksSection(req));
        form.appendChild(_buildReqFormContentTypesSection(req, allContentTypes));
        form.appendChild(_buildReqFormMetadataSection(req));
        const actions = Helpers.create_element('div', { class_name: 'form-actions' });
        const saveBtn = Helpers.create_element('button', { type: 'submit', class_name: 'button button-primary', text_content: t('save_changes_button') });
        const cancelBtn = Helpers.create_element('button', { type: 'button', class_name: 'button button-default', text_content: t('cancel') });
        cancelBtn.addEventListener('click', onCancel);
        actions.append(saveBtn, cancelBtn);
        form.appendChild(actions);
        return form;
    }

    function _buildReqFormBasicSection(req) {
        const fieldset = Helpers.create_element('fieldset');
        fieldset.appendChild(Helpers.create_element('h3', {text_content: Translation.t('general_info')}));
        fieldset.appendChild(_createFormField('requirement_title', 'title', req.title || '', 'text', null, true));
        return fieldset;
    }

    function _buildReqFormRefSection(req) {
        const fieldset = Helpers.create_element('fieldset');
        fieldset.appendChild(Helpers.create_element('h3', {text_content: Translation.t('standard_reference')}));
        fieldset.appendChild(_createFormField('reference_text', 'standardReference.text', req.standardReference?.text || ''));
        fieldset.appendChild(_createFormField('reference_url', 'standardReference.url', req.standardReference?.url || '', 'url'));
        return fieldset;
    }
    
    function _buildReqFormHelpTextsSection(req) {
        const fieldset = Helpers.create_element('fieldset');
        fieldset.appendChild(Helpers.create_element('h3', {text_content: Translation.t('help_texts')}));
        fieldset.appendChild(_createFormField('expected_observation', 'expectedObservation', req.expectedObservation || '', 'textarea'));
        fieldset.appendChild(_createFormField('requirement_instructions', 'instructions', req.instructions || '', 'textarea'));
        fieldset.appendChild(_createFormField('requirement_exceptions', 'exceptions', String(req.exceptions || ''), 'textarea'));
        fieldset.appendChild(_createFormField('requirement_common_errors', 'commonErrors', String(req.commonErrors || ''), 'textarea'));
        fieldset.appendChild(_createFormField('requirement_tips', 'tips', String(req.tips || ''), 'textarea'));
        return fieldset;
    }
    
    function _buildReqFormChecksSection(req) {
        const fieldset = Helpers.create_element('fieldset');
        fieldset.appendChild(Helpers.create_element('h3', {text_content: Translation.t('checks_title')}));
        const checksContainer = Helpers.create_element('div', { class_name: 'checks-container' });
        (req.checks || []).forEach((check, index) => checksContainer.appendChild(_createCheckFieldset(check, index)));
        fieldset.appendChild(checksContainer);
        fieldset.appendChild(_createDynamicListButton('add_check', () => {
            const newIndex = checksContainer.children.length;
            checksContainer.appendChild(_createCheckFieldset({}, newIndex));
        }));
        return fieldset;
    }

    function _createCheckFieldset(checkData, index) {
        const fieldset = Helpers.create_element('fieldset', { class_name: 'check-fieldset' });
        const legend = Helpers.create_element('h4', { text_content: `${Translation.t('check_item_title')} ${index + 1}` });
        const deleteBtn = _createDynamicListButton('delete', () => {
            // Add a visual indicator that the fieldset is being removed
            fieldset.style.opacity = '0.5';
            fieldset.style.pointerEvents = 'none';
            
            // Remove the fieldset after a short delay to allow for visual feedback
            setTimeout(() => {
                if (fieldset.parentNode) {
                    fieldset.remove();
                }
            }, 100);
        }, { classNames: ['button', 'button-danger', 'button-small', 'delete-check-btn'], icon: 'delete' });
        const header = Helpers.create_element('div', { class_name: 'check-fieldset-header' });
        header.append(legend, deleteBtn);
        fieldset.appendChild(header);
        fieldset.appendChild(_createFormField('condition', `condition`, checkData.condition || '', 'textarea'));
        const pcFieldset = Helpers.create_element('fieldset');
        pcFieldset.appendChild(Helpers.create_element('h4', { text_content: Translation.t('pass_criteria') }));
        const pcList = Helpers.create_element('ul', { class_name: 'dynamic-list-container' });
        (checkData.passCriteria || []).forEach((pc, pcIndex) => pcList.appendChild(_createPassCriterionItem(pc, pcIndex)));
        pcFieldset.appendChild(pcList);
        pcFieldset.appendChild(_createDynamicListButton('add_criterion', () => {
            const newPcIndex = pcList.children.length;
            pcList.appendChild(_createPassCriterionItem({}, newPcIndex));
        }));
        fieldset.appendChild(pcFieldset);
        return fieldset;
    }
    
    function _createPassCriterionItem(pcData, index) {
        const t = Translation.t;
        const li = Helpers.create_element('li', { class_name: 'dynamic-list-item pass-criterion-item' });
        const itemHeader = Helpers.create_element('div', { class_name: 'criterion-item-header' });
        const title = Helpers.create_element('h5', { text_content: `${t('criterion_header')} ${index + 1}`});
        const deleteBtn = _createDynamicListButton('delete', () => {
            // Add a visual indicator that the item is being removed
            li.style.opacity = '0.5';
            li.style.pointerEvents = 'none';
            
            // Remove the item after a short delay to allow for visual feedback
            setTimeout(() => {
                if (li.parentNode) {
                    li.remove();
                }
            }, 100);
        }, { classNames: ['button', 'button-danger', 'button-small'], icon: 'delete' });
        itemHeader.append(title, deleteBtn);
        const contentWrapper = Helpers.create_element('div', { class_name: 'criterion-content-wrapper' });
        const leftWrapper = Helpers.create_element('div', { class_name: 'criterion-textarea-wrapper' });
        const reqLabel = Helpers.create_element('label', { text_content: t('text_to_assess') });
        const reqTextarea = Helpers.create_element('textarea', { class_name: 'form-control', value: pcData.requirement || '', name: 'passCriterionRequirement' });
        Helpers.init_auto_resize_for_textarea(reqTextarea);
        const reqId = `req-text-${Helpers.generate_uuid_v4()}`;
        reqTextarea.id = reqId;
        reqLabel.setAttribute('for', reqId);
        leftWrapper.append(reqLabel, reqTextarea);
        const rightWrapper = Helpers.create_element('div', { class_name: 'criterion-textarea-wrapper' });
        const templateLabel = Helpers.create_element('label', { text_content: t('template_for_observation') });
        const templateTextarea = Helpers.create_element('textarea', { class_name: 'form-control', value: pcData.failureStatementTemplate || '', name: 'passCriterionTemplate' });
        Helpers.init_auto_resize_for_textarea(templateTextarea);
        const templateId = `req-template-${Helpers.generate_uuid_v4()}`;
        templateTextarea.id = templateId;
        templateLabel.setAttribute('for', templateId);
        rightWrapper.append(templateLabel, templateTextarea);
        contentWrapper.append(leftWrapper, rightWrapper);
        li.append(itemHeader, contentWrapper);
        return li;
    }

    function _buildReqFormContentTypesSection(req, allContentTypes) {
        const fieldset = Helpers.create_element('fieldset');
        fieldset.appendChild(Helpers.create_element('h3', {text_content: Translation.t('content_types')}));
        (allContentTypes || []).forEach(group => {
            const groupFieldset = Helpers.create_element('fieldset');
            groupFieldset.appendChild(Helpers.create_element('h4', {text_content: group.text}));
            (group.types || []).forEach(type => {
                const isChecked = Array.isArray(req.contentType) && req.contentType.includes(type.id);
                const checkbox = _createFormField(type.text, `contentType-${type.id}`, isChecked, 'checkbox');
                if (type.description) {
                    const desc = Helpers.create_element('p', {
                        class_name: 'field-instruction content-type-description',
                        text_content: type.description
                    });
                    checkbox.appendChild(desc);
                }
                groupFieldset.appendChild(checkbox);
            });
            fieldset.appendChild(groupFieldset);
        });
        return fieldset;
    }
    
    function _buildReqFormMetadataSection(req) {
        const fieldset = Helpers.create_element('fieldset');
        fieldset.appendChild(Helpers.create_element('h3', {text_content: Translation.t('metadata')}));
        fieldset.appendChild(_createFormField('main_category_text', 'metadata.mainCategory.text', req.metadata?.mainCategory?.text || ''));
        fieldset.appendChild(_createFormField('sub_category_text', 'metadata.subCategory.text', req.metadata?.subCategory?.text || ''));
        fieldset.appendChild(_createFormField('is_critical', 'metadata.impact.isCritical', req.metadata?.impact?.isCritical || false, 'checkbox'));
        return fieldset;
    }
    
    // --- FORM PARSER ---
    function _parseRequirementForm(form, originalReq, isNew) {
        const t = Translation.t;
        const newReq = JSON.parse(JSON.stringify(originalReq));
        newReq.title = form.elements['title'].value.trim();
        if (!newReq.title) {
            alert(t('field_is_required', {fieldName: t('requirement_title')}));
            return null;
        }
        if (isNew) {
            newReq.id = Helpers.generate_uuid_v4();
            newReq.key = (newReq.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 50) || 'req') + '-' + newReq.id.substring(0, 8);
        }
        newReq.expectedObservation = form.elements['expectedObservation'].value.trim();
        newReq.standardReference = {
            text: form.elements['standardReference.text'].value.trim(),
            url: form.elements['standardReference.url'].value.trim(),
        };
        newReq.instructions = form.elements['instructions'].value.trim();
        newReq.exceptions = form.elements['exceptions'].value.trim();
        newReq.commonErrors = form.elements['commonErrors'].value.trim();
        newReq.tips = form.elements['tips'].value.trim();
        newReq.contentType = [];
        for (const element of form.elements) {
            if (element.name.startsWith('contentType-') && element.checked) {
                newReq.contentType.push(element.name.substring(12));
            }
        }
        newReq.checks = Array.from(form.querySelectorAll('.check-fieldset')).map((checkFS, i) => {
            try {
                const conditionElement = checkFS.querySelector('[name="condition"]');
                if (!conditionElement) {
                    console.warn('Check fieldset missing condition element, skipping');
                    return null;
                }
                
                const condition = conditionElement.value.trim();
                if (!condition) {
                    console.warn('Check fieldset has empty condition, skipping');
                    return null;
                }
                
                const passCriteria = Array.from(checkFS.querySelectorAll('.dynamic-list-item')).map((pcLi, j) => {
                    const requirementElement = pcLi.querySelector('[name="passCriterionRequirement"]');
                    const templateElement = pcLi.querySelector('[name="passCriterionTemplate"]');
                    
                    if (!requirementElement) {
                        console.warn('Pass criterion missing requirement element, skipping');
                        return null;
                    }
                    
                    const requirement = requirementElement.value.trim();
                    if (!requirement) {
                        console.warn('Pass criterion has empty requirement, skipping');
                        return null;
                    }
                    
                    return {
                        id: `${i + 1}.${j + 1}`,
                        requirement: requirement,
                        failureStatementTemplate: templateElement ? templateElement.value.trim() : '',
                    };
                }).filter(pc => pc && pc.requirement);
                
                return {
                    id: `${i + 1}`,
                    condition: condition,
                    logic: 'AND',
                    passCriteria: passCriteria,
                    ifNo: []
                };
            } catch (error) {
                console.warn('Error parsing check fieldset:', error);
                return null;
            }
        }).filter(c => c && c.condition && c.condition.trim() !== '');
        newReq.metadata = {
            mainCategory: { text: form.elements['metadata.mainCategory.text'].value.trim() },
            subCategory: { text: form.elements['metadata.subCategory.text'].value.trim() },
            impact: { isCritical: form.elements['metadata.impact.isCritical'].checked }
        };
        return newReq;
    }
    
    // --- PUBLIC API ---
    const public_api = {
        buildMetadataEditor,
        buildRequirementsEditor
    };
    window.RulefileEditorLogic = public_api;
    

})(); // IIFE end

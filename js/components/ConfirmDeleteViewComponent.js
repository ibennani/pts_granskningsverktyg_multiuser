import "../../css/components/confirm_delete_requirement_view_component.css";

export const ConfirmDeleteViewComponent = {
    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.params = deps.params || {}; // Assuming params are passed in deps
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
    },

    get_config_for_delete_type(type, state, params) {
        const { reqId, checkId, pcId } = params;
        const requirement = state?.ruleFileContent?.requirements[reqId];
        const t = this.Translation.t;
        const Helpers = this.Helpers;

        switch (type) {
            case 'requirement':
                return {
                    isValid: !!requirement,
                    titleKey: 'rulefile_confirm_delete_title',
                    introKey: 'rulefile_confirm_delete_intro',
                    warningKey: 'rulefile_confirm_delete_warning',
                    itemText: requirement?.title,
                    itemContext: { requirementTitle: `<strong>${Helpers.escape_html(requirement?.title)}</strong>` },
                    dispatchAction: {
                        type: this.StoreActionTypes.DELETE_REQUIREMENT_DEFINITION,
                        payload: { requirementId: reqId }
                    },
                    returnRoute: 'rulefile_requirements',
                    focusOnSuccess: 'h1',
                    focusOnCancelSelector: `button[data-action="delete-req"][data-requirement-id="${reqId}"]`
                };
            case 'check':
                const check = requirement?.checks.find(c => c.id === checkId);
                return {
                    isValid: !!check,
                    titleKey: 'confirm_delete_check_title',
                    introKey: 'confirm_delete_check_intro',
                    itemText: check?.condition,
                    dispatchAction: {
                        type: this.StoreActionTypes.DELETE_CHECK_FROM_REQUIREMENT,
                        payload: { requirementId: reqId, checkId: checkId }
                    },
                    returnRoute: 'rulefile_edit_requirement',
                    returnParams: { id: reqId },
                    focusOnSuccess: '#checks-section-heading',
                    focusOnCancelSelector: `.check-item-edit[data-check-id="${checkId}"] button[data-action="delete-check"]`
                };
            case 'criterion':
                const parentCheck = requirement?.checks.find(c => c.id === checkId);
                const criterion = parentCheck?.passCriteria.find(pc => pc.id === pcId);
                return {
                    isValid: !!criterion,
                    titleKey: 'confirm_delete_criterion_title',
                    introKey: 'confirm_delete_criterion_intro',
                    itemText: criterion?.requirement,
                    dispatchAction: {
                        type: this.StoreActionTypes.DELETE_CRITERION_FROM_CHECK,
                        payload: { requirementId: reqId, checkId: checkId, passCriterionId: pcId }
                    },
                    returnRoute: 'rulefile_edit_requirement',
                    returnParams: { id: reqId },
                    focusOnSuccess: '#checks-section-heading',
                    focusOnCancelSelector: `.pc-item-edit[data-pc-id="${pcId}"] button[data-action="delete-pass-criterion"]`
                };
            default:
                return { isValid: false };
        }
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';
        const plate_element = this.Helpers.create_element('div', { class_name: 'content-plate' });
        
        // Use params from deps.params (mapped from main.js)
        // If main.js calls init({root, deps: { params: ... }})
        const deleteType = this.params?.type;
        const config = this.get_config_for_delete_type(deleteType, this.getState(), this.params);

        if (!config.isValid) {
            plate_element.appendChild(this.Helpers.create_element('h1', { text_content: t('error_internal') }));
            plate_element.appendChild(this.Helpers.create_element('p', { text_content: t('error_loading_sample_or_requirement_data') }));
            this.root.appendChild(plate_element);
            return;
        }

        const handle_confirm = () => {
            this.dispatch(config.dispatchAction);
            // Sätt fokus tillbaka till listan efter lyckad radering (one-shot).
            // För raderade regelfilskrav vill vi fokusera på en titel-länk i listan (inte <h1>).
            if (deleteType === 'requirement' && this.params?.reqId) {
                try {
                    window.sessionStorage?.setItem('gv_return_focus_rulefile_requirements_list_v1', JSON.stringify({
                        deletedRequirementId: this.params.reqId,
                        createdAt: Date.now()
                    }));
                } catch (e) {}
            } else if (config.focusOnSuccess === 'h1') {
                sessionStorage.setItem('focusOnH1AfterLoad', 'true');
            } else {
                sessionStorage.setItem('focusAfterLoad', config.focusOnSuccess);
            }
            this.router(config.returnRoute, config.returnParams || {});
        };

        const handle_cancel = () => {
            sessionStorage.setItem('focusAfterLoad', config.focusOnCancelSelector);
            this.router(config.returnRoute, config.returnParams || {});
        };
        
        plate_element.appendChild(this.Helpers.create_element('h1', { text_content: t(config.titleKey) }));
        
        const warning_box = this.Helpers.create_element('div', { class_name: 'warning-box' });
        let introHTML = `<p>${t(config.introKey, config.itemContext || {})}</p>`;
        if (config.itemText) {
            introHTML += `<blockquote>${this.Helpers.escape_html(config.itemText)}</blockquote>`;
        }
        if (config.warningKey) {
            introHTML += `<p>${t(config.warningKey)}</p>`;
        }
        warning_box.innerHTML = introHTML;
        plate_element.appendChild(warning_box);

        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: 'margin-top: 2rem;' });

        const confirm_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-danger'],
            html_content: `<span>${t('rulefile_confirm_delete_button')}</span>` + this.Helpers.get_icon_svg('delete')
        });
        confirm_button.addEventListener('click', handle_confirm);

        const cancel_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('keep_item')}</span>`
        });
        cancel_button.addEventListener('click', handle_cancel);

        actions_div.append(confirm_button, cancel_button);
        plate_element.appendChild(actions_div);

        this.root.appendChild(plate_element);
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        // Clear references
        this.params = null;
    }
};

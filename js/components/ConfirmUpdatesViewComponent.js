import "../../css/components/confirm_updates_view_component.css";

export const ConfirmUpdatesViewComponent = {
    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        
        this.plate_element_ref = null;
        this.list_container_for_delegation = null;
        this.h1_ref = null;
        
        // Bind event handlers
        this.handle_list_item_click = this.handle_list_item_click.bind(this);
        this.handle_list_item_keydown = this.handle_list_item_keydown.bind(this);
    },

    handle_list_item_click(event) {
        const button = event.target.closest('button[data-action="confirm-single"]');
        if (!button) return;

        // --- START OF NEW, ROBUST FOCUS LOGIC ---
        const current_li = button.closest('li');
        const next_li = current_li.nextElementSibling;
        const prev_li = current_li.previousElementSibling;

        let target_selector_for_button = null;

        if (next_li) {
            const next_button = next_li.querySelector('button[data-action="confirm-single"]');
            if (next_button) {
                target_selector_for_button = `button[data-sample-id="${next_button.dataset.sampleId}"][data-requirement-id="${next_button.dataset.requirementId}"]`;
            }
        } else if (prev_li) {
            const prev_button = prev_li.querySelector('button[data-action="confirm-single"]');
            if (prev_button) {
                target_selector_for_button = `button[data-sample-id="${prev_button.dataset.sampleId}"][data-requirement-id="${prev_button.dataset.requirementId}"]`;
            }
        }
        
        const { sampleId, requirementId } = button.dataset;
        this.dispatch({
            type: this.StoreActionTypes.CONFIRM_SINGLE_REVIEWED_REQUIREMENT,
            payload: { sampleId, requirementId }
        });
        
        setTimeout(() => {
            if (target_selector_for_button) {
                const target_button = this.plate_element_ref.querySelector(target_selector_for_button);
                if (target_button && target_button.previousElementSibling?.tagName === 'A') {
                    target_button.previousElementSibling.focus();
                } else if (this.h1_ref) {
                    this.h1_ref.focus();
                }
            } else if (this.h1_ref) {
                this.h1_ref.focus();
            }
        }, 0);
        // --- END OF NEW, ROBUST FOCUS LOGIC ---
    },

    handle_list_item_keydown(event) {
        // Handle keyboard navigation for accessibility
        if (event.key === 'Enter' || event.key === ' ') {
            const button = event.target.closest('button[data-action="confirm-single"]');
            if (!button) return;
            
            event.preventDefault();
            // Trigger the same action as click
            this.handle_list_item_click(event);
        }
    },

    get_updated_reqs_data() {
        const state = this.getState();
        const updated_reqs_by_sample = {};
        let total_count = 0;

        state.samples.forEach(sample => {
            const sample_reqs = [];
            Object.keys(sample.requirementResults || {}).forEach(reqId => {
                if (sample.requirementResults[reqId]?.needsReview === true) {
                    const req_def = state.ruleFileContent.requirements[reqId];
                    if (req_def) {
                        sample_reqs.push({
                            id: reqId,
                            title: req_def.title,
                            reference: req_def.standardReference?.text || '',
                            status: sample.requirementResults[reqId].status
                        });
                        total_count++;
                    }
                }
            });
            if (sample_reqs.length > 0) {
                updated_reqs_by_sample[sample.id] = {
                    sampleName: sample.description,
                    requirements: sample_reqs
                };
            }
        });

        return { updated_reqs_by_sample, total_count };
    },

    render_action_buttons(position) {
        const t = this.Translation.t;
        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: { marginTop: '1.5rem', justifyContent: 'space-between' } });
        
        const confirm_all_btn = this.Helpers.create_element('button', {
            id: `${position}-confirm-all-btn`,
            class_name: ['button', 'button-success'],
            text_content: t('confirm_all_assessments_button')
        });
        confirm_all_btn.addEventListener('click', () => this.router('final_confirm_updates'));

        const return_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('return_to_audit_overview')
        });
        return_btn.addEventListener('click', () => this.router('audit_overview'));

        actions_div.append(confirm_all_btn, return_btn);
        return actions_div;
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate' });
        this.root.appendChild(this.plate_element_ref);

        const global_message_element = this.NotificationComponent.get_global_message_element_reference();
        if (global_message_element) {
            this.plate_element_ref.appendChild(global_message_element);
        }

        const { updated_reqs_by_sample, total_count } = this.get_updated_reqs_data();
        
        this.h1_ref = this.Helpers.create_element('h1', { attributes: { tabindex: '-1' } });
        this.plate_element_ref.appendChild(this.h1_ref);

        if (total_count === 0) {
            this.h1_ref.textContent = t('all_updates_handled_title');
            this.plate_element_ref.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('all_updates_handled_text') }));
            
            const return_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                text_content: t('return_to_audit_overview')
            });
            return_btn.addEventListener('click', () => this.router('audit_overview'));
            this.plate_element_ref.appendChild(return_btn);

            this.h1_ref.focus();
            return;
        }

        this.h1_ref.textContent = t('handle_updated_assessments_title', { count: total_count });
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('handle_updated_assessments_intro') }));
        
        this.plate_element_ref.appendChild(this.render_action_buttons('top'));

        this.list_container_for_delegation = this.Helpers.create_element('div');
        this.list_container_for_delegation.addEventListener('click', this.handle_list_item_click);
        // Add keyboard support for accessibility
        this.list_container_for_delegation.addEventListener('keydown', this.handle_list_item_keydown);

        for (const sampleId in updated_reqs_by_sample) {
            const data = updated_reqs_by_sample[sampleId];
            const sample_section = this.Helpers.create_element('section', { style: { marginTop: '2rem' } });
            
            const h2 = this.Helpers.create_element('h2', { 
                text_content: `${t('sample_label')}: ${data.sampleName}`,
                attributes: { tabindex: '-1' }
            });
            sample_section.appendChild(h2);

            const ul = this.Helpers.create_element('ul', { class_name: 'item-list', style: { listStyle: 'none', padding: 0 } });
            data.requirements.forEach(req => {
                const li = this.Helpers.create_element('li', { class_name: 'item-list-item compact-review-item', style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } });
                
                const link_text = req.reference
                    ? t('requirement_with_reference', { title: req.title, reference: req.reference })
                    : req.title;
                const link = this.Helpers.create_element('a', {
                    text_content: link_text,
                    attributes: { href: '#' },
                    event_listeners: { click: (e) => { e.preventDefault(); this.router('requirement_audit', { sampleId, requirementId: req.id }); }}
                });

                let btn_text_key = 'confirm_status_and_return';
                let btn_class = 'button-secondary';
                if (req.status === 'passed') { btn_text_key = 'keep_passed_button'; btn_class = 'button-success'; }
                else if (req.status === 'failed') { btn_text_key = 'keep_failed_button'; btn_class = 'button-danger'; }

                const confirm_button = this.Helpers.create_element('button', {
                    class_name: ['button', btn_class, 'button-small'],
                    text_content: t(btn_text_key),
                    attributes: {
                        'data-action': 'confirm-single',
                        'data-sample-id': sampleId,
                        'data-requirement-id': req.id,
                        'aria-label': `${t(btn_text_key)} ${t('for_requirement')} ${link_text}`
                    }
                });

                li.append(link, confirm_button);
                ul.appendChild(li);
            });
            sample_section.appendChild(ul);
            this.list_container_for_delegation.appendChild(sample_section);
        }
        
        this.plate_element_ref.appendChild(this.list_container_for_delegation);
        this.plate_element_ref.appendChild(this.render_action_buttons('bottom'));
    },

    destroy() {
        if (this.list_container_for_delegation) {
            this.list_container_for_delegation.removeEventListener('click', this.handle_list_item_click);
            this.list_container_for_delegation.removeEventListener('keydown', this.handle_list_item_keydown);
        }
        if (this.root) this.root.innerHTML = '';
        this.plate_element_ref = null;
        this.list_container_for_delegation = null;
        this.h1_ref = null;
        this.root = null;
        this.deps = null;
    }
};

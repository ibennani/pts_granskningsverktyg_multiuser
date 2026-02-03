import "../../css/components/sample_list_component.css";
import { ProgressBarComponent } from './ProgressBarComponent.js';

export const SampleListComponent = {
    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.on_edit_callback = deps.on_edit || null;
        this.on_delete_callback = deps.on_delete || null;
        this.router = deps.router;
        this.getState = deps.getState;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.AuditLogic = deps.AuditLogic;
        
        this.ul_element_for_delegation = null;
        this.handle_list_click = this.handle_list_click.bind(this);
    },

    get_t_internally() {
        return this.Translation?.t || ((key) => `**${key}**`);
    },

    handle_list_click(event) {
        const target = event.target;
        const current_global_state = this.getState ? this.getState() : null; 
        if (!current_global_state) return;

        const action_button = target.closest('button[data-action]');
        if (!action_button) return; 

        const sample_list_item_element = action_button.closest('.sample-list-item[data-sample-id]');
        if (!sample_list_item_element) return; 

        const sample_id = sample_list_item_element.dataset.sampleId;
        const action = action_button.dataset.action;
        const sample = current_global_state.samples.find(s => s.id === sample_id);
        if (!sample) return;
        
        switch (action) {
            case 'edit-sample':
                if (typeof this.on_edit_callback === 'function') this.on_edit_callback(sample_id);
                break;
            case 'delete-sample':
                if (typeof this.on_delete_callback === 'function') this.on_delete_callback(sample_id);
                break;
            case 'view-requirements':
                if (this.router) this.router('requirement_list', { sampleId: sample_id });
                break;
            case 'visit-url':
                if (sample.url && this.Helpers?.add_protocol_if_missing) window.open(this.Helpers.add_protocol_if_missing(sample.url), '_blank', 'noopener,noreferrer');
                break;
            case 'review-sample':
                if (this.router && current_global_state.ruleFileContent && this.AuditLogic?.find_first_incomplete_requirement_key_for_sample) {
                    const first_incomplete_req_key = this.AuditLogic.find_first_incomplete_requirement_key_for_sample(current_global_state.ruleFileContent, sample);
                    if (first_incomplete_req_key) {
                        this.router('requirement_audit', { sampleId: sample.id, requirementId: first_incomplete_req_key });
                    } else { 
                        this.router('requirement_list', { sampleId: sample.id });
                    }
                }
                break;
        }
    },

    render() {
        if (!this.root) return;

        const t = this.get_t_internally();
        const state = this.getState(); 

        const { create_element, get_icon_svg, escape_html, add_protocol_if_missing } = this.Helpers;
        const { get_relevant_requirements_for_sample, find_first_incomplete_requirement_key_for_sample, calculate_requirement_status } = this.AuditLogic;
        
        this.root.innerHTML = '';

        if (!state?.samples || state.samples.length === 0) {
            this.root.appendChild(create_element('p', { class_name: 'no-samples-message', text_content: t('no_samples_added') }));
            return;
        }

        if (!this.ul_element_for_delegation) {
            this.ul_element_for_delegation = create_element('ul', { class_name: 'sample-list item-list' });
            this.ul_element_for_delegation.addEventListener('click', this.handle_list_click);
        } else {
            this.ul_element_for_delegation.innerHTML = '';
        }
        
        // --- FIX: Create lookup maps for new hierarchical data ---
        const content_types_map = new Map();
        const content_types = state.ruleFileContent.metadata?.vocabularies?.contentTypes || state.ruleFileContent.metadata?.contentTypes || [];
        content_types.forEach(parent => {
            (parent.types || []).forEach(child => content_types_map.set(child.id, child.text));
        });

        const sample_categories_map = new Map();
        const sample_subcategories_map = new Map();
        (state.ruleFileContent.metadata.samples?.sampleCategories || []).forEach(cat => {
            sample_categories_map.set(cat.id, cat.text);
            (cat.categories || []).forEach(subcat => {
                sample_subcategories_map.set(subcat.id, subcat.text);
            });
        });
        
        const can_edit_or_delete = state.auditStatus !== 'locked';

        state.samples.forEach(sample => {
            const li = create_element('li', { 
                class_name: 'sample-list-item item-list-item',
                attributes: {'data-sample-id': sample.id}
            });
            
            const info_div = create_element('div', { class_name: 'sample-info' });
            
            const desc_h2 = create_element('h2');
            const sample_needs_review = Object.values(sample.requirementResults || {}).some(res => res.needsReview === true);

            if (sample_needs_review && get_icon_svg) {
                desc_h2.innerHTML = get_icon_svg('update', ['currentColor'], 20) + ' ';
            }
            
            const sample_description_text = sample.description || t('undefined_description');
            if (sample.url) {
                desc_h2.appendChild(create_element('a', {
                    text_content: sample_description_text,
                    attributes: { href: add_protocol_if_missing(sample.url), target: '_blank', rel: 'noopener noreferrer' }
                }));
            } else {
                desc_h2.appendChild(document.createTextNode(sample_description_text));
            }
            info_div.appendChild(desc_h2);
            
            // --- FIX: Display text from maps ---
            const category_text = sample_categories_map.get(sample.sampleCategory) || sample.sampleCategory;
            const type_text = sample_subcategories_map.get(sample.sampleType) || sample.sampleType;
            const type_info_string = `${type_text || ''} (${category_text || ''})`;
            const type_p = create_element('p');
            const strong_element = create_element('strong', { text_content: t('page_type') });
            type_p.appendChild(strong_element);
            type_p.appendChild(document.createTextNode(': '));
            type_p.appendChild(document.createTextNode(escape_html(type_info_string)));
            info_div.appendChild(type_p);

            const relevant_reqs = get_relevant_requirements_for_sample(state.ruleFileContent, sample);
            const total_relevant_reqs = relevant_reqs.length;
            
            const audited_reqs_count = relevant_reqs.filter(req => {
                const status = calculate_requirement_status(req, (sample.requirementResults || {})[req.key || req.id]);
                return status === 'passed' || status === 'failed';
            }).length;

            info_div.appendChild(create_element('p', { 
                html_content: `<strong>${t('requirements_audited_for_sample')}:</strong> ${audited_reqs_count} / ${total_relevant_reqs}` 
            }));
            
            if (ProgressBarComponent) {
                info_div.appendChild(ProgressBarComponent.create(audited_reqs_count, total_relevant_reqs, {}));
            }
            
            if (sample.selectedContentTypes?.length > 0) {
                const content_types_wrapper = create_element('div', { class_name: 'content-types-wrapper' });
                content_types_wrapper.appendChild(create_element('strong', { class_name: 'content-types-label', text_content: t('content_types') + ':' }));
                const tags_container = create_element('div', { class_name: 'content-types-tags-container' });
                sample.selectedContentTypes.forEach(ct_id => {
                    tags_container.appendChild(create_element('span', { class_name: 'content-type-tag', text_content: escape_html(content_types_map.get(ct_id) || ct_id) }));
                });
                content_types_wrapper.appendChild(tags_container);
                info_div.appendChild(content_types_wrapper);
            }
            li.appendChild(info_div);

            const actions_wrapper_div = create_element('div', { class_name: 'sample-actions-wrapper' });
            const main_actions_div = create_element('div', { class_name: 'sample-actions-main' });
            const delete_actions_div = create_element('div', { class_name: 'sample-actions-delete' });
            
            if (can_edit_or_delete) {
                 if (this.on_edit_callback) {
                    main_actions_div.appendChild(create_element('button', {
                        class_name: ['button', 'button-secondary', 'button-small'],
                        attributes: { 'data-action': 'edit-sample', 'aria-label': `${t('edit_sample')}: ${sample.description}` },
                        html_content: `<span>${t('edit_sample')}</span>` + (get_icon_svg ? get_icon_svg('edit', ['currentColor'], 16) : '')
                    }));
                 }
                 if (this.on_delete_callback && state.samples.length > 1) {
                    delete_actions_div.appendChild(create_element('button', {
                        class_name: ['button', 'button-danger', 'button-small'],
                        attributes: { 'data-action': 'delete-sample', 'aria-label': `${t('delete_sample')}: ${sample.description}` },
                        html_content: `<span>${t('delete_sample')}</span>` + (get_icon_svg ? get_icon_svg('delete', ['currentColor'], 16) : '')
                    }));
                }
            }

            if (total_relevant_reqs > 0) {
                main_actions_div.appendChild(create_element('button', {
                    class_name: ['button', 'button-secondary', 'button-small'],
                    attributes: { 'data-action': 'view-requirements', 'aria-label': `${t('view_all_requirements_button')}: ${sample.description}` },
                    html_content: `<span>${t('view_all_requirements_button')}</span>` + (get_icon_svg ? get_icon_svg('list', ['currentColor'], 16) : '')
                }));
            }

            if (state.auditStatus === 'in_progress' && total_relevant_reqs > 0) {
                const first_incomplete = find_first_incomplete_requirement_key_for_sample(state.ruleFileContent, sample);
                if (first_incomplete) {
                    main_actions_div.appendChild(create_element('button', {
                        class_name: ['button', 'button-primary', 'button-small'],
                        attributes: { 'data-action': 'review-sample', 'aria-label': `${t('audit_next_incomplete_requirement')}: ${sample.description}` },
                        html_content: `<span>${t('audit_next_incomplete_requirement')}</span>` + (get_icon_svg ? get_icon_svg('audit_sample', ['currentColor'], 16) : '')
                    }));
                }
            }
            
            if (main_actions_div.hasChildNodes()) actions_wrapper_div.appendChild(main_actions_div);
            if (delete_actions_div.hasChildNodes()) actions_wrapper_div.appendChild(delete_actions_div);
            if (actions_wrapper_div.hasChildNodes()) li.appendChild(actions_wrapper_div);

            this.ul_element_for_delegation.appendChild(li);
        });
        this.root.appendChild(this.ul_element_for_delegation);
    },

    destroy() {
        if (this.ul_element_for_delegation) {
            this.ul_element_for_delegation.removeEventListener('click', this.handle_list_click);
            this.ul_element_for_delegation = null;
        }
        if (this.root) {
            this.root.innerHTML = '';
            this.root = null;
        }
        this.deps = null;
        this.on_edit_callback = null;
        this.on_delete_callback = null;
        this.router = null;
        this.getState = null;
        this.Translation = null;
        this.Helpers = null;
        this.AuditLogic = null;
    }
};

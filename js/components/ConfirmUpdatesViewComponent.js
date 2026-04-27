import { app_runtime_refs } from "../utils/app_runtime_refs.js";
import "./confirm_updates_view_component.css";
import "./requirement_list_toolbar_component.css";

export class ConfirmUpdatesViewComponent {
    constructor() {
        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.AuditLogic = null;
        this.plate_element_ref = null;
        this.list_container_for_delegation = null;
        this.h1_ref = null;
        this._filter_search = '';
        this._sort_by = 'sample_asc';
    }

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
        this.AuditLogic = deps.AuditLogic;

        this.plate_element_ref = null;
        this.list_container_for_delegation = null;
        this.h1_ref = null;
        this._filter_search = '';
        this._sort_by = 'sample_asc';

        // Bind event handlers
        this.handle_list_item_click = this.handle_list_item_click.bind(this);
        this.handle_filter_search_input = this.handle_filter_search_input.bind(this);
        this.handle_sort_change = this.handle_sort_change.bind(this);
    }

    handle_filter_search_input(event) {
        this._filter_search = (event.target.value || '').trim();
        this.render();
    }

    handle_sort_change(event) {
        this._sort_by = event.target.value || 'sample_asc';
        this.render();
    }

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
    }

    get_updated_reqs_data() {
        const state = this.getState();
        const updated_reqs_by_sample = {};
        let total_count = 0;
        const samples = state?.samples || [];
        const requirements = state?.ruleFileContent?.requirements;

        samples.forEach(sample => {
            const sample_reqs = [];
            Object.keys(sample.requirementResults || {}).forEach(reqId => {
                const req_def = requirements && this.AuditLogic.find_requirement_definition
                    ? this.AuditLogic.find_requirement_definition(requirements, reqId)
                    : (Array.isArray(requirements) ? requirements.find(r => (r?.key || r?.id) === reqId) : requirements?.[reqId]);
                if (!req_def) return;
                const resolved = this.AuditLogic.get_stored_requirement_result_for_def(
                    sample.requirementResults,
                    requirements,
                    req_def,
                    reqId
                );
                if (resolved?.needsReview === true) {
                    const display_status = this.AuditLogic.get_effective_requirement_audit_status
                        ? this.AuditLogic.get_effective_requirement_audit_status(
                            requirements,
                            sample.requirementResults,
                            req_def,
                            reqId
                        )
                        : 'not_audited';
                    // Visa bara krav som du faktiskt bedömt (godkänd/underkänd). Krav som ännu inte har en tydlig status behöver inte bekräftas här.
                    if (display_status === 'passed' || display_status === 'failed') {
                        sample_reqs.push({
                            id: reqId,
                            title: req_def.title,
                            reference: req_def.standardReference?.text || '',
                            status: display_status
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
    }

    render_action_buttons(position, total_count) {
        const t = this.Translation.t;
        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: { marginTop: '1.5rem', justifyContent: 'space-between' } });

        const confirm_all_btn = this.Helpers.create_element('button', {
            id: `${position}-confirm-all-btn`,
            class_name: ['button', 'button-primary'],
            text_content: t('confirm_all_assessments_button')
        });
        confirm_all_btn.addEventListener('click', () => this.handle_confirm_all_click(confirm_all_btn, total_count));

        const return_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('return_to_audit_overview')
        });
        return_btn.addEventListener('click', () => this.router('audit_overview'));

        actions_div.append(confirm_all_btn, return_btn);
        return actions_div;
    }

    handle_confirm_all_click(trigger_button, total_count) {
        const t = this.Translation.t;
        const ModalComponent = app_runtime_refs.modal_component;
        if (!ModalComponent?.show || !this.Helpers?.create_element) {
            this.router('final_confirm_updates');
            return;
        }
        ModalComponent.show(
            {
                h1_text: t('confirm_all_assessments_modal_title'),
                message_text: ''
            },
            (container, modal) => {
                const count = total_count || 0;
                const msg_el = container.querySelector('.modal-message');
                if (msg_el) {
                    const wrapper = this.Helpers.create_element('div', { class_name: 'modal-message' });
                    const p1 = this.Helpers.create_element('p');
                    const strong1 = this.Helpers.create_element('strong', { text_content: t('confirm_all_assessments_modal_what_label') + ':' });
                    p1.appendChild(strong1);
                    p1.appendChild(document.createTextNode(' ' + t('confirm_all_assessments_modal_what', { count })));
                    const p2 = this.Helpers.create_element('p');
                    const strong2 = this.Helpers.create_element('strong', { text_content: t('confirm_all_assessments_modal_consequence_label') + ':' });
                    p2.appendChild(strong2);
                    p2.appendChild(document.createTextNode(' ' + t('confirm_all_assessments_modal_consequence')));
                    wrapper.appendChild(p1);
                    wrapper.appendChild(p2);
                    msg_el.parentNode.replaceChild(wrapper, msg_el);
                }
                const actions_wrapper = this.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
                const confirm_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('confirm_all_assessments_modal_confirm_btn')
                });
                confirm_btn.addEventListener('click', () => {
                    modal.close(trigger_button);
                    this.dispatch({ type: this.StoreActionTypes.CONFIRM_ALL_REVIEWED_REQUIREMENTS });
                    if (this.NotificationComponent?.show_global_message) {
                        this.NotificationComponent.show_global_message(t('all_updated_assessments_confirmed_toast'), 'success');
                    }
                    this.router('audit_overview');
                });
                const later_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('confirm_all_assessments_modal_later')
                });
                later_btn.addEventListener('click', () => modal.close(trigger_button));
                actions_wrapper.append(confirm_btn, later_btn);
                container.appendChild(actions_wrapper);
            }
        );
    }

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate' });
        this.root.appendChild(this.plate_element_ref);

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
        
        this.plate_element_ref.appendChild(this.render_action_buttons('top', total_count));

        const filter_wrapper = this.Helpers.create_element('div', { class_name: 'requirements-list-filter-section confirm-updates-filter-section' });
        const filter_heading = this.Helpers.create_element('h2', { text_content: t('requirement_audit_sidebar_filter_heading_sample_requirements') });
        filter_wrapper.appendChild(filter_heading);

        const toolbar = this.Helpers.create_element('div', { class_name: 'requirements-list-toolbar' });
        const search_group = this.Helpers.create_element('div', { class_name: 'toolbar-group search-group' });
        const search_id = 'confirm-updates-search';
        search_group.appendChild(this.Helpers.create_element('label', { attributes: { for: search_id }, text_content: t('search_in_help_texts_label') }));
        const search_input = this.Helpers.create_element('input', { id: search_id, class_name: 'form-control', attributes: { type: 'search' } });
        search_input.value = this._filter_search;
        search_input.addEventListener('input', this.handle_filter_search_input);
        search_group.appendChild(search_input);
        toolbar.appendChild(search_group);

        const sort_options = [
            { value: 'sample_asc', textKey: 'sort_option_sample_asc' },
            { value: 'sample_desc', textKey: 'sort_option_sample_desc' },
            { value: 'ref_asc', textKey: 'sort_option_ref_asc_natural' },
            { value: 'ref_desc', textKey: 'sort_option_ref_desc_natural' },
            { value: 'title_asc', textKey: 'sort_option_title_asc' },
            { value: 'title_desc', textKey: 'sort_option_title_desc' }
        ];
        const sort_group = this.Helpers.create_element('div', { class_name: 'toolbar-group sort-group' });
        const sort_id = 'confirm-updates-sort';
        sort_group.appendChild(this.Helpers.create_element('label', { attributes: { for: sort_id }, text_content: t('sort_by_label') }));
        const sort_select = this.Helpers.create_element('select', { id: sort_id, class_name: 'form-control' });
        sort_options.forEach(opt => {
            sort_select.appendChild(this.Helpers.create_element('option', { value: opt.value, text_content: t(opt.textKey) }));
        });
        sort_select.value = this._sort_by;
        sort_select.addEventListener('change', this.handle_sort_change);
        sort_group.appendChild(sort_select);
        toolbar.appendChild(sort_group);
        filter_wrapper.appendChild(toolbar);
        this.plate_element_ref.appendChild(filter_wrapper);

        const filter_term = (this._filter_search || '').toLowerCase().trim();
        const matches_search = (sampleId, data) => {
            if (!filter_term) return true;
            const name_ok = (data.sampleName || '').toLowerCase().includes(filter_term);
            const req_ok = (data.requirements || []).some(r =>
                (r.title || '').toLowerCase().includes(filter_term) ||
                (r.reference || '').toLowerCase().includes(filter_term)
            );
            return name_ok || req_ok;
        };

        const sort_by_req = ['ref_asc', 'ref_desc', 'title_asc', 'title_desc'].includes(this._sort_by);
        const flat_items = [];
        Object.keys(updated_reqs_by_sample).forEach(sampleId => {
            const data = updated_reqs_by_sample[sampleId];
            if (!matches_search(sampleId, data)) return;
            (data.requirements || []).forEach(req => {
                flat_items.push({ sampleId, sampleName: data.sampleName, req });
            });
        });

        let sample_ids_ordered = [];
        const ref_or_empty = (r) => (r.reference || '').trim();
        const title_or_empty = (r) => (r.title || '').trim();
        const cmp = (a, b) => (a || '').localeCompare(b || '', 'sv', { numeric: true, sensitivity: 'base' });
        if (sort_by_req) {
            const rev = this._sort_by === 'ref_desc' || this._sort_by === 'title_desc' ? -1 : 1;
            flat_items.sort((a, b) => {
                const va = this._sort_by.startsWith('ref') ? ref_or_empty(a.req) : title_or_empty(a.req);
                const vb = this._sort_by.startsWith('ref') ? ref_or_empty(b.req) : title_or_empty(b.req);
                return rev * cmp(va, vb);
            });
        } else {
            sample_ids_ordered = Object.keys(updated_reqs_by_sample).filter(sid => matches_search(sid, updated_reqs_by_sample[sid]));
            sample_ids_ordered.sort((a, b) => {
                const na = (updated_reqs_by_sample[a].sampleName || '').trim();
                const nb = (updated_reqs_by_sample[b].sampleName || '').trim();
                const v = cmp(na, nb);
                return this._sort_by === 'sample_desc' ? -v : v;
            });
        }

        this.list_container_for_delegation = this.Helpers.create_element('div');
        this.list_container_for_delegation.addEventListener('click', this.handle_list_item_click);

        const render_one_item = (sampleId, sampleName, req) => {
            const li = this.Helpers.create_element('li', { class_name: 'item-list-item compact-review-item', style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' } });
            const link_text = req.reference
                ? t('requirement_with_reference', { title: req.title, reference: req.reference })
                : req.title;
            const link = this.Helpers.create_element('a', {
                text_content: link_text,
                attributes: { href: '#' },
                event_listeners: { click: (e) => { e.preventDefault(); this.router('requirement_audit', { sampleId, requirementId: req.id }); } }
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
            const left = this.Helpers.create_element('span', { class_name: 'confirm-updates-item-left' });
            if (sort_by_req) {
                left.appendChild(this.Helpers.create_element('span', { class_name: 'confirm-updates-sample-name', text_content: `${t('sample_label')}: ${sampleName}` }));
            }
            left.appendChild(link);
            li.append(left, confirm_button);
            return li;
        };

        if (sort_by_req) {
            const ul = this.Helpers.create_element('ul', { class_name: 'item-list', style: { listStyle: 'none', padding: 0 } });
            flat_items.forEach(({ sampleId, sampleName, req }) => ul.appendChild(render_one_item(sampleId, sampleName, req)));
            this.list_container_for_delegation.appendChild(ul);
        } else {
            sample_ids_ordered.forEach(sampleId => {
                const data = updated_reqs_by_sample[sampleId];
                const sample_section = this.Helpers.create_element('section', { style: { marginTop: '2rem' } });
                const h2 = this.Helpers.create_element('h2', {
                    text_content: `${t('sample_label')}: ${data.sampleName}`,
                    attributes: { tabindex: '-1' }
                });
                sample_section.appendChild(h2);
                const ul = this.Helpers.create_element('ul', { class_name: 'item-list', style: { listStyle: 'none', padding: 0 } });
                (data.requirements || []).forEach(req => ul.appendChild(render_one_item(sampleId, data.sampleName, req)));
                sample_section.appendChild(ul);
                this.list_container_for_delegation.appendChild(sample_section);
            });
        }

        this.plate_element_ref.appendChild(this.list_container_for_delegation);
        this.plate_element_ref.appendChild(this.render_action_buttons('bottom', total_count));
    }

    destroy() {
        if (this.list_container_for_delegation) {
            this.list_container_for_delegation.removeEventListener('click', this.handle_list_item_click);
        }
        if (this.root) this.root.innerHTML = '';
        this.plate_element_ref = null;
        this.list_container_for_delegation = null;
        this.h1_ref = null;
        this.root = null;
        this.deps = null;
    }
}

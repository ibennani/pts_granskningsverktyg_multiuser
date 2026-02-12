// js/components/RequirementAuditComponent.js

import { ChecklistHandler } from './requirement_audit/ChecklistHandler.js';
import { RequirementInfoSections } from './requirement_audit/RequirementInfoSections.js';
import { RequirementAuditNavigationComponent } from './requirement_audit/RequirementAuditNavigation.js';
import { RequirementAuditSidebarComponent } from './RequirementAuditSidebarComponent.js';
import "../../css/components/requirement_audit_component.css";

export const RequirementAuditComponent = {
    // Dependencies
    root: null,
    deps: null,
    router: null,
    params: null,
    getState: null,
    dispatch: null,
    StoreActionTypes: null,
    Translation: null,
    Helpers: null,
    NotificationComponent: null,
    AuditLogic: null,

    // Sub-component instances
    checklist_handler_instance: null,
    info_sections_instance: null,
    top_navigation_instance: null,
    bottom_navigation_instance: null,
    right_sidebar_component_instance: null,

    // DOM references
    plate_element_ref: null,
    global_message_element_ref: null,
    comment_to_auditor_input: null,
    comment_to_actor_input: null,

    // Internal state
    current_sample: null,
    current_requirement: null,
    current_result: null,
    ordered_requirement_keys: [],
    right_sidebar_root: null,
    sidebar_navigation_state: null,
    debounceTimerAudit: null,

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
        this.AuditLogic = deps.AuditLogic;
        this.right_sidebar_root = deps.rightSidebarRoot || null;

        // Bind methods
        this.handle_checklist_status_change = this.handle_checklist_status_change.bind(this);
        this.handle_navigation = this.handle_navigation.bind(this);
        this.handle_comment_input = this.handle_comment_input.bind(this);
        this.handle_comment_input_with_autosave = this.handle_comment_input_with_autosave.bind(this);
        this.debounced_autosave_result = this.debounced_autosave_result.bind(this);
        this.handle_sidebar_filters_change = this.handle_sidebar_filters_change.bind(this);

        this.global_message_element_ref = this.NotificationComponent.get_global_message_element_reference();

        if (this.right_sidebar_root) {
            this.right_sidebar_component_instance = RequirementAuditSidebarComponent;
            await this.right_sidebar_component_instance.init({
                root: this.right_sidebar_root,
                deps: {
                    ...this.deps,
                    dispatch: this.dispatch,
                    StoreActionTypes: this.StoreActionTypes,
                    onSidebarFiltersChange: this.handle_sidebar_filters_change
                }
            });
        }
    },

    load_and_prepare_view_data() {
        const state = this.getState();
        
        if (!state || typeof state !== 'object') {
            console.warn('[RequirementAuditComponent] No valid state available for data loading');
            return false;
        }
        
        if (!state.ruleFileContent || typeof state.ruleFileContent !== 'object') {
            console.warn('[RequirementAuditComponent] No valid ruleFileContent available for data loading');
            return false;
        }
        
        if (!this.params?.sampleId) {
            console.warn('[RequirementAuditComponent] No sampleId available for data loading');
            return false;
        }
        
        if (!this.params?.requirementId) {
            console.warn('[RequirementAuditComponent] No requirementId available for data loading');
            return false;
        }
        
        if (!Array.isArray(state.samples)) {
            console.warn('[RequirementAuditComponent] No valid samples array available for data loading');
            return false;
        }
        
        this.current_sample = state.samples.find(s => s && s.id === this.params.sampleId);
        if (!this.current_sample) {
            console.warn('[RequirementAuditComponent] Sample not found:', this.params.sampleId);
            return false;
        }
        
        this.current_requirement = state.ruleFileContent.requirements?.[this.params.requirementId];
        if (!this.current_requirement) {
            console.warn('[RequirementAuditComponent] Requirement not found:', this.params.requirementId);
            return false;
        }
        
        const result_from_store = (this.current_sample.requirementResults || {})[this.params.requirementId];
        
        this.current_result = result_from_store 
            ? (() => {
                try {
                    return JSON.parse(JSON.stringify(result_from_store));
                } catch (error) {
                    console.warn('[RequirementAuditComponent] Failed to clone result from store:', error);
                    return { status: 'not_audited', commentToAuditor: '', commentToActor: '', lastStatusUpdate: null, checkResults: {} };
                }
            })()
            : { status: 'not_audited', commentToAuditor: '', commentToActor: '', lastStatusUpdate: null, checkResults: {} };

        (this.current_requirement.checks || []).forEach(check_def => {
            if (!this.current_result.checkResults[check_def.id]) {
                this.current_result.checkResults[check_def.id] = { status: 'not_audited', overallStatus: 'not_audited', passCriteria: {} };
            }
            (check_def.passCriteria || []).forEach(pc_def => {
                const pc_data = this.current_result.checkResults[check_def.id].passCriteria[pc_def.id];
                if (typeof pc_data !== 'object' || pc_data === null) {
                    this.current_result.checkResults[check_def.id].passCriteria[pc_def.id] = {
                        status: typeof pc_data === 'string' ? pc_data : 'not_audited',
                        observationDetail: '',
                        timestamp: null,
                        attachedMediaFilenames: [],
                        stuckProblemDescription: ''
                    };
                } else {
                    if (!Array.isArray(pc_data.attachedMediaFilenames)) {
                        pc_data.attachedMediaFilenames = [];
                    }
                    if (typeof pc_data.stuckProblemDescription !== 'string') {
                        pc_data.stuckProblemDescription = '';
                    }
                }
            });
        });
        
        this.ordered_requirement_keys = this.AuditLogic.get_ordered_relevant_requirement_keys(state.ruleFileContent, this.current_sample, 'default');
        return true;
    },

    handle_checklist_status_change(change_info) {
        let modified_result;
        try {
            modified_result = JSON.parse(JSON.stringify(this.current_result));
        } catch (error) {
            console.warn('[RequirementAuditComponent] Failed to clone current result for status change:', error);
            return;
        }
        const check_result = modified_result.checkResults[change_info.checkId];
        const check_definition = this.current_requirement.checks.find(c => c.id === change_info.checkId);
        const current_time = this.Helpers.get_current_iso_datetime_utc();

        if (change_info.type === 'check_overall_status_change') {
            check_result.overallStatus = check_result.overallStatus === change_info.newStatus ? 'not_audited' : change_info.newStatus;
            check_result.timestamp = current_time;
        } else if (change_info.type === 'pc_status_change') {
            if (check_result.overallStatus !== 'passed') {
                this.NotificationComponent.show_global_message(this.Translation.t('error_set_check_status_first'), 'warning');
                return;
            }
            const pc_result = check_result.passCriteria[change_info.pcId];
            pc_result.status = pc_result.status === change_info.newStatus ? 'not_audited' : change_info.newStatus;
            pc_result.timestamp = current_time;
            
            if (pc_result.status === 'failed' && (!pc_result.observationDetail || pc_result.observationDetail.trim() === '')) {
                const pc_def = check_definition.passCriteria.find(pc => pc.id === change_info.pcId);
                if (pc_def?.failureStatementTemplate) {
                    pc_result.observationDetail = pc_def.failureStatementTemplate;
                }
            }
        }
        
        this.dispatch_result_update(modified_result);
    },
    
    handle_comment_input() {
        if (!this.current_result) return;
        if (this.comment_to_auditor_input) {
            this.current_result.commentToAuditor = this.comment_to_auditor_input.value;
        }
        if (this.comment_to_actor_input) {
            this.current_result.commentToActor = this.comment_to_actor_input.value;
        }
    },

    handle_comment_input_with_autosave() {
        this.handle_comment_input();
        this.debounced_autosave_result();
    },

    debounced_autosave_result() {
        clearTimeout(this.debounceTimerAudit);
        this.debounceTimerAudit = setTimeout(() => {
            this.save_result_immediately({ skipRender: true });
        }, 250);
    },

    handle_sidebar_filters_change(payload) {
        this.sidebar_navigation_state = payload;
        this.render_navigation_from_sidebar();
    },

    render_navigation_from_sidebar() {
        if (!this.top_navigation_instance || !this.bottom_navigation_instance) return;
        const nav_options = this.build_navigation_options();
        this.top_navigation_instance.render(nav_options);
        this.bottom_navigation_instance.render(nav_options);
    },

    build_navigation_options() {
        const t = this.Translation.t;
        const state = this.getState();
        const is_locked = state?.auditStatus === 'locked';
        const navigation_state = this.get_navigation_state();
        const { mode, is_first, is_last, prev_item, next_item, next_unhandled_item } = navigation_state;

        // Välj rätt översättningsnyckel baserat på mode
        const is_sample_mode = mode === 'requirement_samples';
        const previous_key = is_sample_mode ? 'previous_sample' : 'previous_requirement';
        const next_key = is_sample_mode ? 'next_sample' : 'next_requirement';
        const next_unhandled_key = is_sample_mode ? 'next_unhandled_sample' : 'next_unhandled_requirement';

        const build_aria_label = (button_text, item) => {
            if (!item) return button_text;
            let label = `${button_text}: ${item.link_text}`;
            if (item.ref_text) {
                label = `${label} ${item.ref_text}`;
            }
            return label;
        };

        return {
            is_audit_locked: is_locked,
            is_first_requirement: is_first,
            is_last_requirement: is_last,
            sample_object: this.current_sample,
            rule_file_content: state?.ruleFileContent,
            requirement_result: this.current_result,
            current_requirement_id: this.params.requirementId,
            previous_aria_label: build_aria_label(t(previous_key), prev_item),
            next_aria_label: build_aria_label(t(next_key), next_item),
            next_unhandled_aria_label: build_aria_label(t(next_unhandled_key), next_unhandled_item),
            next_unhandled_available: Boolean(next_unhandled_item),
            previous_text_key: previous_key,
            next_text_key: next_key,
            next_unhandled_text_key: next_unhandled_key
        };
    },

    get_navigation_state() {
        const mode = this.sidebar_navigation_state?.mode || 'sample_requirements';
        let items = [];

        if (mode === 'requirement_samples') {
            items = this.sidebar_navigation_state?.sample_items || [];
        } else {
            items = this.sidebar_navigation_state?.requirement_items || [];
        }

        if (!items.length) {
            if (mode === 'requirement_samples') {
                items = this.get_fallback_sample_items();
            } else {
                items = this.get_fallback_requirement_items();
            }
        }

        const current_key = mode === 'requirement_samples'
            ? String(this.params.sampleId)
            : String(this.params.requirementId);
        const key_for_item = (item) => mode === 'requirement_samples'
            ? String(item?.sample?.id)
            : String(item?.req_key);

        const current_index = items.findIndex(item => key_for_item(item) === current_key);
        const prev_item = current_index > 0 ? items[current_index - 1] : null;
        const next_item = current_index >= 0 && current_index < items.length - 1 ? items[current_index + 1] : null;
        const next_unhandled_item = items.find(item => {
            if (key_for_item(item) === current_key) return false;
            return item.display_status === 'not_audited' || item.display_status === 'partially_audited';
        }) || null;

        return {
            mode,
            items,
            current_index,
            is_first: current_index <= 0,
            is_last: current_index === -1 || current_index >= items.length - 1,
            prev_item,
            next_item,
            next_unhandled_item
        };
    },

    get_fallback_requirement_items() {
        const state = this.getState();
        const rule_file_content = state?.ruleFileContent;
        if (!rule_file_content || !this.current_sample) return [];
        const ordered_keys = this.AuditLogic.get_ordered_relevant_requirement_keys(
            rule_file_content,
            this.current_sample,
            'default'
        );
        return (ordered_keys || []).map(req_key => {
            const requirement = rule_file_content.requirements?.[req_key];
            const req_result = this.current_sample.requirementResults?.[req_key];
            const display_status = req_result?.needsReview ? 'updated' : this.AuditLogic.calculate_requirement_status(requirement, req_result);
            return {
                req_key,
                requirement,
                display_status,
                link_text: requirement?.title || this.Translation.t('unknown_value', { val: req_key }),
                ref_text: requirement?.standardReference?.text || ''
            };
        }).filter(item => item.requirement);
    },

    get_fallback_sample_items() {
        const state = this.getState();
        const rule_file_content = state?.ruleFileContent;
        const samples = state?.samples || [];
        if (!rule_file_content || !this.current_requirement) return [];
        const requirement_key = this.current_requirement?.key || this.params.requirementId;
        const matching = samples.filter(sample => {
            const relevant_requirements = this.AuditLogic.get_relevant_requirements_for_sample(rule_file_content, sample);
            return (relevant_requirements || []).some(req => String(req?.key || req?.id) === String(requirement_key));
        });
        const sorted = matching.sort((a, b) => (a?.description || '').localeCompare(b?.description || '', 'sv', { numeric: true, sensitivity: 'base' }));
        return sorted.map(sample => {
            const req_result = sample?.requirementResults?.[requirement_key];
            const display_status = req_result?.needsReview ? 'updated' : this.AuditLogic.calculate_requirement_status(this.current_requirement, req_result);
            return {
                sample,
                display_status,
                link_text: sample?.description || this.Translation.t('undefined_description')
            };
        });
    },

    dispatch_result_update(modified_result_object, options = {}) {
        (this.current_requirement.checks || []).forEach(check_def => {
            const check_res = modified_result_object.checkResults[check_def.id];
            check_res.status = this.AuditLogic.calculate_check_status(check_def, check_res.passCriteria, check_res.overallStatus);
        });
        modified_result_object.status = this.AuditLogic.calculate_requirement_status(this.current_requirement, modified_result_object);
        modified_result_object.lastStatusUpdate = this.Helpers.get_current_iso_datetime_utc();

        this.dispatch({
            type: this.StoreActionTypes.UPDATE_REQUIREMENT_RESULT,
            payload: {
                sampleId: this.params.sampleId,
                requirementId: this.params.requirementId,
                newRequirementResult: modified_result_object,
                skip_render: options.skipRender === true
            }
        });
    },

    save_result_immediately({ skipRender = false } = {}) {
        if (!this.current_result) return;
        this.dispatch_result_update(this.current_result, { skipRender });
    },

    handle_navigation(action) {
        this.handle_comment_input();
        clearTimeout(this.debounceTimerAudit);
        this.save_result_immediately({ skipRender: true });

        const navigation_state = this.get_navigation_state();
        const mode = navigation_state.mode;
        const { prev_item, next_item, next_unhandled_item } = navigation_state;

        const navigate_to_item = (item) => {
            if (!item) return;
            if (mode === 'requirement_samples') {
                this.router('requirement_audit', { sampleId: item.sample.id, requirementId: this.params.requirementId });
            } else {
                this.router('requirement_audit', { sampleId: this.params.sampleId, requirementId: item.req_key });
            }
        };

        switch (action) {
            case 'back_to_list':
                try {
                    window.sessionStorage?.setItem('gv_return_focus_requirement_list_v1', JSON.stringify({
                        sampleId: this.params.sampleId,
                        requirementId: this.params.requirementId,
                        createdAt: Date.now()
                    }));
                } catch (e) {}
                this.router('requirement_list', { sampleId: this.params.sampleId });
                break;
            case 'previous':
                navigate_to_item(prev_item);
                break;
            case 'next':
                navigate_to_item(next_item);
                break;
            case 'next_unhandled':
                 if (next_unhandled_item) {
                     navigate_to_item(next_unhandled_item);
                 } else {
                     this.NotificationComponent.show_global_message(this.Translation.t('all_requirements_handled_for_sample'), 'info');
                 }
                break;
            case 'confirm_reviewed_status':
                let result;
                try {
                    result = JSON.parse(JSON.stringify(this.current_result));
                } catch (error) {
                    console.warn('[RequirementAuditComponent] Failed to clone current result for confirm status:', error);
                    return;
                }
                delete result.needsReview;
                this.dispatch_result_update(result);
                try {
                    window.sessionStorage?.setItem('gv_return_focus_requirement_list_v1', JSON.stringify({
                        sampleId: this.params.sampleId,
                        requirementId: this.params.requirementId,
                        createdAt: Date.now()
                    }));
                } catch (e) {}
                this.router('requirement_list', { sampleId: this.params.sampleId });
                break;
        }
    },
    
    build_initial_dom() {
        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate requirement-audit-plate' });

        if (this.global_message_element_ref) {
            this.plate_element_ref.appendChild(this.global_message_element_ref);
        }
        
        const top_nav_container = this.Helpers.create_element('div', { class_name: 'audit-navigation-buttons top-nav' });
        this.top_navigation_instance = new RequirementAuditNavigationComponent();
        this.top_navigation_instance.init(top_nav_container, this.handle_navigation, { deps: this.deps });
        
        const bottom_nav_container = this.Helpers.create_element('div', { class_name: 'audit-navigation-buttons bottom-nav' });
        this.bottom_navigation_instance = new RequirementAuditNavigationComponent();
        this.bottom_navigation_instance.init(bottom_nav_container, this.handle_navigation, { deps: this.deps });

        const info_sections_container = this.Helpers.create_element('div');
        this.info_sections_instance = RequirementInfoSections;
        this.info_sections_instance.init(info_sections_container, { deps: this.deps });

        const checklist_container = this.Helpers.create_element('div', { class_name: 'checks-container audit-section' });
        this.checklist_handler_instance = ChecklistHandler;
        this.checklist_handler_instance.init(
            checklist_container,
            {
                onStatusChange: this.handle_checklist_status_change,
                onObservationChange: this.debounced_autosave_result
            },
            { deps: this.deps }
        );
        
        this.plate_element_ref.append(
            this.Helpers.create_element('div', { class_name: 'requirement-audit-header' }),
            info_sections_container,
            top_nav_container,
            checklist_container,
            this.build_comment_fields(),
            bottom_nav_container
        );
        
        this.root.appendChild(this.plate_element_ref);
    },
    
    build_comment_fields() {
        const t = this.Translation.t;
        const container = this.Helpers.create_element('div', { class_name: 'input-fields-container audit-section' });
        container.appendChild(this.Helpers.create_element('h2', { text_content: t('observations_and_comments_title') }));
    
        const fg1 = this.Helpers.create_element('div', { class_name: 'form-group' });
        const label1 = this.Helpers.create_element('label', { attributes: { for: 'commentToAuditor' }, text_content: t('comment_to_auditor') });
        fg1.appendChild(label1);
        this.comment_to_auditor_input = this.Helpers.create_element('textarea', { id: 'commentToAuditor', class_name: 'form-control', attributes: { rows: '4' } });
        this.comment_to_auditor_input.addEventListener('input', this.handle_comment_input_with_autosave);
        this.comment_to_auditor_input.addEventListener('blur', this.handle_comment_input);
        fg1.appendChild(this.comment_to_auditor_input);

        const fg2 = this.Helpers.create_element('div', { class_name: 'form-group' });
        const label2 = this.Helpers.create_element('label', { attributes: { for: 'commentToActor' }, text_content: t('comment_to_actor') });
        fg2.appendChild(label2);
        this.comment_to_actor_input = this.Helpers.create_element('textarea', { id: 'commentToActor', class_name: 'form-control', attributes: { rows: '4' } });
        this.comment_to_actor_input.addEventListener('input', this.handle_comment_input_with_autosave);
        this.comment_to_actor_input.addEventListener('blur', this.handle_comment_input);
        fg2.appendChild(this.comment_to_actor_input);
        
        container.append(fg1, fg2);
        return container;
    },
    
    populate_dom_with_data() {
        const t = this.Translation.t;
        const state = this.getState();
        const is_locked = state.auditStatus === 'locked';

        const header = this.plate_element_ref.querySelector('.requirement-audit-header');
        header.innerHTML = '';
        header.append(
            this.Helpers.create_element('h1', { text_content: this.current_requirement.title }),
            this.create_header_paragraph('standard-reference', t('requirement_standard_reference_label'), this.current_requirement.standardReference),
            this.create_header_paragraph('audited-page-link', t('audited_page_label'), null, true),
            this.create_header_paragraph('overall-requirement-status-display', t('overall_requirement_status'))
        );
        
        const nav_options = this.build_navigation_options();
        this.top_navigation_instance.render(nav_options);
        this.bottom_navigation_instance.render(nav_options);

        this.info_sections_instance.render(this.current_requirement, this.current_sample, state.ruleFileContent.metadata);
        this.checklist_handler_instance.render(this.current_requirement, this.current_result, is_locked);

        const comments_section = this.plate_element_ref.querySelector('.input-fields-container.audit-section');
        if (comments_section) {
            const comments_h2 = comments_section.querySelector('h2');
            if (comments_h2) comments_h2.textContent = t('observations_and_comments_title');
            const label1 = comments_section.querySelector('label[for="commentToAuditor"]');
            if (label1) label1.textContent = t('comment_to_auditor');
            const label2 = comments_section.querySelector('label[for="commentToActor"]');
            if (label2) label2.textContent = t('comment_to_actor');
        }
        
        this.comment_to_auditor_input.value = this.current_result.commentToAuditor || '';
        this.comment_to_actor_input.value = this.current_result.commentToActor || '';
        [this.comment_to_auditor_input, this.comment_to_actor_input].forEach(input => {
            input.readOnly = is_locked;
            input.classList.toggle('readonly-textarea', is_locked);
            if (this.Helpers?.init_auto_resize_for_textarea) {
                this.Helpers.init_auto_resize_for_textarea(input);
            }
        });
        
        if (this.current_result?.needsReview === true) {
            this.NotificationComponent.show_global_message(t('requirement_updated_needs_review'), 'info');
        } else {
            this.NotificationComponent.clear_global_message();
        }
    },

    create_header_paragraph(className, label, data, isSampleLink = false) {
        const p = this.Helpers.create_element('p', { class_name: className });
        p.appendChild(this.Helpers.create_element('strong', { text_content: `${label} ` }));
        
        if (isSampleLink) {
            const context_text = `${this.getState().auditMetadata?.actorName || ''}: ${this.current_sample.description}`;
            if (this.current_sample.url) {
                p.appendChild(this.Helpers.create_element('a', {
                    text_content: context_text,
                    attributes: { href: this.Helpers.add_protocol_if_missing(this.current_sample.url), target: '_blank' }
                }));
            } else {
                p.appendChild(document.createTextNode(context_text));
            }
        } else if (className === 'overall-requirement-status-display') {
            const status_key = this.current_result?.status || 'not_audited';
            const status_text = this.Translation.t(`audit_status_${status_key}`);
            const span = this.Helpers.create_element('span', { class_name: `status-text status-${status_key}`, text_content: status_text });
            p.appendChild(span);
        } else if (data?.text) {
            if (data.url) {
                p.appendChild(this.Helpers.create_element('a', {
                    text_content: data.text,
                    attributes: { href: this.Helpers.add_protocol_if_missing(data.url), target: '_blank' }
                }));
            } else {
                p.appendChild(document.createTextNode(data.text));
            }
        }
        return p;
    },
    
    async render() {
        if (!this.load_and_prepare_view_data()) {
            this.NotificationComponent.show_global_message(this.Translation.t('error_loading_sample_or_requirement_data'), "error");
            this.router('audit_overview');
            return;
        }

        if (!this.plate_element_ref || !this.root.contains(this.plate_element_ref)) {
            this.build_initial_dom();
        }
        
        this.populate_dom_with_data();
        await this.render_right_sidebar();
        this.render_navigation_from_sidebar();
    },

    async render_right_sidebar() {
        if (!this.right_sidebar_component_instance || !this.right_sidebar_root) return;
        const state = this.getState();
        const sidebar_options = {
            current_sample: this.current_sample,
            current_requirement: this.current_requirement,
            rule_file_content: state?.ruleFileContent,
            samples: state?.samples || [],
            requirement_id: this.params?.requirementId
        };
        await this.right_sidebar_component_instance.render(sidebar_options);
        if (typeof this.right_sidebar_component_instance.get_navigation_payload === 'function') {
            this.sidebar_navigation_state = this.right_sidebar_component_instance.get_navigation_payload(sidebar_options);
        }
    },
    
    destroy() { 
        clearTimeout(this.debounceTimerAudit);
        
        // Remove event listeners
        if (this.comment_to_auditor_input) {
            this.comment_to_auditor_input.removeEventListener('input', this.handle_comment_input_with_autosave);
            this.comment_to_auditor_input.removeEventListener('blur', this.handle_comment_input);
            this.comment_to_auditor_input = null;
        }
        if (this.comment_to_actor_input) {
            this.comment_to_actor_input.removeEventListener('input', this.handle_comment_input_with_autosave);
            this.comment_to_actor_input.removeEventListener('blur', this.handle_comment_input);
            this.comment_to_actor_input = null;
        }
        
        this.checklist_handler_instance?.destroy();
        this.info_sections_instance?.destroy();
        this.top_navigation_instance?.destroy();
        this.bottom_navigation_instance?.destroy();
        this.right_sidebar_component_instance?.destroy();
        
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        // Clean up refs
        this.plate_element_ref = null;
        this.right_sidebar_component_instance = null;
        this.right_sidebar_root = null;
    }
};

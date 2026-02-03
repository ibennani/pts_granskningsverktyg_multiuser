// js/components/RequirementAuditComponent.js

import { ChecklistHandler } from './requirement_audit/ChecklistHandler.js';
import { RequirementInfoSections } from './requirement_audit/RequirementInfoSections.js';
import { RequirementAuditNavigationComponent } from './requirement_audit/RequirementAuditNavigation.js';
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

    // DOM references
    plate_element_ref: null,
    global_message_element_ref: null,
    comment_to_auditor_input: null,
    comment_to_actor_input: null,
    debounceTimerComments: null,

    // Internal state
    current_sample: null,
    current_requirement: null,
    current_result: null,
    ordered_requirement_keys: [],

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

        // Bind methods
        this.handle_checklist_status_change = this.handle_checklist_status_change.bind(this);
        this.handle_autosave = this.handle_autosave.bind(this);
        this.handle_navigation = this.handle_navigation.bind(this);
        this.debounced_save_comments = this.debounced_save_comments.bind(this);

        this.global_message_element_ref = this.NotificationComponent.get_global_message_element_reference();
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
                        timestamp: null
                    };
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
    
    debounced_save_comments() {
        clearTimeout(this.debounceTimerComments);
        this.debounceTimerComments = setTimeout(() => {
            let modified_result;
            try {
                modified_result = JSON.parse(JSON.stringify(this.current_result));
            } catch (error) {
                console.warn('[RequirementAuditComponent] Failed to clone current result for comment save:', error);
                return;
            }
            let changed = false;
            if (this.comment_to_auditor_input && modified_result.commentToAuditor !== this.comment_to_auditor_input.value) {
                modified_result.commentToAuditor = this.comment_to_auditor_input.value;
                changed = true;
            }
            if (this.comment_to_actor_input && modified_result.commentToActor !== this.comment_to_actor_input.value) {
                modified_result.commentToActor = this.comment_to_actor_input.value;
                changed = true;
            }
            if (changed) {
                this.dispatch_result_update(modified_result);
            }
        }, 3000);
    },

    handle_autosave(change_info) {
        if (change_info.type === 'pc_observation') {
            let modified_result;
            try {
                modified_result = JSON.parse(JSON.stringify(this.current_result));
            } catch (error) {
                console.warn('[RequirementAuditComponent] Failed to clone current result for autosave:', error);
                return;
            }
            const pc_res = modified_result.checkResults[change_info.checkId].passCriteria[change_info.pcId];
            pc_res.observationDetail = change_info.value;
            pc_res.timestamp = this.Helpers.get_current_iso_datetime_utc();
            this.dispatch_result_update(modified_result);
        }
    },

    dispatch_result_update(modified_result_object) {
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
                newRequirementResult: modified_result_object
            }
        });
    },

    handle_navigation(action) {
        const current_index = this.ordered_requirement_keys.indexOf(this.params.requirementId);
        
        const navigate = (new_index) => {
            if (new_index >= 0 && new_index < this.ordered_requirement_keys.length) {
                this.router('requirement_audit', { sampleId: this.params.sampleId, requirementId: this.ordered_requirement_keys[new_index] });
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
                if (current_index > 0) navigate(current_index - 1);
                break;
            case 'next':
                if (current_index < this.ordered_requirement_keys.length - 1) navigate(current_index + 1);
                break;
            case 'next_unhandled':
                 const next_key = this.AuditLogic.find_first_incomplete_requirement_key_for_sample(this.getState().ruleFileContent, this.current_sample, this.params.requirementId);
                 if (next_key) {
                     this.router('requirement_audit', { sampleId: this.params.sampleId, requirementId: next_key });
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
        this.checklist_handler_instance.init(checklist_container, { onStatusChange: this.handle_checklist_status_change, onAutosave: this.handle_autosave }, { deps: this.deps });
        
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
        this.comment_to_auditor_input.addEventListener('input', this.debounced_save_comments);
        this.comment_to_auditor_input.addEventListener('blur', this.debounced_save_comments);
        fg1.appendChild(this.comment_to_auditor_input);

        const fg2 = this.Helpers.create_element('div', { class_name: 'form-group' });
        const label2 = this.Helpers.create_element('label', { attributes: { for: 'commentToActor' }, text_content: t('comment_to_actor') });
        fg2.appendChild(label2);
        this.comment_to_actor_input = this.Helpers.create_element('textarea', { id: 'commentToActor', class_name: 'form-control', attributes: { rows: '4' } });
        this.comment_to_actor_input.addEventListener('input', this.debounced_save_comments);
        this.comment_to_actor_input.addEventListener('blur', this.debounced_save_comments);
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
        
        const nav_options = {
            is_audit_locked: is_locked,
            is_first_requirement: this.ordered_requirement_keys.indexOf(this.params.requirementId) === 0,
            is_last_requirement: this.ordered_requirement_keys.indexOf(this.params.requirementId) === this.ordered_requirement_keys.length - 1,
            sample_object: this.current_sample,
            rule_file_content: state.ruleFileContent,
            requirement_result: this.current_result,
            current_requirement_id: this.params.requirementId
        };
        this.top_navigation_instance.render(nav_options);
        this.bottom_navigation_instance.render(nav_options);

        this.info_sections_instance.render(this.current_requirement, this.current_sample, state.ruleFileContent.metadata);
        this.checklist_handler_instance.render(this.current_requirement, this.current_result, is_locked);
        
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
    
    render() {
        if (!this.load_and_prepare_view_data()) {
            this.NotificationComponent.show_global_message(this.Translation.t('error_loading_sample_or_requirement_data'), "error");
            this.router('audit_overview');
            return;
        }

        if (!this.plate_element_ref || !this.root.contains(this.plate_element_ref)) {
            this.build_initial_dom();
        }
        
        this.populate_dom_with_data();
    },
    
    destroy() { 
        clearTimeout(this.debounceTimerComments);
        
        // Remove event listeners
        if (this.comment_to_auditor_input) {
            this.comment_to_auditor_input.removeEventListener('input', this.debounced_save_comments);
            this.comment_to_auditor_input.removeEventListener('blur', this.debounced_save_comments);
            this.comment_to_auditor_input = null;
        }
        if (this.comment_to_actor_input) {
            this.comment_to_actor_input.removeEventListener('input', this.debounced_save_comments);
            this.comment_to_actor_input.removeEventListener('blur', this.debounced_save_comments);
            this.comment_to_actor_input = null;
        }
        
        this.checklist_handler_instance?.destroy();
        this.info_sections_instance?.destroy();
        this.top_navigation_instance?.destroy();
        this.bottom_navigation_instance?.destroy();
        
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        // Clean up refs
        this.plate_element_ref = null;
    }
};

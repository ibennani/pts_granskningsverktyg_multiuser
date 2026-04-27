// js/components/RequirementAuditComponent.js

import { get_current_user_name } from '../utils/helpers.js';
import { AutosaveService } from '../logic/autosave_service.js';
import { ChecklistHandler } from './requirement_audit/ChecklistHandler.js';
import { RequirementInfoSections } from './requirement_audit/RequirementInfoSections.js';
import { RequirementAuditNavigationComponent } from './requirement_audit/RequirementAuditNavigation.js';
import { RequirementAuditSidebarComponent } from './RequirementAuditSidebarComponent.js';
import "./requirement_audit_component.css";
import { consoleManager } from '../utils/console_manager.js';
import { establish_baseline_for_current_audit_focus } from '../logic/audit_collaboration_notice.js';
import { subscribe_audit_locks } from '../logic/list_push_service.js';
import {
    init_audit_lock_service,
    try_acquire_audit_part_lock,
    release_audit_part_lock,
    get_current_audit_remote_lock,
    ensure_client_lock_id_for_part
} from '../logic/audit_lock_service.js';
import {
    make_requirement_text_part_key
} from '../logic/audit_part_keys.js';
import { api_patch } from '../api/client.js';
import { make_observation_detail_part_key } from '../logic/audit_part_keys.js';
import { post_same_user_field_commit } from '../logic/same_user_tab_field_sync.js';
import { is_remote_lock_held_by_other_user } from '../logic/collab_lock_compare.js';
import { find_requirement_definition, resolve_requirement_map_key, get_requirement_public_key } from '../audit_logic.js';

/** Intervall för att hämta om lås när WebSocket saknas eller släpper efter — kompletterar push. */
const AUDIT_LOCK_POLL_MS = 4000;

export class RequirementAuditComponent {
    constructor() {
        this.root = null;
        this.deps = null;
        this.router = null;
        this.params = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.AuditLogic = null;
        this.AutosaveService = null;
        this.subscribe = null;
        this.flush_sync_to_server = null;
        this.unsubscribe_from_store = null;

        this.checklist_handler_instance = null;
        this.info_sections_instance = null;
        this.top_navigation_instance = null;
        this.bottom_navigation_instance = null;
        this.right_sidebar_component_instance = null;

        this.plate_element_ref = null;
        this.comment_to_auditor_input = null;
        this.comment_to_actor_input = null;

        this.current_sample = null;
        this.current_requirement = null;
        this.current_result = null;
        this.requirement_public_key = null;
        this.requirement_map_key = null;
        this.ordered_requirement_keys = [];
        this.right_sidebar_root = null;
        this.sidebar_navigation_state = null;
        this.autosave_session = null;
        this._baseline_key = null;
        this._unsubscribe_audit_locks = null;
        this._audit_lock_poll_timer = null;
        this._audit_lock_visibility_handler = null;
    }

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
        this.AutosaveService = deps.AutosaveService || AutosaveService;
        this.right_sidebar_root = deps.rightSidebarRoot || null;
        this.subscribe = deps.subscribe;
        this.flush_sync_to_server = deps.flush_sync_to_server || null;
        this.unsubscribe_from_store = null;

        // Bind methods
        this.handle_checklist_status_change = this.handle_checklist_status_change.bind(this);
        this.handle_navigation = this.handle_navigation.bind(this);
        this.handle_comment_input = this.handle_comment_input.bind(this);
        this.handle_comment_input_with_autosave = this.handle_comment_input_with_autosave.bind(this);
        this.handle_sidebar_filters_change = this.handle_sidebar_filters_change.bind(this);
        this.handle_audit_keydown = this.handle_audit_keydown.bind(this);
        this._refresh_audit_lock_ui_after_remote_state = this._refresh_audit_lock_ui_after_remote_state.bind(this);
        this._on_gv_audit_locks_refresh = (ev) => {
            const aid = ev?.detail?.auditId;
            if (!aid || String(this.getState()?.auditId || '') !== String(aid)) return;
            void this._refresh_audit_lock_ui_after_remote_state();
        };

        if (this.right_sidebar_root) {
            this.right_sidebar_component_instance = new RequirementAuditSidebarComponent();
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

        if (typeof this.subscribe === 'function') {
            this.unsubscribe_from_store = this.subscribe((_new_state, listener_meta) => {
                if (listener_meta?.skip_render) return;
                if (this.root && typeof this.render === 'function') {
                    const active = document.activeElement;
                    const tag = active?.tagName?.toLowerCase();
                    const focus_in_plate = active && (tag === 'textarea' || tag === 'input' || tag === 'select') &&
                        this.plate_element_ref?.contains(active);
                    if (focus_in_plate && listener_meta?.action_type === this.StoreActionTypes.REPLACE_STATE_FROM_REMOTE) {
                        void this._refresh_audit_lock_ui_after_remote_state();
                        return;
                    }
                    if (focus_in_plate) {
                        return;
                    }
                    if (this._should_patch_requirement_result_only(listener_meta)) {
                        void this.patch_dom_after_current_requirement_result_change();
                        return;
                    }
                    if (window.__GV_DEBUG_MODAL_SCROLL && window.ConsoleManager) window.ConsoleManager.log('[GV-ModalDebug] RequirementAuditComponent: render');
                    this.render();
                }
            });
        }

        document.addEventListener('keydown', this.handle_audit_keydown);
        document.addEventListener('gv-audit-locks-refresh', this._on_gv_audit_locks_refresh);
    }

    async _patch_audit_part_to_server({ part_key, value }) {
        const state = this.getState();
        const audit_id = state?.auditId;
        if (!audit_id) return;
        const base_version = Number(state?.version ?? 0);
        try {
            const full_state = await api_patch(`/audits/${encodeURIComponent(audit_id)}/content-part`, {
                part_key,
                base_version,
                value: String(value ?? '')
            });
            if (full_state && typeof this.dispatch === 'function') {
                this.dispatch({
                    type: this.StoreActionTypes.REPLACE_STATE_FROM_REMOTE,
                    payload: {
                        ...full_state,
                        saveFileVersion: full_state.saveFileVersion || '2.1.0'
                    }
                });
            }
        } catch (_) {
            // poll-servicen/versionskonflikt-notis hanterar inkonsistens
        }
    }

    load_and_prepare_view_data() {
        const state = this.getState();
        
        if (!state || typeof state !== 'object') {
            if (window.ConsoleManager) window.ConsoleManager.warn('[RequirementAuditComponent] No valid state available for data loading');
            return false;
        }
        
        if (!state.ruleFileContent || typeof state.ruleFileContent !== 'object') {
            if (window.ConsoleManager) window.ConsoleManager.warn('[RequirementAuditComponent] No valid ruleFileContent available for data loading');
            return false;
        }
        
        if (!this.params?.sampleId) {
            if (window.ConsoleManager) window.ConsoleManager.warn('[RequirementAuditComponent] No sampleId available for data loading');
            return false;
        }
        
        if (!this.params?.requirementId) {
            if (window.ConsoleManager) window.ConsoleManager.warn('[RequirementAuditComponent] No requirementId available for data loading');
            return false;
        }
        
        if (!Array.isArray(state.samples)) {
            if (window.ConsoleManager) window.ConsoleManager.warn('[RequirementAuditComponent] No valid samples array available for data loading');
            return false;
        }
        
        this.current_sample = state.samples.find(s => s && s.id === this.params.sampleId);
        if (!this.current_sample) {
            if (window.ConsoleManager) window.ConsoleManager.warn('[RequirementAuditComponent] Sample not found:', this.params.sampleId);
            return false;
        }
        
        // requirementId i route/hash är den publika "key"-etiketten.
        // För intern lagring (requirementResults, låsnycklar, m.m.) används map-nyckeln i requirements-objektet.
        this.requirement_public_key = String(this.params.requirementId);
        this.requirement_map_key =
            resolve_requirement_map_key(state.ruleFileContent.requirements, this.requirement_public_key)
            || this.requirement_public_key;

        this.current_requirement =
            state.ruleFileContent?.requirements?.[this.requirement_map_key]
            || find_requirement_definition(state.ruleFileContent.requirements, this.requirement_public_key);
        if (!this.current_requirement) {
            if (window.ConsoleManager) window.ConsoleManager.warn('[RequirementAuditComponent] Requirement not found:', this.params.requirementId);
            return false;
        }

        const result_from_store = (this.current_sample.requirementResults || {})[this.requirement_map_key];
        
        this.current_result = result_from_store 
            ? (() => {
                try {
                    return JSON.parse(JSON.stringify(result_from_store));
                } catch (error) {
                    if (window.ConsoleManager) window.ConsoleManager.warn('[RequirementAuditComponent] Failed to clone result from store:', error);
                    return { status: 'not_audited', commentToAuditor: '', commentToActor: '', lastStatusUpdate: null, stuckProblemDescription: '', checkResults: {} };
                }
            })()
            : { status: 'not_audited', commentToAuditor: '', commentToActor: '', lastStatusUpdate: null, stuckProblemDescription: '', checkResults: {} };

        if (typeof this.current_result.stuckProblemDescription !== 'string') {
            this.current_result.stuckProblemDescription = '';
        }

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
                        attachedMediaFilenames: []
                    };
                } else {
                    if (!Array.isArray(pc_data.attachedMediaFilenames)) {
                        pc_data.attachedMediaFilenames = [];
                    }
                }
            });
        });
        
        this.ordered_requirement_keys = this.AuditLogic.get_ordered_relevant_requirement_keys(state.ruleFileContent, this.current_sample, 'default');
        return true;
    }

    _should_patch_requirement_result_only(listener_meta) {
        if (listener_meta?.action_type !== this.StoreActionTypes.UPDATE_REQUIREMENT_RESULT) return false;
        const u = listener_meta.requirement_result_update;
        if (!u || this.params?.sampleId === undefined || this.params?.requirementId === undefined) return false;
        return String(u.sampleId) === String(this.params.sampleId) &&
            String(u.requirementId) === String(this.requirement_map_key);
    }

    _get_checklist_update_details(state) {
        const details_by_key = state.requirementUpdateDetails || {};
        let update_details = details_by_key[this.requirement_map_key]
            ?? details_by_key[this.current_requirement?.key]
            ?? details_by_key[this.current_requirement?.id]
            ?? null;
        if (!update_details && this.current_result?.needsReview && this.current_requirement?.checks?.length) {
            update_details = this._build_fallback_update_details(this.current_requirement);
        }
        return update_details;
    }

    _refresh_overall_requirement_status_in_header() {
        const p = this.plate_element_ref?.querySelector('.overall-requirement-status-display');
        if (!p || !this.Helpers?.create_element) return;
        const t = this.Translation.t;
        const status_key = this.current_requirement && this.current_result
            ? this.AuditLogic.calculate_requirement_status(this.current_requirement, this.current_result)
            : 'not_audited';
        const status_text = t(`audit_status_${status_key}`);
        let span = p.querySelector('.status-text');
        if (!span) {
            span = this.Helpers.create_element('span', {
                class_name: `status-text status-${status_key}`,
                text_content: status_text
            });
            p.appendChild(span);
        } else {
            span.className = `status-text status-${status_key}`;
            span.textContent = status_text;
        }
    }

    async patch_dom_after_current_requirement_result_change() {
        if (!this.load_and_prepare_view_data()) {
            await this.render();
            return;
        }
        const plate_exists = this.plate_element_ref && this.root.contains(this.plate_element_ref);
        if (!plate_exists) {
            await this.render();
            return;
        }

        const state = this.getState();
        const is_locked = state.auditStatus === 'locked' || state.auditStatus === 'archived';
        const t = this.Translation.t;

        this._refresh_overall_requirement_status_in_header();

        const update_details = this._get_checklist_update_details(state);
        this.checklist_handler_instance.render(this.current_requirement, this.current_result, is_locked, update_details);

        if (this.current_result?.needsReview === true) {
            this.NotificationComponent.show_global_message(t('requirement_updated_needs_review'), 'info');
        } else {
            this.NotificationComponent.clear_global_message();
        }

        await this.render_right_sidebar();
        this.render_navigation_from_sidebar();
        this.checklist_handler_instance?._reapply_pending_status_button_focus?.();
    }

    handle_checklist_status_change(change_info) {
        this.autosave_session?.cancel_pending?.();

        let modified_result;
        try {
            modified_result = JSON.parse(JSON.stringify(this.current_result));
        } catch (error) {
            if (window.ConsoleManager) window.ConsoleManager.warn('[RequirementAuditComponent] Failed to clone current result for status change:', error);
            return;
        }
        const check_result = modified_result.checkResults[change_info.checkId];
        const check_definition = this.current_requirement.checks.find(c => c.id === change_info.checkId);
        const current_time = this.Helpers.get_current_iso_datetime_utc();

        const current_user = get_current_user_name();
        if (change_info.type === 'check_overall_status_change') {
            check_result.overallStatus = check_result.overallStatus === change_info.newStatus ? 'not_audited' : change_info.newStatus;
            check_result.timestamp = current_time;
            check_result.updatedBy = current_user;
        } else if (change_info.type === 'pc_status_change') {
            if (check_result.overallStatus !== 'passed') {
                this.NotificationComponent.show_global_message(this.Translation.t('error_set_check_status_first'), 'warning');
                return;
            }
            const pc_result = check_result.passCriteria[change_info.pcId];
            pc_result.status = pc_result.status === change_info.newStatus ? 'not_audited' : change_info.newStatus;
            pc_result.timestamp = current_time;
            pc_result.updatedBy = current_user;
            
            if (pc_result.status === 'failed' && (!pc_result.observationDetail || pc_result.observationDetail.trim() === '')) {
                const pc_def = check_definition.passCriteria.find(pc => pc.id === change_info.pcId);
                if (pc_def?.failureStatementTemplate) {
                    pc_result.observationDetail = pc_def.failureStatementTemplate;
                }
            }
        }
        
        delete modified_result.needsReview;
        this.dispatch_result_update(modified_result);
    }

    handle_comment_input(should_trim = false) {
        if (!this.current_result) return;
        const trim_fn = this.Helpers?.trim_textarea_preserve_lines;
        if (this.comment_to_auditor_input) {
            const val = this.comment_to_auditor_input.value || '';
            this.current_result.commentToAuditor = should_trim && trim_fn ? trim_fn(val) : val;
        }
        if (this.comment_to_actor_input) {
            const val = this.comment_to_actor_input.value || '';
            this.current_result.commentToActor = should_trim && trim_fn ? trim_fn(val) : val;
        }
    }

    handle_comment_input_with_autosave() {
        this.handle_comment_input();
        this.autosave_session?.request_autosave?.();
    }

    handle_sidebar_filters_change(payload) {
        this.sidebar_navigation_state = payload;
        this.render_navigation_from_sidebar();
    }

    render_navigation_from_sidebar() {
        if (!this.top_navigation_instance || !this.bottom_navigation_instance) return;
        const nav_options = this.build_navigation_options();
        this.top_navigation_instance.render(nav_options);
        this.bottom_navigation_instance.render(nav_options);
    }

    build_navigation_options() {
        const t = this.Translation.t;
        const state = this.getState();
        const is_locked = state?.auditStatus === 'locked' || state?.auditStatus === 'archived';
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
            current_requirement_id: this.requirement_public_key || this.params.requirementId,
            previous_aria_label: build_aria_label(t(previous_key), prev_item),
            next_aria_label: build_aria_label(t(next_key), next_item),
            next_unhandled_aria_label: build_aria_label(t(next_unhandled_key), next_unhandled_item),
            next_unhandled_available: Boolean(next_unhandled_item),
            previous_text_key: previous_key,
            next_text_key: next_key,
            next_unhandled_text_key: next_unhandled_key
        };
    }

    get_navigation_state() {
        const mode = this.sidebar_navigation_state?.mode || 'sample_requirements';
        let items = [];

        if (mode === 'requirement_samples') {
            items = this.sidebar_navigation_state?.sample_items || [];
        } else {
            items = this.sidebar_navigation_state?.requirement_items || [];
        }

        // När filtrerad lista har 0 eller 1 post: använd fullständig lista för navigering så att
        // Föregående/Nästa/Nästa ohanterade alltid fungerar och tar användaren rätt.
        if (items.length <= 1) {
            if (mode === 'requirement_samples') {
                items = this.get_fallback_sample_items();
            } else {
                items = this.get_fallback_requirement_items();
            }
        }

        const current_key = mode === 'requirement_samples'
            ? String(this.params.sampleId)
            : String(this.requirement_map_key || this.params.requirementId);
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
    }

    get_fallback_requirement_items() {
        const state = this.getState();
        const rule_file_content = state?.ruleFileContent;
        if (!rule_file_content || !this.current_sample) return [];
        const ordered_keys = this.AuditLogic.get_ordered_relevant_requirement_keys(
            rule_file_content,
            this.current_sample,
            'default'
        );
        let items = (ordered_keys || []).map(req_key => {
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

        const sort_by = state?.uiSettings?.requirementAuditSidebar?.filtersByMode?.sample_requirements?.sortBy;
        if (sort_by && this.right_sidebar_component_instance?.sort_requirement_items) {
            items = this.right_sidebar_component_instance.sort_requirement_items(items, sort_by);
        }
        return items;
    }

    get_fallback_sample_items() {
        const state = this.getState();
        const rule_file_content = state?.ruleFileContent;
        const samples = state?.samples || [];
        if (!rule_file_content || !this.current_requirement) return [];
        const requirement_key = this.current_requirement?.key || this.params.requirementId;
        const sample_index_map = new Map();
        samples.forEach((s, idx) => { if (s?.id) sample_index_map.set(s.id, idx); });
        const matching = samples.filter(sample => {
            const relevant_requirements = this.AuditLogic.get_relevant_requirements_for_sample(rule_file_content, sample);
            return (relevant_requirements || []).some(req => String(req?.key || req?.id) === String(requirement_key));
        });
        let items = matching.map(sample => {
            const req_result = sample?.requirementResults?.[requirement_key];
            const display_status = req_result?.needsReview ? 'updated' : this.AuditLogic.calculate_requirement_status(this.current_requirement, req_result);
            return {
                sample,
                display_status,
                link_text: sample?.description || this.Translation.t('undefined_description'),
                original_index: sample_index_map.get(sample?.id) ?? Infinity
            };
        });

        const sort_by = state?.uiSettings?.requirementAuditSidebar?.filtersByMode?.requirement_samples?.sortBy;
        if (sort_by && this.right_sidebar_component_instance?.sort_sample_items) {
            items = this.right_sidebar_component_instance.sort_sample_items(
                items,
                sort_by,
                this.current_requirement,
                rule_file_content
            );
        } else {
            items.sort((a, b) => (a.sample?.description || '').localeCompare(b.sample?.description || '', 'sv', { numeric: true, sensitivity: 'base' }));
        }
        return items;
    }

    /**
     * Fallback när kravet har needsReview men requirementUpdateDetails saknas (t.ex. sparad state från före uppdatering).
     * Markerar kontroller/kriterier med UUID-liknande eller "new-check-"/"new-pc-" id som tillagda.
     */
    _build_fallback_update_details(requirement) {
        const addedChecks = [];
        const added = [];
        const checks = requirement?.checks || [];
        for (const check of checks) {
            const check_id = check?.id ?? check?.key;
            if (!check_id) continue;
            const id_str = String(check_id);
            const looks_new = id_str.startsWith('new-check-') || (id_str.length > 20 && /[0-9a-f-]{20,}/i.test(id_str));
            if (looks_new) {
                addedChecks.push(check_id);
                (check.passCriteria || []).forEach(pc => {
                    const pc_id = pc?.id ?? pc?.key;
                    if (pc_id) {
                        added.push({ checkId: check_id, passCriterionId: pc_id, text: pc.requirement || '' });
                    }
                });
            } else {
                (check.passCriteria || []).forEach(pc => {
                    const pc_id = pc?.id ?? pc?.key;
                    if (!pc_id) return;
                    const pc_str = String(pc_id);
                    const pc_looks_new = pc_str.startsWith('new-pc-') || (pc_str.length > 20 && /[0-9a-f-]{20,}/i.test(pc_str));
                    if (pc_looks_new) {
                        added.push({ checkId: check_id, passCriterionId: pc_id, text: pc.requirement || '' });
                    }
                });
            }
        }
        return addedChecks.length > 0 || added.length > 0 ? { addedChecks, added, updated: [] } : null;
    }

    /**
     * Kravresultat → store (skip_render / sidomeny):
     * - `save_requirement_result_spar_bakgrund` / autospar: skip_render true (ingen global omritning).
     * - `handle_checklist_status_change`: skip_render false så sidomeny/räknare uppdateras; vy patchas via subscribe.
     * - `onStuckDescriptionSaved`: skip_render false avsiktligt (full synk av UI).
     * - `_patch_audit_part_to_server` / poll: REPLACE_STATE_FROM_REMOTE utan skip_render; särskild hantering vid fokus i plåt.
     * - `handle_navigation` confirm_reviewed: dispatch utan skip_render efter timeout.
     */
    dispatch_result_update(modified_result_object, options = {}) {
        (this.current_requirement.checks || []).forEach(check_def => {
            const check_res = modified_result_object.checkResults[check_def.id];
            check_res.status = this.AuditLogic.calculate_check_status(check_def, check_res.passCriteria, check_res.overallStatus);
        });
        modified_result_object.status = this.AuditLogic.calculate_requirement_status(this.current_requirement, modified_result_object);

        const state_for_compare = this.getState();
        const sample_row = state_for_compare?.samples?.find(s => String(s.id) === String(this.params.sampleId));
        const previous_from_store = sample_row?.requirementResults?.[this.requirement_map_key];
        if (previous_from_store
            && typeof this.AuditLogic.requirement_results_equal_for_last_updated === 'function'
            && this.AuditLogic.requirement_results_equal_for_last_updated(previous_from_store, modified_result_object)) {
            return Promise.resolve();
        }

        if (options.skipLastStatusBump === true && previous_from_store) {
            modified_result_object.lastStatusUpdate = previous_from_store.lastStatusUpdate ?? null;
            modified_result_object.lastStatusUpdateBy = previous_from_store.lastStatusUpdateBy ?? null;
        } else {
            modified_result_object.lastStatusUpdate = this.Helpers.get_current_iso_datetime_utc();
            modified_result_object.lastStatusUpdateBy = get_current_user_name();
        }

        return this.dispatch({
            type: this.StoreActionTypes.UPDATE_REQUIREMENT_RESULT,
            payload: {
                sampleId: this.params.sampleId,
                requirementId: this.requirement_map_key,
                newRequirementResult: modified_result_object,
                skip_render: options.skipRender === true
            }
        });
    }

    /**
     * Sparar aktuellt kravresultat med skip_render så global prenumeration inte kör full vyomritning.
     * Använd när DOM redan har det värde som ska sparas (autospar, observation direkt).
     * @param {{ skipLastStatusBump?: boolean }} [opts]
     * @returns {Promise<unknown>}
     */
    save_requirement_result_spar_bakgrund(opts = {}) {
        if (!this.current_result) return Promise.resolve();
        return this.dispatch_result_update(this.current_result, {
            skipRender: true,
            skipLastStatusBump: opts.skipLastStatusBump === true
        });
    }

    save_result_immediately({ skipRender = false, skipLastStatusBump = false } = {}) {
        if (!this.current_result) return Promise.resolve();
        return this.dispatch_result_update(this.current_result, { skipRender, skipLastStatusBump });
    }

    get_observations_from_other_samples(check_id, pc_id) {
        const state = this.getState();
        const samples = state?.samples || [];
        const rule_file_content = state?.ruleFileContent;
        const requirement_id = this.requirement_map_key || this.params?.requirementId;
        const current_sample_id = this.params?.sampleId;
        if (!requirement_id || !current_sample_id || !rule_file_content || !this.AuditLogic?.get_relevant_requirements_for_sample) {
            return [];
        }
        const requirement_key = this.current_requirement?.key || requirement_id;
        const seen = new Set();
        const result = [];
        for (const sample of samples) {
            if (String(sample?.id) === String(current_sample_id)) continue;
            const relevant = this.AuditLogic.get_relevant_requirements_for_sample(rule_file_content, sample);
            const has_requirement = (relevant || []).some(req => String(req?.key || req?.id) === String(requirement_key));
            if (!has_requirement) continue;
            const req_result = sample?.requirementResults?.[requirement_key] || sample?.requirementResults?.[requirement_id];
            const pc_data = req_result?.checkResults?.[check_id]?.passCriteria?.[pc_id];
            if (pc_data?.status !== 'failed') continue;
            const obs = pc_data?.observationDetail;
            const text = typeof obs === 'string' ? obs.trim() : '';
            if (text && !seen.has(text)) {
                seen.add(text);
                result.push(text);
            }
        }
        return result;
    }

    handle_navigation(action) {
        this.autosave_session?.cancel_pending?.();
        this.autosave_session?.flush?.({ should_trim: true, skip_render: true });
        this.checklist_handler_instance?.flush_observations_before_destroy?.();

        const navigation_state = this.get_navigation_state();
        const mode = navigation_state.mode;
        const { prev_item, next_item, next_unhandled_item } = navigation_state;

        const navigate_to_item = (item) => {
            if (!item) return;
            if (mode === 'requirement_samples') {
                this.router('requirement_audit', {
                    sampleId: item.sample.id,
                    requirementId: this.requirement_public_key || this.params.requirementId
                });
            } else {
                const requirements = this.getState()?.ruleFileContent?.requirements;
                const public_key = get_requirement_public_key(requirements, item.req_key) || String(item.req_key);
                this.router('requirement_audit', { sampleId: this.params.sampleId, requirementId: public_key });
            }
        };

        switch (action) {
            case 'back_to_list':
                try {
                    window.sessionStorage?.setItem('gv_return_focus_all_requirements_v1', JSON.stringify({
                        sampleId: this.params.sampleId,
                        requirementId: this.requirement_public_key || this.params.requirementId,
                        createdAt: Date.now()
                    }));
                } catch (_) {
                    // ignoreras medvetet
                }
                this.router('all_requirements');
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
            case 'confirm_reviewed_status': {
                const back_btn = this.plate_element_ref?.querySelector('button[data-action="back-to-list"]');
                if (back_btn) back_btn.focus();
                const confirm_btn = this.plate_element_ref?.querySelector('button[data-action="confirm-reviewed-status"]');
                if (confirm_btn) confirm_btn.classList.add('confirm-btn-fade-out');
                let result;
                try {
                    result = JSON.parse(JSON.stringify(this.current_result));
                } catch (error) {
                    if (window.ConsoleManager) window.ConsoleManager.warn('[RequirementAuditComponent] Failed to clone current result for confirm status:', error);
                    return;
                }
                delete result.needsReview;
                setTimeout(() => {
                    this.dispatch_result_update(result);
                }, 250);
                break;
            }
        }
    }

    handle_audit_keydown(event) {
        if (!event.shiftKey || !event.altKey) return;

        const active = document.activeElement;
        const tag = active?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || active?.getAttribute?.('contenteditable') === 'true') {
            return;
        }

        const t = this.Translation.t;
        const key_lower = (event.key || '').toLowerCase();
        const shortcut_key = (k) => ((t(k) || k).toString().charAt(0) || '').toLowerCase();

        const nav = this.get_navigation_state();
        const state = this.getState();
        const is_locked = state?.auditStatus === 'locked' || state?.auditStatus === 'archived';

        let action = null;
        if (key_lower === shortcut_key('shortcut_key_back_to_list')) {
            action = 'back_to_list';
        } else if (!is_locked) {
            if (key_lower === shortcut_key('shortcut_key_previous') && !nav.is_first) {
                action = 'previous';
            } else if (key_lower === shortcut_key('shortcut_key_next') && !nav.is_last) {
                action = 'next';
            } else if (key_lower === shortcut_key('shortcut_key_next_unhandled') && nav.next_unhandled_item) {
                action = 'next_unhandled';
            }
        }

        if (action) {
            event.preventDefault();
            this.handle_navigation(action);
        }
    }

    build_initial_dom() {
        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate requirement-audit-plate' });

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
                onObservationChange: () => this.autosave_session?.request_autosave?.(),
                onObservationChangeImmediate: () => { void this.save_requirement_result_spar_bakgrund(); },
                onObservationBlurCommit: () => { void this.save_requirement_result_spar_bakgrund(); },
                onBeforeReleaseObservationLock: () => {
                    this.autosave_session?.flush?.({ should_trim: false, skip_render: true });
                },
                onStuckDescriptionSaved: async () => {
                    if (window.__GV_DEBUG_STUCK_SYNC__) {
                        consoleManager.log('[GV-Debug] onStuckDescriptionSaved: sparar, anropar save_result_immediately + flush_sync_to_server');
                    }
                    this.save_result_immediately({ skipRender: false });
                    if (typeof this.flush_sync_to_server === 'function' && this.getState && this.dispatch) {
                        try {
                            await this.flush_sync_to_server(this.getState, this.dispatch);
                            if (window.__GV_DEBUG_STUCK_SYNC__) {
                                consoleManager.log('[GV-Debug] onStuckDescriptionSaved: flush_sync_to_server klar');
                            }
                        } catch (e) {
                            if (window.__GV_DEBUG_STUCK_SYNC__) {
                                console.warn('[GV-Debug] onStuckDescriptionSaved: flush_sync_to_server fel', e);
                            }
                            if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[RequirementAuditComponent] flush_sync_to_server efter kört fast:', e);
                        }
                    } else if (window.__GV_DEBUG_STUCK_SYNC__) {
                        console.warn('[GV-Debug] onStuckDescriptionSaved: flush_sync_to_server inte tillgänglig');
                    }
                }
            },
            {
                deps: this.deps,
                getObservationsFromOtherSamples: (check_id, pc_id) => this.get_observations_from_other_samples(check_id, pc_id),
                getAuditLockContext: () => {
                    const st = this.getState();
                    return {
                        audit_id: st?.auditId ? String(st.auditId) : null,
                        sample_id: this.params?.sampleId ? String(this.params.sampleId) : null,
                        requirement_id: this.params?.requirementId ? String(this.params.requirementId) : null
                    };
                },
                getDomFocusSyncRoot: () => this.plate_element_ref,
                getIsAuditFrozen: () => {
                    const st = this.getState();
                    return st?.auditStatus === 'locked' || st?.auditStatus === 'archived';
                },
                getIsAuditArchived: () => this.getState()?.auditStatus === 'archived'
            }
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
    }

    build_comment_fields() {
        const t = this.Translation.t;
        const container = this.Helpers.create_element('div', { class_name: 'input-fields-container audit-section' });
        container.appendChild(this.Helpers.create_element('h2', { text_content: t('observations_and_comments_title') }));
    
        const fg1 = this.Helpers.create_element('div', { class_name: 'form-group' });
        const label1 = this.Helpers.create_element('label', { attributes: { for: 'commentToAuditor' }, text_content: t('comment_to_auditor') });
        fg1.appendChild(label1);
        const hint_auditor = this.Helpers.create_element('p', {
            class_name: 'gv-audit-part-lock-hint text-muted',
            attributes: { id: 'commentToAuditor-lock-hint', hidden: 'hidden' },
            text_content: ''
        });
        fg1.appendChild(hint_auditor);
        this.comment_to_auditor_input = this.Helpers.create_element('textarea', {
            id: 'commentToAuditor',
            class_name: 'form-control',
            attributes: { rows: '4', 'aria-describedby': 'commentToAuditor-lock-hint' }
        });
        this.comment_to_auditor_input.addEventListener('input', this.handle_comment_input_with_autosave);
        fg1.appendChild(this.comment_to_auditor_input);

        const fg2 = this.Helpers.create_element('div', { class_name: 'form-group' });
        const label2 = this.Helpers.create_element('label', { attributes: { for: 'commentToActor' }, text_content: t('comment_to_actor') });
        fg2.appendChild(label2);
        const hint_actor = this.Helpers.create_element('p', {
            class_name: 'gv-audit-part-lock-hint text-muted',
            attributes: { id: 'commentToActor-lock-hint', hidden: 'hidden' },
            text_content: ''
        });
        fg2.appendChild(hint_actor);
        this.comment_to_actor_input = this.Helpers.create_element('textarea', {
            id: 'commentToActor',
            class_name: 'form-control',
            attributes: { rows: '4', 'aria-describedby': 'commentToActor-lock-hint' }
        });
        this.comment_to_actor_input.addEventListener('input', this.handle_comment_input_with_autosave);
        fg2.appendChild(this.comment_to_actor_input);
        
        container.append(fg1, fg2);
        return container;
    }

    populate_dom_with_data() {
        const t = this.Translation.t;
        const state = this.getState();
        const is_locked = state.auditStatus === 'locked' || state.auditStatus === 'archived';
        const audit_id = state?.auditId;
        const sample_id = this.params?.sampleId;
        const requirement_id = this.params?.requirementId;

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
        const update_details = this._get_checklist_update_details(state);
        this.checklist_handler_instance.render(this.current_requirement, this.current_result, is_locked, update_details);

        const comments_section = this.plate_element_ref.querySelector('.input-fields-container.audit-section');
        if (comments_section) {
            const comments_h2 = comments_section.querySelector('h2');
            if (comments_h2) comments_h2.textContent = t('observations_and_comments_title');
            const label1 = comments_section.querySelector('label[for="commentToAuditor"]');
            if (label1) label1.textContent = t('comment_to_auditor');
            const label2 = comments_section.querySelector('label[for="commentToActor"]');
            if (label2) label2.textContent = t('comment_to_actor');
        }
        
        this._apply_comment_part_lock_ui();
        this._attach_comment_field_lock_listeners_once();

        [this.comment_to_auditor_input, this.comment_to_actor_input].forEach(input => {
            if (!input) return;
            if (this.Helpers?.init_auto_resize_for_textarea) {
                this.Helpers.init_auto_resize_for_textarea(input);
            }
        });

        if (this.current_result?.needsReview === true) {
            this.NotificationComponent.show_global_message(t('requirement_updated_needs_review'), 'info');
        } else {
            this.NotificationComponent.clear_global_message();
        }
    }

    /**
     * Uppdaterar kommentarsfält: värden, disabled vid annan användares lås, samt fokus-/blur-lyssnare (en gång).
     * readOnly används endast när granskningen är arkiverad; övriga lägen utan readOnly (fältlås hanteras senare).
     */
    _apply_comment_part_lock_ui() {
        const state = this.getState();
        const exempt_from_remote_disable = state.auditStatus === 'locked' || state.auditStatus === 'archived';
        const comments_readonly = state.auditStatus === 'archived';
        const audit_id = state?.auditId;
        const sample_id = this.params?.sampleId;
        const requirement_id = this.params?.requirementId;

        const target_auditor_value = this.current_result.commentToAuditor || '';
        const target_actor_value = this.current_result.commentToActor || '';

        const part_key_auditor = (audit_id && sample_id && requirement_id)
            ? make_requirement_text_part_key(String(audit_id), String(sample_id), String(requirement_id), 'commentToAuditor')
            : null;
        const part_key_actor = (audit_id && sample_id && requirement_id)
            ? make_requirement_text_part_key(String(audit_id), String(sample_id), String(requirement_id), 'commentToActor')
            : null;

        const lock_auditor = part_key_auditor ? get_current_audit_remote_lock(part_key_auditor) : null;
        const lock_actor = part_key_actor ? get_current_audit_remote_lock(part_key_actor) : null;

        const my_client_lock_id_auditor = part_key_auditor ? ensure_client_lock_id_for_part(part_key_auditor) : null;
        const my_client_lock_id_actor = part_key_actor ? ensure_client_lock_id_for_part(part_key_actor) : null;

        const me = get_current_user_name();
        const locked_auditor_by_other = is_remote_lock_held_by_other_user(lock_auditor, me, my_client_lock_id_auditor);
        const locked_actor_by_other = is_remote_lock_held_by_other_user(lock_actor, me, my_client_lock_id_actor);

        if (this.comment_to_auditor_input) {
            if (part_key_auditor) {
                this.comment_to_auditor_input.dataset.gvAuditPartKey = part_key_auditor;
            }
            if (document.activeElement !== this.comment_to_auditor_input &&
                this.comment_to_auditor_input.value !== target_auditor_value) {
                this.comment_to_auditor_input.value = target_auditor_value;
            }
        }
        if (this.comment_to_actor_input) {
            if (part_key_actor) {
                this.comment_to_actor_input.dataset.gvAuditPartKey = part_key_actor;
            }
            if (document.activeElement !== this.comment_to_actor_input &&
                this.comment_to_actor_input.value !== target_actor_value) {
                this.comment_to_actor_input.value = target_actor_value;
            }
        }

        const hint_auditor_el = this.plate_element_ref?.querySelector('#commentToAuditor-lock-hint');
        const hint_actor_el = this.plate_element_ref?.querySelector('#commentToActor-lock-hint');
        if (this.comment_to_auditor_input) {
            this.comment_to_auditor_input.disabled = locked_auditor_by_other && !exempt_from_remote_disable;
            if (hint_auditor_el) {
                if (locked_auditor_by_other && lock_auditor?.user_name) {
                    hint_auditor_el.textContent = `${lock_auditor.user_name} redigerar detta fält just nu.`;
                    hint_auditor_el.hidden = false;
                } else {
                    hint_auditor_el.textContent = '';
                    hint_auditor_el.hidden = true;
                }
            }
        }
        if (this.comment_to_actor_input) {
            this.comment_to_actor_input.disabled = locked_actor_by_other && !exempt_from_remote_disable;
            if (hint_actor_el) {
                if (locked_actor_by_other && lock_actor?.user_name) {
                    hint_actor_el.textContent = `${lock_actor.user_name} redigerar detta fält just nu.`;
                    hint_actor_el.hidden = false;
                } else {
                    hint_actor_el.textContent = '';
                    hint_actor_el.hidden = true;
                }
            }
        }

        [this.comment_to_auditor_input, this.comment_to_actor_input].forEach((input) => {
            if (!input) return;
            if (input.disabled) {
                input.readOnly = false;
            } else {
                input.readOnly = comments_readonly;
            }
            input.classList.toggle('readonly-textarea', comments_readonly && !input.disabled);
        });
    }

    /**
     * Kopplar lås vid fokus/blur en gång per kommentarsfält (anropas från populate_dom_with_data).
     */
    _attach_comment_field_lock_listeners_once() {
        const state = this.getState();
        const audit_id = state?.auditId;
        const sample_id = this.params?.sampleId;
        const requirement_id = this.params?.requirementId;
        const part_key_auditor = (audit_id && sample_id && requirement_id)
            ? make_requirement_text_part_key(String(audit_id), String(sample_id), String(requirement_id), 'commentToAuditor')
            : null;
        const part_key_actor = (audit_id && sample_id && requirement_id)
            ? make_requirement_text_part_key(String(audit_id), String(sample_id), String(requirement_id), 'commentToActor')
            : null;

        const attach_comment_lock_listeners = ({ textarea, part_key }) => {
            if (!textarea || !part_key) return;
            if (textarea.dataset.gvCommentLockListeners === '1') return;
            textarea.dataset.gvCommentLockListeners = '1';
            textarea.addEventListener('focus', async () => {
                const st = this.getState();
                const aid = st?.auditId;
                if (!aid) return;
                if (st.auditStatus === 'archived') return;
                textarea.dataset.gvLockPending = '1';
                this._apply_comment_part_lock_ui();
                try {
                    const r = await try_acquire_audit_part_lock({ audit_id: aid, part_key });
                    await init_audit_lock_service(String(aid));
                    if (r?.ok) {
                        if (document.activeElement !== textarea) {
                            await release_audit_part_lock({ audit_id: aid, part_key });
                            await init_audit_lock_service(String(aid));
                            delete textarea.dataset.gvLockPending;
                            this._apply_audit_remote_lock_states_after_refresh();
                            return;
                        }
                        delete textarea.dataset.gvLockPending;
                        textarea.dataset.gvLockAcquired = '1';
                        this._apply_audit_remote_lock_states_after_refresh();
                    } else {
                        delete textarea.dataset.gvLockPending;
                        this._apply_audit_remote_lock_states_after_refresh();
                    }
                } finally {
                    delete textarea.dataset.gvLockPending;
                }
            });
            textarea.addEventListener('blur', () => {
                void (async () => {
                    const had_lock = textarea.dataset.gvLockAcquired === '1';
                    delete textarea.dataset.gvLockAcquired;
                    this.autosave_session?.flush?.({ should_trim: false, skip_render: true });
                    const st = this.getState();
                    const aid = st?.auditId;
                    if (!aid) return;
                    const v = textarea.value ?? '';
                    if (had_lock) {
                        await release_audit_part_lock({ audit_id: aid, part_key });
                        post_same_user_field_commit({
                            userName: get_current_user_name(),
                            auditId: aid,
                            partKey: part_key,
                            value: v
                        });
                    }
                    this._apply_comment_part_lock_ui();
                })();
            });
        };

        attach_comment_lock_listeners({ textarea: this.comment_to_auditor_input, part_key: part_key_auditor });
        attach_comment_lock_listeners({ textarea: this.comment_to_actor_input, part_key: part_key_actor });
    }

    /**
     * Efter refresh av låslista: uppdatera disabled/hint på kommentarer och checklista utan full render.
     */
    _apply_audit_remote_lock_states_after_refresh() {
        this._apply_comment_part_lock_ui();
        this.checklist_handler_instance?.update_dom?.();
    }

    /**
     * Hämtar om lås från servern och uppdaterar UI (t.ex. efter REPLACE_STATE_FROM_REMOTE medan fokus ligger i fält).
     */
    async _refresh_audit_lock_ui_after_remote_state() {
        const aid = this.getState()?.auditId;
        if (!aid) return;
        try {
            await init_audit_lock_service(String(aid));
            this._apply_audit_remote_lock_states_after_refresh();
        } catch (_) {
            /* ignoreras */
        }
    }

    _stop_audit_lock_poll() {
        if (this._audit_lock_poll_timer) {
            clearInterval(this._audit_lock_poll_timer);
            this._audit_lock_poll_timer = null;
        }
        if (typeof this._audit_lock_visibility_handler === 'function' && typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this._audit_lock_visibility_handler);
            this._audit_lock_visibility_handler = null;
        }
    }

    /**
     * Pollning säkerställer att lås uppdateras även utan fungerande WebSocket eller vid missad push.
     */
    _start_audit_lock_poll(aid) {
        this._stop_audit_lock_poll();
        const aid_str = String(aid);
        const tick = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            if (String(this.getState()?.auditId || '') !== aid_str) return;
            void (async () => {
                try {
                    await init_audit_lock_service(aid_str);
                    this._apply_audit_remote_lock_states_after_refresh();
                } catch (_) {
                    /* ignoreras */
                }
            })();
        };
        this._audit_lock_visibility_handler = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') tick();
        };
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this._audit_lock_visibility_handler);
        }
        this._audit_lock_poll_timer = setInterval(tick, AUDIT_LOCK_POLL_MS);
    }

    create_header_paragraph(className, label, data, isSampleLink = false) {
        const p = this.Helpers.create_element('p', { class_name: className });
        p.appendChild(this.Helpers.create_element('strong', { text_content: `${label} ` }));
        
        if (isSampleLink) {
            const context_text = `${this.getState().auditMetadata?.actorName || ''}: ${this.current_sample.description}`;
            if (this.current_sample.url) {
                const t = this.Translation?.t || (k => (k === 'opens_in_new_tab' ? '(Öppnas i ny flik)' : k));
                const icon_html = this.Helpers.get_external_link_icon_html ? this.Helpers.get_external_link_icon_html(t) : ' ↗';
                p.appendChild(this.Helpers.create_element('a', {
                    html_content: (this.Helpers.escape_html ? this.Helpers.escape_html(context_text) : context_text) + icon_html,
                    attributes: { href: this.Helpers.add_protocol_if_missing(this.current_sample.url), target: '_blank', rel: 'noopener noreferrer' }
                }));
            } else {
                p.appendChild(document.createTextNode(context_text));
            }
        } else if (className === 'overall-requirement-status-display') {
            const status_key = this.current_requirement && this.current_result
                ? this.AuditLogic.calculate_requirement_status(this.current_requirement, this.current_result)
                : 'not_audited';
            const status_text = this.Translation.t(`audit_status_${status_key}`);
            const span = this.Helpers.create_element('span', {
                class_name: `status-text status-${status_key}`,
                text_content: status_text
            });
            p.appendChild(span);
        } else if (data?.text) {
            if (data.url) {
                const t = this.Translation?.t || (k => (k === 'opens_in_new_tab' ? '(Öppnas i ny flik)' : k));
                const icon_html = this.Helpers.get_external_link_icon_html ? this.Helpers.get_external_link_icon_html(t) : ' ↗';
                p.appendChild(this.Helpers.create_element('a', {
                    html_content: (this.Helpers.escape_html ? this.Helpers.escape_html(data.text) : data.text) + icon_html,
                    attributes: { href: this.Helpers.add_protocol_if_missing(data.url), target: '_blank', rel: 'noopener noreferrer' }
                }));
            } else {
                p.appendChild(document.createTextNode(data.text));
            }
        }
        return p;
    }

    async render() {
        if (typeof window !== 'undefined' && window.__GV_DEBUG_AUTOSAVE_FOCUS && this.plate_element_ref) {
            const ae = document.activeElement;
            const tag = ae?.tagName?.toLowerCase();
            if (ae && this.plate_element_ref.contains(ae) && (tag === 'textarea' || tag === 'input')) {
                consoleManager.log('[GV-Debug autospar-fokus] RequirementAuditComponent.render med fokus i plåt', {
                    tag,
                    id: ae.id || null,
                    className: ae.className || null
                });
            }
        }

        if (!this.load_and_prepare_view_data()) {
            this.NotificationComponent.show_global_message(this.Translation.t('error_loading_sample_or_requirement_data'), "error");
            this.router('audit_overview');
            return;
        }

        const baseline_key = `${String(this.params?.sampleId ?? '')}|${String(this.requirement_map_key ?? this.params?.requirementId ?? '')}`;
        if (baseline_key !== this._baseline_key) {
            this._baseline_key = baseline_key;
            establish_baseline_for_current_audit_focus(this.getState());
        }

        const state_for_locks = this.getState();
        this._stop_audit_lock_poll();
        if (state_for_locks?.auditId) {
            void init_audit_lock_service(String(state_for_locks.auditId));
            this._start_audit_lock_poll(state_for_locks.auditId);
            if (!this._unsubscribe_audit_locks) {
                this._unsubscribe_audit_locks = subscribe_audit_locks((payload) => {
                    void (async () => {
                        try {
                            const aid = String(this.getState()?.auditId || '');
                            if (!aid) return;
                            if (payload?.auditId != null && String(payload.auditId) !== aid) return;
                            await init_audit_lock_service(aid);
                            this._apply_audit_remote_lock_states_after_refresh();
                        } catch (_) {
                            /* ignoreras */
                        }
                    })();
                });
            }
        }

        const plate_exists = this.plate_element_ref && this.root.contains(this.plate_element_ref);
        if (!plate_exists) {
            this.build_initial_dom();
            this.autosave_session?.destroy?.();
            this.autosave_session = null;
            if (this.plate_element_ref && this.AutosaveService?.create_session) {
                this.autosave_session = this.AutosaveService.create_session({
                    form_element: this.plate_element_ref,
                    focus_root: this.plate_element_ref,
                    debounce_ms: 250,
                    on_save: ({ is_autosave, should_trim, skip_render }) => {
                        this.handle_comment_input(should_trim);
                        this.checklist_handler_instance?.flush_observations_before_destroy?.({ trim: should_trim });
                        const skip_last_bump = is_autosave === true
                            && typeof this.checklist_handler_instance?.has_active_pc_observation_focus === 'function'
                            && this.checklist_handler_instance.has_active_pc_observation_focus();
                        if (skip_render) {
                            void this.save_requirement_result_spar_bakgrund({ skipLastStatusBump: skip_last_bump });
                        } else {
                            void this.save_result_immediately({
                                skipRender: false,
                                skipLastStatusBump: skip_last_bump
                            });
                        }

                        // Del-spara: om fokus ligger i kommentar-fält, spara just det fältet.
                        try {
                            const st = this.getState();
                            const audit_id = st?.auditId;
                            if (audit_id && document?.activeElement?.id && this.params?.sampleId && (this.requirement_map_key || this.params?.requirementId)) {
                                const ae = document.activeElement;
                                const id = String(ae.id || '');
                                if (id === 'commentToAuditor' || id === 'commentToActor') {
                                    const field = id === 'commentToAuditor' ? 'commentToAuditor' : 'commentToActor';
                                    const part_key = make_requirement_text_part_key(
                                        String(audit_id),
                                        String(this.params.sampleId),
                                        String(this.requirement_map_key || this.params.requirementId),
                                        field
                                    );
                                    void this._patch_audit_part_to_server({ part_key, value: ae.value || '' });
                                } else if (ae.classList?.contains('pc-observation-detail-textarea') && id.startsWith('pc-observation-')) {
                                    // id: pc-observation-{checkId}-{pcId}
                                    const rest = id.slice('pc-observation-'.length);
                                    const first_dash = rest.indexOf('-');
                                    if (first_dash > 0) {
                                        const check_id = rest.slice(0, first_dash);
                                        const pc_id = rest.slice(first_dash + 1);
                                        if (check_id && pc_id) {
                                            const part_key = make_observation_detail_part_key(
                                                String(audit_id),
                                                String(this.params.sampleId),
                                                String(this.requirement_map_key || this.params.requirementId),
                                                check_id,
                                                pc_id
                                            );
                                            void this._patch_audit_part_to_server({ part_key, value: ae.value || '' });
                                        }
                                    }
                                }
                            }
                        } catch (_) {
                            // ignoreras
                        }
                    }
                });
            }
        }

        this.populate_dom_with_data();
        await this.render_right_sidebar();
        this.render_navigation_from_sidebar();
        this.checklist_handler_instance?._reapply_pending_status_button_focus?.();
    }

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
    }

    destroy() {
        this._stop_audit_lock_poll();
        if (typeof this.unsubscribe_from_store === 'function') {
            this.unsubscribe_from_store();
            this.unsubscribe_from_store = null;
        }
        document.removeEventListener('keydown', this.handle_audit_keydown);
        document.removeEventListener('gv-audit-locks-refresh', this._on_gv_audit_locks_refresh);
        this.checklist_handler_instance?.flush_observations_before_destroy?.();
        if (this.autosave_session) {
            this.autosave_session.flush({ should_trim: true, skip_render: true });
            this.autosave_session.destroy();
            this.autosave_session = null;
        } else if (this.current_result) {
            this.handle_comment_input(true);
            void this.save_requirement_result_spar_bakgrund();
        }

        try {
            this._unsubscribe_audit_locks?.();
        } catch (_) {
            // ignoreras
        }
        this._unsubscribe_audit_locks = null;
        
        // Remove event listeners
        if (this.comment_to_auditor_input) {
            this.comment_to_auditor_input.removeEventListener('input', this.handle_comment_input_with_autosave);
            this.comment_to_auditor_input = null;
        }
        if (this.comment_to_actor_input) {
            this.comment_to_actor_input.removeEventListener('input', this.handle_comment_input_with_autosave);
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
}

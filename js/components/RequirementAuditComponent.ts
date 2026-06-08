// js/components/RequirementAuditComponent.ts
// @ts-nocheck

import { get_current_user_name } from '../utils/helpers.js';
import { ChecklistHandler } from './requirement_audit/ChecklistHandler.js';
import { RequirementInfoSections } from './requirement_audit/RequirementInfoSections.js';
import { RequirementAuditNavigationComponent } from './requirement_audit/RequirementAuditNavigation.js';
import { RequirementAuditSidebarComponent } from './RequirementAuditSidebarComponent.js';
import "./requirement_audit_component.css";
import { consoleManager } from '../utils/console_manager.js';
import { establish_baseline_for_current_audit_focus } from '../logic/audit_collaboration_notice.js';
import { find_requirement_definition, resolve_requirement_map_key, get_requirement_public_key } from '../audit_logic.js';
import {
    definition_primary_id,
    find_check_def_by_storage_id,
    find_pass_criterion_def_by_storage_id,
    resolve_map_entry
} from '../logic/entity_id_match.js';
import {
    is_debug_autosave_focus,
    is_debug_krav_vy,
    is_debug_modal_scroll,
    is_debug_stuck_sync
} from '../app/runtime_flags.js';
import { subscribe_audit_locks } from '../logic/list_push_service.js';
import {
    init_audit_lock_service,
    try_acquire_audit_part_lock,
    release_audit_part_lock,
    get_current_audit_remote_lock,
    ensure_client_lock_id_for_part,
    refresh_remote_locks
} from '../logic/audit_lock_service.js';
import { make_requirement_text_part_key, make_observation_detail_part_key } from '../logic/audit_part_keys.js';
import {
    is_remote_lock_held_by_other_user,
    is_lock_held_by_different_logged_in_user
} from '../logic/collab_lock_compare.js';
import { dispatch_persist_sync } from '../state/index.js';
import {
    register_unload_persist_hook,
    unregister_unload_persist_hook
} from '../logic/unload_persist_registry.js';
import {
    log_krav_vy_knapp,
    peek_krav_vy_sync_flow,
    register_krav_vy_knapp_sync,
    warn_krav_vy_sync_not_available,
    log_krav_vy_sync_fel,
    log_krav_vy_fokus_from_event,
    log_krav_vy_textarea,
    log_krav_vy_state_andring,
    log_krav_vy_render
} from './requirement_audit/krav_vy_knapp_debug_log.js';
import { debug_session_log } from './requirement_audit/debug_session_log.js';

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
        this._baseline_key = null;
        this._unsubscribe_audit_locks = null;
        this._on_audit_locks_visibility_refresh = null;
        /** Anropas efter skip_render-dispatch för att uppdatera sidtitel/vänstermeny (injiceras från main). */
        this.refresh_side_menu_and_title = null;
        /** Serialiserar snabba checklist-statusklick så varje dispatch utgår från senaste state. */
        this._status_change_queue_tail = Promise.resolve();
        /** Begränsar checklistuppdatering till en kontrollpunkt/kriterium efter statusklick. */
        this._checklist_patch_scope = null;
        /** Roter där fokus-debug lyssnar (plåt + högersidebar). */
        this._krav_vy_focus_debug_roots = [];
        /** Debounce-timer för autospar av observations- och kommentarsfält. */
        this._plate_text_autosave_timer = null;
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
        this.right_sidebar_root = deps.rightSidebarRoot || null;
        this.subscribe = deps.subscribe;
        this.flush_sync_to_server = deps.flush_sync_to_server || null;
        this.unsubscribe_from_store = null;
        this.refresh_side_menu_and_title =
            typeof deps.refreshSideMenuAndTitle === 'function' ? deps.refreshSideMenuAndTitle : null;

        // Bind methods
        this.handle_checklist_status_change = this.handle_checklist_status_change.bind(this);
        this.handle_navigation = this.handle_navigation.bind(this);
        this.handle_comment_input = this.handle_comment_input.bind(this);
        this.handle_comment_input_only = this.handle_comment_input_only.bind(this);
        this.handle_comment_blur_save = this.handle_comment_blur_save.bind(this);
        this.handle_comment_focusin = this.handle_comment_focusin.bind(this);
        this.handle_comment_focusout = this.handle_comment_focusout.bind(this);
        this.handle_krav_vy_focusin = this.handle_krav_vy_focusin.bind(this);
        this.handle_krav_vy_focusout = this.handle_krav_vy_focusout.bind(this);
        this._handle_unload_persist = this._handle_unload_persist.bind(this);
        register_unload_persist_hook('requirement_audit_plate', this._handle_unload_persist);
        this.handle_sidebar_filters_change = this.handle_sidebar_filters_change.bind(this);
        this.handle_audit_keydown = this.handle_audit_keydown.bind(this);
        
        this._on_audit_locks_visibility_refresh = (ev) => {
            const aid = ev.detail?.auditId;
            const current_audit_id = this.getState()?.auditId || this.params?.auditId || this.params?.id;
            if (!aid || String(aid) !== String(current_audit_id)) return;
            if (this.plate_element_ref) {
                this._sync_audit_part_lock_ui();
                const active = document.activeElement;
                const checklist_root = this.plate_element_ref.querySelector('.checks-container');
                const focus_on_checklist_button = Boolean(
                    active &&
                        checklist_root?.contains(active) &&
                        active.tagName?.toLowerCase() === 'button'
                );
                if (!focus_on_checklist_button) {
                    this.checklist_handler_instance?.update_dom?.();
                }
            }
        };
        window.addEventListener('gv-audit-locks-refresh', this._on_audit_locks_visibility_refresh);

        this._unsubscribe_audit_locks = subscribe_audit_locks((payload) => {
            const current_audit_id = this.getState()?.auditId || this.params?.auditId || this.params?.id;
            if (!payload || !payload.auditId || String(payload.auditId) === String(current_audit_id)) {
                if (current_audit_id) {
                    refresh_remote_locks(current_audit_id).then(() => {
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('gv-audit-locks-refresh', { detail: { auditId: current_audit_id } }));
                        }
                    });
                } else if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('gv-audit-locks-refresh', { detail: { auditId: payload?.auditId } }));
                }
            }
        });

        const initial_audit_id = this.getState()?.auditId || this.params?.auditId || this.params?.id;
        if (initial_audit_id) {
            init_audit_lock_service(initial_audit_id).then(() => {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('gv-audit-locks-refresh', { detail: { auditId: initial_audit_id } }));
                }
            });
        }
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
            this._bind_krav_vy_focus_debug_listeners(this.right_sidebar_root);
        }

        if (typeof this.subscribe === 'function') {
            this.unsubscribe_from_store = this.subscribe((_new_state, listener_meta) => {
                if (listener_meta?.skip_render) return;
                if (this.root && typeof this.render === 'function') {
                    const active = document.activeElement;
                    const active_in_plate = Boolean(active && this.plate_element_ref?.contains(active));
                    const tag = active?.tagName?.toLowerCase();
                    const typing_in_plate = Boolean(
                        active_in_plate &&
                            active &&
                            (tag === 'textarea' || tag === 'input' || tag === 'select')
                    );
                    const interactive_in_plate = Boolean(
                        active_in_plate &&
                            active &&
                            (typing_in_plate ||
                                tag === 'button' ||
                                (tag === 'a' &&
                                    (active.getAttribute?.('href') || '').trim() !== '' &&
                                    !(active.getAttribute?.('href') || '').trim().toLowerCase().startsWith('javascript:')))
                    );
                    let branch = 'full_render';
                    if (
                        listener_meta?.action_type === this.StoreActionTypes.REPLACE_STATE_FROM_REMOTE &&
                        active_in_plate
                    ) {
                        branch = 'patch_remote_in_plate';
                        debug_session_log('RequirementAuditComponent.ts:store_subscribe', branch, {
                            action_type: listener_meta?.action_type,
                            interactive_in_plate,
                            active_in_plate
                        }, 'H1');
                        void this.patch_dom_after_current_requirement_result_change();
                        return;
                    }
                    if (this._should_patch_requirement_result_only(listener_meta)) {
                        branch = 'patch_requirement_result';
                        debug_session_log('RequirementAuditComponent.ts:store_subscribe', branch, {
                            action_type: listener_meta?.action_type,
                            skip_render: listener_meta?.skip_render,
                            interactive_in_plate
                        }, 'H1');
                        void this.patch_dom_after_current_requirement_result_change();
                        return;
                    }
                    if (interactive_in_plate) {
                        branch = 'skip_interactive_in_plate';
                        debug_session_log('RequirementAuditComponent.ts:store_subscribe', branch, {
                            action_type: listener_meta?.action_type,
                            tag
                        }, 'H1');
                        if (this._should_patch_requirement_result_only(listener_meta)) {
                            void this.patch_dom_after_current_requirement_result_change();
                        }
                        return;
                    }
                    debug_session_log('RequirementAuditComponent.ts:store_subscribe', branch, {
                        action_type: listener_meta?.action_type,
                        skip_render: listener_meta?.skip_render
                    }, 'H1');
                    if (is_debug_modal_scroll() && window.ConsoleManager) window.ConsoleManager.log('[GV-ModalDebug] RequirementAuditComponent: render');
                    this.render();
                }
            });
        }

        document.addEventListener('keydown', this.handle_audit_keydown);
    }

    /**
     * Sparar kravresultat till server via hel-PATCH (anropas vid blur på textfält och efter vissa åtgärder).
     */
    async _flush_audit_requirement_to_server() {
        const pending_flow_id = peek_krav_vy_sync_flow();
        if (typeof this.flush_sync_to_server !== 'function' || !this.getState || !this.dispatch) {
            warn_krav_vy_sync_not_available(
                pending_flow_id,
                'flush_sync_to_server saknas eller state/dispatch saknas — sparas inte till servern'
            );
            return;
        }
        try {
            await this.flush_sync_to_server(this.getState, this.dispatch);
        } catch (e) {
            const flow_id = peek_krav_vy_sync_flow();
            if (flow_id) {
                log_krav_vy_sync_fel(flow_id, {
                    meddelande: e instanceof Error ? e.message : String(e),
                    anledning: 'flush_sync_to_server kastade undantag'
                });
            }
            if (window.ConsoleManager?.warn) {
                window.ConsoleManager.warn('[RequirementAuditComponent] flush_sync_to_server vid kravvy:', e);
            }
        }
    }

    /** Synkar kommentarer + observationer från DOM till Redux (utan trim om should_trim false). */
    _save_plate_to_redux({ should_trim = false, skip_last_status_bump = false, sync_persist = false } = {}) {
        if (!this.plate_element_ref) return false;
        this.handle_comment_input(should_trim);
        this.checklist_handler_instance?.flush_observations_before_destroy?.({ trim: should_trim });
        return this._persist_current_result_to_store({
            skip_last_status_bump,
            sync_persist
        });
    }

    _persist_current_result_to_store({ skip_last_status_bump = false, sync_persist = false } = {}) {
        if (!this.current_result) return false;
        if (sync_persist) {
            return this._dispatch_result_persist_sync(this.current_result, {
                skipLastStatusBump: skip_last_status_bump === true
            });
        }
        void this.save_requirement_result_spar_bakgrund({
            skipLastStatusBump: skip_last_status_bump === true
        });
        return true;
    }

    _dispatch_result_persist_sync(modified_result_object, options = {}) {
        (this.current_requirement.checks || []).forEach((check_def) => {
            const storage_key = definition_primary_id(check_def);
            if (!storage_key) return;
            const resolved = resolve_map_entry(modified_result_object.checkResults, storage_key);
            const check_res = resolved?.value;
            if (!check_res) return;
            check_res.status = this.AuditLogic.calculate_check_status(check_def, check_res.passCriteria, check_res.overallStatus);
        });
        modified_result_object.status = this.AuditLogic.calculate_requirement_status(this.current_requirement, modified_result_object);

        const state_for_compare = this.getState();
        const sample_row = state_for_compare?.samples?.find(s => String(s.id) === String(this.params.sampleId));
        const previous_from_store = sample_row?.requirementResults?.[this.requirement_map_key];
        if (previous_from_store
            && typeof this.AuditLogic.requirement_results_equal_for_last_updated === 'function'
            && this.AuditLogic.requirement_results_equal_for_last_updated(previous_from_store, modified_result_object)) {
            log_krav_vy_textarea('Autospar hoppades över (oförändrat)', {
                sampleId: this.params?.sampleId,
                requirementId: this.requirement_map_key
            });
            return false;
        }

        if (options.skipLastStatusBump === true && previous_from_store) {
            modified_result_object.lastStatusUpdate = previous_from_store.lastStatusUpdate ?? null;
            modified_result_object.lastStatusUpdateBy = previous_from_store.lastStatusUpdateBy ?? null;
        } else {
            modified_result_object.lastStatusUpdate = this.Helpers.get_current_iso_datetime_utc();
            modified_result_object.lastStatusUpdateBy = get_current_user_name();
        }

        const saved = dispatch_persist_sync({
            type: this.StoreActionTypes.UPDATE_REQUIREMENT_RESULT,
            payload: {
                sampleId: this.params.sampleId,
                requirementId: this.requirement_map_key,
                newRequirementResult: modified_result_object,
                skip_render: true
            }
        });
        if (saved) {
            log_krav_vy_state_andring('UPDATE_REQUIREMENT_RESULT (sync persist)', {
                sampleId: this.params.sampleId,
                requirementId: this.requirement_map_key,
                skip_render: true,
                state: modified_result_object
            });
        }
        return saved;
    }

    _cancel_plate_text_autosave_timer() {
        if (this._plate_text_autosave_timer) {
            clearTimeout(this._plate_text_autosave_timer);
            this._plate_text_autosave_timer = null;
        }
    }

    /** Debouncad autospar (250 ms) av textarea-innehåll till sessionStorage via store. */
    _request_plate_text_autosave() {
        this._cancel_plate_text_autosave_timer();
        log_krav_vy_textarea('Autospar timer startad', {
            sampleId: this.params?.sampleId,
            requirementId: this.requirement_map_key
        });
        this._plate_text_autosave_timer = setTimeout(() => {
            this._plate_text_autosave_timer = null;
            log_krav_vy_textarea('Autospar till sessionStorage (debounce)', {
                sampleId: this.params?.sampleId,
                requirementId: this.requirement_map_key
            });
            this._save_plate_to_redux({ should_trim: false, skip_last_status_bump: true });
        }, 250);
    }

    _handle_unload_persist(reason) {
        if (reason === 'visibilitychange') {
            this._flush_plate_text_autosave_on_visibility_hidden();
            return;
        }
        this._flush_plate_text_autosave_for_unload();
    }

    /** Omedelbar synkron sparning vid pagehide/beforeunload så omladdning utan blur behåller text. */
    _flush_plate_text_autosave_for_unload() {
        this._cancel_plate_text_autosave_timer();
        if (!this.plate_element_ref || !this.current_result) return;
        log_krav_vy_textarea('Autospar till sessionStorage (unload)', {
            sampleId: this.params?.sampleId,
            requirementId: this.requirement_map_key
        });
        this._save_plate_to_redux({ should_trim: false, skip_last_status_bump: true, sync_persist: true });
    }

    /** Sparar väntande textarea-text när fliken döljs (t.ex. innan omladdning i annan flik). */
    _flush_plate_text_autosave_on_visibility_hidden() {
        if (!document.hidden) return;
        if (!this.plate_element_ref || !this.current_result) return;
        const active = document.activeElement;
        const in_plate_text_field = active instanceof HTMLElement
            && this.plate_element_ref.contains(active)
            && (
                active.classList.contains('pc-observation-detail-textarea')
                || active.id === 'commentToAuditor'
                || active.id === 'commentToActor'
            );
        if (!this._plate_text_autosave_timer && !in_plate_text_field) return;
        log_krav_vy_textarea('Autospar till sessionStorage (flik dold)', {
            sampleId: this.params?.sampleId,
            requirementId: this.requirement_map_key,
            hade_väntande_timer: Boolean(this._plate_text_autosave_timer),
            fokus_i_textfält: in_plate_text_field
        });
        this._flush_plate_text_autosave_for_unload();
    }

    handle_comment_input_only() {
        this.handle_comment_input(false);
        this._request_plate_text_autosave();
    }

    _bind_krav_vy_focus_debug_listeners(root_el) {
        if (!is_debug_krav_vy() || !root_el || this._krav_vy_focus_debug_roots.includes(root_el)) return;
        root_el.addEventListener('focusin', this.handle_krav_vy_focusin);
        root_el.addEventListener('focusout', this.handle_krav_vy_focusout);
        this._krav_vy_focus_debug_roots.push(root_el);
    }

    _unbind_krav_vy_focus_debug_listeners(root_el) {
        if (!root_el) return;
        root_el.removeEventListener('focusin', this.handle_krav_vy_focusin);
        root_el.removeEventListener('focusout', this.handle_krav_vy_focusout);
        this._krav_vy_focus_debug_roots = this._krav_vy_focus_debug_roots.filter((el) => el !== root_el);
    }

    _unbind_all_krav_vy_focus_debug_listeners() {
        [...this._krav_vy_focus_debug_roots].forEach((root_el) => {
            this._unbind_krav_vy_focus_debug_listeners(root_el);
        });
    }

    handle_krav_vy_focusin(event) {
        log_krav_vy_fokus_from_event('Fokus fick', event);
    }

    handle_krav_vy_focusout(event) {
        log_krav_vy_fokus_from_event('Fokus förlorade', event);
    }

    handle_comment_focusin(event) {
        const textarea = event.target;
        if (!textarea || !this.params?.sampleId || !this.requirement_map_key) return;
        
        // Hämta auditId från state
        const state = this.getState();
        const audit_id = state?.auditId || this.params?.auditId || this.params?.id;
        if (!audit_id) return;

        let field = null;
        if (textarea.id === 'commentToAuditor') field = 'commentToAuditor';
        else if (textarea.id === 'commentToActor') field = 'commentToActor';
        
        if (field) {
            const part_key = make_requirement_text_part_key(audit_id, this.params.sampleId, this.requirement_map_key, field);
            void try_acquire_audit_part_lock({ audit_id, part_key });
        }
    }

    handle_comment_focusout(event) {
        const textarea = event.target;
        if (!textarea || !this.params?.sampleId || !this.requirement_map_key) return;
        
        const state = this.getState();
        const audit_id = state?.auditId || this.params?.auditId || this.params?.id;
        if (!audit_id) return;

        let field = null;
        if (textarea.id === 'commentToAuditor') field = 'commentToAuditor';
        else if (textarea.id === 'commentToActor') field = 'commentToActor';
        
        if (field) {
            const part_key = make_requirement_text_part_key(audit_id, this.params.sampleId, this.requirement_map_key, field);
            void release_audit_part_lock({ audit_id, part_key });
        }
    }

    handle_comment_blur_save(event) {
        this._cancel_plate_text_autosave_timer();
        this.handle_comment_focusout(event);
        log_krav_vy_textarea('Autospar till sessionStorage (blur)', {
            sampleId: this.params?.sampleId,
            requirementId: this.requirement_map_key,
            fält: event?.target?.id || null
        });
        this._save_plate_to_redux({ should_trim: false, skip_last_status_bump: false });
        void this._flush_audit_requirement_to_server();
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
        // För intern lagring (requirementResults m.m.) används map-nyckeln i requirements-objektet.
        this.requirement_public_key = String(this.params.requirementId);
        this.requirement_map_key =
            resolve_requirement_map_key(state.ruleFileContent.requirements, this.requirement_public_key)
            || this.requirement_public_key;

        this.current_requirement = find_requirement_definition(
            state.ruleFileContent.requirements,
            this.requirement_public_key
        );
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

        (this.current_requirement.checks || []).forEach((check_def) => {
            const check_storage_key = definition_primary_id(check_def);
            if (!check_storage_key) return;
            if (!this.current_result.checkResults[check_storage_key]) {
                this.current_result.checkResults[check_storage_key] = {
                    status: 'not_audited',
                    overallStatus: 'not_audited',
                    passCriteria: {}
                };
            }
            (check_def.passCriteria || []).forEach((pc_def) => {
                const pc_storage_key = definition_primary_id(pc_def);
                if (!pc_storage_key) return;
                const pc_data = this.current_result.checkResults[check_storage_key].passCriteria[pc_storage_key];
                if (typeof pc_data !== 'object' || pc_data === null) {
                    this.current_result.checkResults[check_storage_key].passCriteria[pc_storage_key] = {
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

    _snapshot_requirement_result_for_compare(result) {
        if (!result || typeof result !== 'object') return '';
        try {
            return JSON.stringify({
                status: result.status,
                stuckProblemDescription: result.stuckProblemDescription,
                commentToAuditor: result.commentToAuditor,
                commentToActor: result.commentToActor,
                checkResults: result.checkResults
            });
        } catch {
            return '';
        }
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

    /**
     * Checklista, rubrik, notifiering, högersidebar och nav utan full RequirementAudit.render().
     * @param {{ defer_chrome?: boolean }} [options]
     */
    async _refresh_plate_ui_after_result_sync_from_store(options = {}) {
        const defer_chrome = options.defer_chrome === true;
        debug_session_log('RequirementAuditComponent.ts:_refresh_plate_ui', 'partiell UI-uppdatering', {
            patch_scope: this._checklist_patch_scope || null,
            defer_chrome
        }, 'H5');
        log_krav_vy_render('partiell', {
            sampleId: this.params?.sampleId,
            requirementId: this.requirement_map_key,
            patch_scope: this._checklist_patch_scope || null,
            defer_chrome
        });
        const state = this.getState();
        const is_locked = state.auditStatus === 'locked' || state.auditStatus === 'archived';
        const t = this.Translation.t;

        this._refresh_overall_requirement_status_in_header();

        const update_details = this._get_checklist_update_details(state);
        this.checklist_handler_instance.render(
            this.current_requirement,
            this.current_result,
            is_locked,
            update_details,
            this._checklist_patch_scope
        );

        if (this.current_result?.needsReview === true) {
            this.NotificationComponent.show_global_message(t('requirement_updated_needs_review'), 'info');
        } else {
            this.NotificationComponent.clear_global_message();
        }

        if (defer_chrome) {
            queueMicrotask(() => {
                void this._refresh_plate_sidebar_and_nav();
            });
            return;
        }

        await this._refresh_plate_sidebar_and_nav();
    }

    async _refresh_plate_sidebar_and_nav() {
        await this.render_right_sidebar();
        this.render_navigation_from_sidebar();
        this.checklist_handler_instance?._reapply_pending_status_button_focus?.();
    }

    async patch_dom_after_current_requirement_result_change() {
        const result_before = this._snapshot_requirement_result_for_compare(this.current_result);
        if (!this.load_and_prepare_view_data()) {
            await this.render();
            return;
        }
        const plate_exists = this.plate_element_ref && this.root.contains(this.plate_element_ref);
        if (!plate_exists) {
            await this.render();
            return;
        }

        const result_after = this._snapshot_requirement_result_for_compare(this.current_result);
        if (result_before !== '' && result_before === result_after) {
            return;
        }

        await this._refresh_plate_ui_after_result_sync_from_store();
    }

    /**
     * Köar statusändringar så snabba klick/tangentbord inte skriver över varandra i store.
     * @returns {Promise<void>}
     */
    handle_checklist_status_change(change_info) {
        const run = () => this._run_checklist_status_change(change_info);
        const next = this._status_change_queue_tail.then(run, run);
        this._status_change_queue_tail = next.then(
            () => undefined,
            () => undefined
        );
        return next;
    }

    async _run_checklist_status_change(change_info) {
        if (!this.load_and_prepare_view_data()) {
            await this.render();
            return;
        }

        let modified_result;
        try {
            modified_result = JSON.parse(JSON.stringify(this.current_result));
        } catch (error) {
            if (window.ConsoleManager) window.ConsoleManager.warn('[RequirementAuditComponent] Failed to clone current result for status change:', error);
            return;
        }
        const check_definition = find_check_def_by_storage_id(this.current_requirement.checks, change_info.checkId);
        const resolved_check = resolve_map_entry(modified_result.checkResults, change_info.checkId);
        const check_result = resolved_check?.value;
        if (!check_result) {
            if (window.ConsoleManager?.warn) {
                window.ConsoleManager.warn(
                    '[RequirementAuditComponent] checkResults saknar post för checkId:',
                    change_info.checkId
                );
            }
            return;
        }

        const current_time = this.Helpers.get_current_iso_datetime_utc();

        const current_user = get_current_user_name();
        let logical_change_payload: Record<string, unknown> | null = null;
        if (change_info.type === 'check_overall_status_change') {
            const previous_status = check_result.overallStatus || 'not_audited';
            check_result.overallStatus = check_result.overallStatus === change_info.newStatus ? 'not_audited' : change_info.newStatus;
            check_result.timestamp = current_time;
            check_result.updatedBy = current_user;
            if (previous_status !== check_result.overallStatus) {
                logical_change_payload = {
                    typ: 'kontrollpunkt',
                    check_id: change_info.checkId,
                    pc_id: null,
                    knapp: change_info.newStatus === 'passed' ? 'Kontrollpunkt: Stämmer' : 'Kontrollpunkt: Stämmer inte',
                    tidigare: previous_status,
                    nytt: check_result.overallStatus,
                    orsak: change_info.trigger?.source || 'okänd'
                };
            }
        } else if (change_info.type === 'pc_status_change') {
            if (check_result.overallStatus !== 'passed') {
                this.NotificationComponent.show_global_message(this.Translation.t('error_set_check_status_first'), 'warning');
                return;
            }
            const resolved_pc = resolve_map_entry(check_result.passCriteria, change_info.pcId);
            const pc_result = resolved_pc?.value;
            if (!pc_result) {
                if (window.ConsoleManager?.warn) {
                    window.ConsoleManager.warn(
                        '[RequirementAuditComponent] passCriteria saknar post för pcId:',
                        change_info.pcId
                    );
                }
                return;
            }
            const previous_pc_status = pc_result.status || 'not_audited';
            pc_result.status = pc_result.status === change_info.newStatus ? 'not_audited' : change_info.newStatus;
            pc_result.timestamp = current_time;
            pc_result.updatedBy = current_user;

            if (previous_pc_status !== pc_result.status) {
                logical_change_payload = {
                    typ: 'godkännandekriterium',
                    check_id: change_info.checkId,
                    pc_id: change_info.pcId,
                    knapp: change_info.newStatus === 'passed' ? 'Godkännandekriterium: Godkänt' : 'Godkännandekriterium: Underkänt',
                    tidigare: previous_pc_status,
                    nytt: pc_result.status,
                    orsak: change_info.trigger?.source || 'okänd'
                };
            }

            if (pc_result.status === 'failed' && (!pc_result.observationDetail || pc_result.observationDetail.trim() === '')) {
                const pc_def = find_pass_criterion_def_by_storage_id(check_definition?.passCriteria, change_info.pcId);
                if (pc_def?.failureStatementTemplate) {
                    pc_result.observationDetail = pc_def.failureStatementTemplate;
                }
            }
        }

        if (logical_change_payload && change_info.flow_id) {
            log_krav_vy_knapp('Logisk statusändring', {
                flow_id: change_info.flow_id,
                ...logical_change_payload
            });
        }

        delete modified_result.needsReview;
        try {
            await this.dispatch_result_update(modified_result, { skipRender: true });
        } catch (e) {
            if (window.ConsoleManager?.warn) {
                window.ConsoleManager.warn('[RequirementAuditComponent] Kunde inte spara kravresultat efter statusändring:', e);
            }
            return;
        }
        if (!this.load_and_prepare_view_data()) {
            await this.render();
            return;
        }
        this._checklist_patch_scope = {
            check_id: change_info.checkId,
            pc_id: change_info.type === 'pc_status_change' ? change_info.pcId : null,
            mode: change_info.type === 'pc_status_change' ? 'pc_only' : 'check_and_pcs'
        };
        try {
            await this._refresh_plate_ui_after_result_sync_from_store({ defer_chrome: true });
        } finally {
            this._checklist_patch_scope = null;
        }
        if (typeof this.refresh_side_menu_and_title === 'function') {
            this.refresh_side_menu_and_title();
        }
        if (change_info.flow_id) {
            register_krav_vy_knapp_sync(change_info.flow_id);
        }
        void this._flush_audit_requirement_to_server();
    }

    handle_comment_input(should_trim = false) {
        if (!this.current_result) return;
        const trim_fn = this.Helpers?.trim_textarea_preserve_lines;
        if (this.comment_to_auditor_input) {
            const val = this.comment_to_auditor_input.value || '';
            this.current_result.commentToAuditor = should_trim && trim_fn ? trim_fn(val) : val;
            log_krav_vy_textarea('Textarea input (lokal state)', {
                fält: 'commentToAuditor',
                fält_id: 'commentToAuditor',
                värde_längd: val.length
            });
        }
        if (this.comment_to_actor_input) {
            const val = this.comment_to_actor_input.value || '';
            this.current_result.commentToActor = should_trim && trim_fn ? trim_fn(val) : val;
            log_krav_vy_textarea('Textarea input (lokal state)', {
                fält: 'commentToActor',
                fält_id: 'commentToActor',
                värde_längd: val.length
            });
        }
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
        const requirements_obj = rule_file_content.requirements;
        let items = (ordered_keys || []).map(req_key => {
            const requirement = find_requirement_definition(requirements_obj, req_key)
                || requirements_obj?.[req_key];
            if (!requirement) return null;
            const req_result = this.AuditLogic.get_stored_requirement_result_for_def(
                this.current_sample.requirementResults,
                requirements_obj,
                requirement,
                req_key
            );
            const display_status = req_result?.needsReview
                ? 'updated'
                : this.AuditLogic.get_effective_requirement_audit_status(
                    requirements_obj,
                    this.current_sample.requirementResults,
                    requirement,
                    req_key
                );
            return {
                req_key,
                requirement,
                display_status,
                link_text: requirement?.title || this.Translation.t('unknown_value', { val: req_key }),
                ref_text: requirement?.standardReference?.text || ''
            };
        }).filter(item => item && item.requirement);

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
        const requirements_obj = rule_file_content.requirements;
        const sample_index_map = new Map();
        samples.forEach((s, idx) => { if (s?.id) sample_index_map.set(s.id, idx); });
        const matching = samples.filter(sample => {
            const relevant_requirements = this.AuditLogic.get_relevant_requirements_for_sample(rule_file_content, sample);
            return (relevant_requirements || []).some(req => String(req?.key || req?.id) === String(requirement_key));
        });
        let items = matching.map(sample => {
            const req_result = this.AuditLogic.get_stored_requirement_result_for_def(
                sample.requirementResults,
                requirements_obj,
                this.current_requirement,
                this.params?.requirementId
            );
            const display_status = req_result?.needsReview
                ? 'updated'
                : this.AuditLogic.get_effective_requirement_audit_status(
                    requirements_obj,
                    sample.requirementResults,
                    this.current_requirement,
                    this.params?.requirementId
                );
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
     * - `save_requirement_result_spar_bakgrund`: skip_render true (ingen global omritning); sidtitel/meny uppdateras via blur-flöde vid behov.
     * - `handle_checklist_status_change`: skip_render true; checklista, sidebar och vänstermeny uppdateras lokalt + `refreshSideMenuAndTitle`.
     * - `onStuckDescriptionSaved`: skip_render false avsiktligt (full synk av UI) eller motsv.
     * - Poll/WebSocket: REPLACE_STATE_FROM_REMOTE utan skip_render; särskild hantering vid fokus i plåt.
     * - `handle_navigation` confirm_reviewed: skip_render true + lokal uppdatering av plåt/sidebar/meny.
     */
    dispatch_result_update(modified_result_object, options = {}) {
        (this.current_requirement.checks || []).forEach((check_def) => {
            const storage_key = definition_primary_id(check_def);
            if (!storage_key) return;
            const resolved = resolve_map_entry(modified_result_object.checkResults, storage_key);
            const check_res = resolved?.value;
            if (!check_res) {
                if (window.ConsoleManager?.warn) {
                    window.ConsoleManager.warn(
                        '[RequirementAuditComponent] dispatch_result_update: saknar checkResults-post för',
                        storage_key
                    );
                }
                return;
            }
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
        }).then((result) => {
            log_krav_vy_state_andring('UPDATE_REQUIREMENT_RESULT', {
                sampleId: this.params.sampleId,
                requirementId: this.requirement_map_key,
                skip_render: options.skipRender === true,
                state: modified_result_object
            });
            return result;
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
        this._save_plate_to_redux({ should_trim: true, skip_last_status_bump: false });

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
                    void (async () => {
                        try {
                            await this.dispatch_result_update(result, { skipRender: true });
                            if (!this.load_and_prepare_view_data()) {
                                await this.render();
                                return;
                            }
                            await this._refresh_plate_ui_after_result_sync_from_store();
                            if (typeof this.refresh_side_menu_and_title === 'function') {
                                this.refresh_side_menu_and_title();
                            }
                        } catch (err) {
                            if (window.ConsoleManager?.warn) {
                                window.ConsoleManager.warn('[RequirementAuditComponent] Bekräfta status / dispatch:', err);
                            }
                        }
                    })();
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

        let action = null;
        if (key_lower === shortcut_key('shortcut_key_back_to_list')) {
            action = 'back_to_list';
        } else if (key_lower === shortcut_key('shortcut_key_previous') && !nav.is_first) {
            action = 'previous';
        } else if (key_lower === shortcut_key('shortcut_key_next') && !nav.is_last) {
            action = 'next';
        } else if (key_lower === shortcut_key('shortcut_key_next_unhandled') && nav.next_unhandled_item) {
            action = 'next_unhandled';
        }

        if (action) {
            event.preventDefault();
            this.handle_navigation(action);
        }
    }

    build_initial_dom() {
        if (this.plate_element_ref) {
            this._unbind_krav_vy_focus_debug_listeners(this.plate_element_ref);
        }
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
                onObservationChange: () => {
                    this._request_plate_text_autosave();
                },
                onObservationBlurCommit: () => {
                    this._cancel_plate_text_autosave_timer();
                    log_krav_vy_textarea('Autospar till sessionStorage (blur)', {
                        sampleId: this.params?.sampleId,
                        requirementId: this.requirement_map_key,
                        fält: 'observation'
                    });
                    this._save_plate_to_redux({ should_trim: false, skip_last_status_bump: false });
                    void this._flush_audit_requirement_to_server();
                },
                onStuckDescriptionSaved: async () => {
                    if (is_debug_stuck_sync()) {
                        consoleManager.log('[GV-Debug] onStuckDescriptionSaved: sparar, anropar save_result_immediately + flush_sync_to_server');
                    }
                    this.save_result_immediately({ skipRender: false });
                    if (typeof this.flush_sync_to_server === 'function' && this.getState && this.dispatch) {
                        try {
                            await this.flush_sync_to_server(this.getState, this.dispatch);
                            if (is_debug_stuck_sync()) {
                                consoleManager.log('[GV-Debug] onStuckDescriptionSaved: flush_sync_to_server klar');
                            }
                        } catch (e) {
                            if (is_debug_stuck_sync()) {
                                console.warn('[GV-Debug] onStuckDescriptionSaved: flush_sync_to_server fel', e);
                            }
                            if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[RequirementAuditComponent] flush_sync_to_server efter kört fast:', e);
                        }
                    } else if (is_debug_stuck_sync()) {
                        console.warn('[GV-Debug] onStuckDescriptionSaved: flush_sync_to_server inte tillgänglig');
                    }
                }
            },
            {
                deps: this.deps,
                getObservationsFromOtherSamples: (check_id, pc_id) => this.get_observations_from_other_samples(check_id, pc_id),
                getDomFocusSyncRoot: () => this.plate_element_ref,
                getIsAuditFrozen: () => {
                    const st = this.getState();
                    return st?.auditStatus === 'locked' || st?.auditStatus === 'archived';
                },
                getIsAuditArchived: () => this.getState()?.auditStatus === 'archived',
                lockHelpers: {
                    tryAcquireLock: try_acquire_audit_part_lock,
                    releaseLock: release_audit_part_lock,
                    getRemoteLock: get_current_audit_remote_lock,
                    ensureClientLockId: ensure_client_lock_id_for_part,
                    isRemoteLockHeldByOtherUser: is_remote_lock_held_by_other_user,
                    makeObservationDetailPartKey: make_observation_detail_part_key
                },
                getAuditId: () => this.getState()?.auditId || this.params?.auditId || this.params?.id,
                getSampleId: () => this.params?.sampleId,
                getRequirementMapKey: () => this.requirement_map_key
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
        this._bind_krav_vy_focus_debug_listeners(this.plate_element_ref);
    }

    build_comment_fields() {
        const t = this.Translation.t;
        const container = this.Helpers.create_element('div', { class_name: 'input-fields-container audit-section' });
        container.appendChild(this.Helpers.create_element('h2', { text_content: t('observations_and_comments_title') }));
    
        const fg1 = this.Helpers.create_element('div', { class_name: 'form-group' });
        const label1 = this.Helpers.create_element('label', { attributes: { for: 'commentToAuditor' }, text_content: t('comment_to_auditor') });
        fg1.appendChild(label1);
        
        const hint1 = this.Helpers.create_element('div', { class_name: 'lock-hint text-muted' });
        hint1.id = 'lock-hint-commentToAuditor';
        hint1.style.fontSize = '0.85em';
        hint1.style.fontWeight = 'bold';
        hint1.style.color = '#d32f2f';
        hint1.setAttribute('aria-live', 'polite');
        fg1.appendChild(hint1);

        this.comment_to_auditor_input = this.Helpers.create_element('textarea', {
            id: 'commentToAuditor',
            class_name: 'form-control',
            attributes: { rows: '4' }
        });
        this.comment_to_auditor_input.addEventListener('input', this.handle_comment_input_only);
        this.comment_to_auditor_input.addEventListener('focusin', this.handle_comment_focusin);
        this.comment_to_auditor_input.addEventListener('blur', this.handle_comment_blur_save);
        fg1.appendChild(this.comment_to_auditor_input);

        const fg2 = this.Helpers.create_element('div', { class_name: 'form-group' });
        const label2 = this.Helpers.create_element('label', { attributes: { for: 'commentToActor' }, text_content: t('comment_to_actor') });
        fg2.appendChild(label2);
        
        const hint2 = this.Helpers.create_element('div', { class_name: 'lock-hint text-muted' });
        hint2.id = 'lock-hint-commentToActor';
        hint2.style.fontSize = '0.85em';
        hint2.style.fontWeight = 'bold';
        hint2.style.color = '#d32f2f';
        hint2.setAttribute('aria-live', 'polite');
        fg2.appendChild(hint2);

        this.comment_to_actor_input = this.Helpers.create_element('textarea', {
            id: 'commentToActor',
            class_name: 'form-control',
            attributes: { rows: '4' }
        });
        this.comment_to_actor_input.addEventListener('input', this.handle_comment_input_only);
        this.comment_to_actor_input.addEventListener('focusin', this.handle_comment_focusin);
        this.comment_to_actor_input.addEventListener('blur', this.handle_comment_blur_save);
        fg2.appendChild(this.comment_to_actor_input);
        
        container.append(fg1, fg2);
        return container;
    }

    populate_dom_with_data() {
        const t = this.Translation.t;
        const state = this.getState();
        const is_locked = state.auditStatus === 'locked' || state.auditStatus === 'archived';

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
        
        this._apply_comment_fields_ui();

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
     * Uppdaterar readOnly och lås-hint för kommentarstextfält.
     */
    _sync_audit_part_lock_ui() {
        if (!this.params?.sampleId || !this.requirement_map_key) return;
        
        const state = this.getState();
        const audit_id = state?.auditId || this.params?.auditId || this.params?.id;
        if (!audit_id) return;

        const update_field_lock = (textarea, field_name) => {
            if (!textarea) return;
            
            const part_key = make_requirement_text_part_key(audit_id, this.params.sampleId, this.requirement_map_key, field_name);
            const remote_lock = get_current_audit_remote_lock(part_key);
            const my_client_lock_id = ensure_client_lock_id_for_part(part_key);
            const locked_by_other = is_remote_lock_held_by_other_user(
                remote_lock,
                get_current_user_name(),
                my_client_lock_id
            );

            // Om granskningen är arkiverad är fältet alltid låst
            const is_archived = state.auditStatus === 'archived';
            const want_readonly = locked_by_other || is_archived;

            if (textarea.readOnly !== want_readonly) {
                const had_focus = document.activeElement === textarea;
                textarea.readOnly = want_readonly;
                if (had_focus && !want_readonly) {
                    // Använd setTimeout för att undvika att störa pågående blur-events
                    setTimeout(() => {
                        const active = document.activeElement;
                        if (active !== textarea && (active === document.body || active === null)) {
                            textarea.focus({ preventScroll: true });
                        }
                    }, 0);
                }
            }
            textarea.classList.toggle('readonly-textarea', want_readonly);

            // Hantera lås-hint
            const wrapper = textarea.closest('.form-group');
            if (wrapper) {
                let hint_el = wrapper.querySelector('.lock-hint');
                if (hint_el) {
                    if (locked_by_other) {
                        const display_name = remote_lock?.user_name || this.Translation.t('another_user');
                        hint_el.textContent = this.Translation.t('user_is_editing_field', { name: display_name });
                        hint_el.style.marginBottom = '4px';
                        textarea.setAttribute('aria-describedby', hint_el.id);
                        textarea.style.border = '4px solid #d32f2f';
                    } else {
                        hint_el.textContent = '';
                        hint_el.style.marginBottom = '0';
                        textarea.removeAttribute('aria-describedby');
                        textarea.style.border = '';
                    }
                }
            }
        };

        update_field_lock(this.comment_to_auditor_input, 'commentToAuditor');
        update_field_lock(this.comment_to_actor_input, 'commentToActor');
    }

    /**
     * Synkar kommentarsfält med aktuellt kravresultat. readOnly endast för arkiverad granskning.
     */
    _apply_comment_fields_ui() {
        const target_auditor_value = this.current_result.commentToAuditor || '';
        const target_actor_value = this.current_result.commentToActor || '';

        if (this.comment_to_auditor_input) {
            if (document.activeElement !== this.comment_to_auditor_input &&
                this.comment_to_auditor_input.value !== target_auditor_value) {
                this.comment_to_auditor_input.value = target_auditor_value;
            }
            this.comment_to_auditor_input.disabled = false;
        }
        if (this.comment_to_actor_input) {
            if (document.activeElement !== this.comment_to_actor_input &&
                this.comment_to_actor_input.value !== target_actor_value) {
                this.comment_to_actor_input.value = target_actor_value;
            }
            this.comment_to_actor_input.disabled = false;
        }
        
        this._sync_audit_part_lock_ui();
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
        debug_session_log('RequirementAuditComponent.ts:render', 'full render()', {
            plate_exists: Boolean(this.plate_element_ref && this.root?.contains(this.plate_element_ref))
        }, 'H1');
        log_krav_vy_render('full', {
            sampleId: this.params?.sampleId,
            requirementId: this.requirement_map_key || this.params?.requirementId
        });
        if (typeof window !== 'undefined' && is_debug_autosave_focus() && this.plate_element_ref) {
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

        const plate_exists = this.plate_element_ref && this.root.contains(this.plate_element_ref);
        if (!plate_exists) {
            this.build_initial_dom();
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

    async destroy() {
        await this._status_change_queue_tail;
        this._cancel_plate_text_autosave_timer();
        unregister_unload_persist_hook('requirement_audit_plate');
        this._handle_unload_persist = null;
        if (typeof this.unsubscribe_from_store === 'function') {
            this.unsubscribe_from_store();
            this.unsubscribe_from_store = null;
        }
        document.removeEventListener('keydown', this.handle_audit_keydown);
        this._unbind_all_krav_vy_focus_debug_listeners();
        this.checklist_handler_instance?.flush_observations_before_destroy?.();
        this._save_plate_to_redux({ should_trim: true, skip_last_status_bump: false });

        if (this.comment_to_auditor_input) {
            this.comment_to_auditor_input.removeEventListener('input', this.handle_comment_input_only);
            this.comment_to_auditor_input.removeEventListener('focusin', this.handle_comment_focusin);
            this.comment_to_auditor_input.removeEventListener('blur', this.handle_comment_blur_save);
            this.comment_to_auditor_input = null;
        }
        if (this.comment_to_actor_input) {
            this.comment_to_actor_input.removeEventListener('input', this.handle_comment_input_only);
            this.comment_to_actor_input.removeEventListener('focusin', this.handle_comment_focusin);
            this.comment_to_actor_input.removeEventListener('blur', this.handle_comment_blur_save);
            this.comment_to_actor_input = null;
        }
        this.checklist_handler_instance?.destroy();
        this.info_sections_instance?.destroy();
        this.top_navigation_instance?.destroy();
        this.bottom_navigation_instance?.destroy();
        this.right_sidebar_component_instance?.destroy();
        
        if (typeof window !== 'undefined' && this._on_audit_locks_visibility_refresh) {
            window.removeEventListener('gv-audit-locks-refresh', this._on_audit_locks_visibility_refresh);
            this._on_audit_locks_visibility_refresh = null;
        }
        if (typeof this._unsubscribe_audit_locks === 'function') {
            this._unsubscribe_audit_locks();
            this._unsubscribe_audit_locks = null;
        }
        
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        // Clean up refs
        this.plate_element_ref = null;
        this.right_sidebar_component_instance = null;
        this.right_sidebar_root = null;
    }
}

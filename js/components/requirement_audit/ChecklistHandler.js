// js/components/requirement_audit/ChecklistHandler.js

import { get_current_user_name } from '../../utils/helpers.js';
import { marked } from '../../utils/markdown.js';
import { consoleManager } from '../../utils/console_manager.js';
import { app_runtime_refs } from '../../utils/app_runtime_refs.js';
import {
    get_pending_checklist_focus_target,
    set_pending_checklist_focus_target
} from '../../app/browser_globals.js';
import { is_debug_stuck_sync, is_debug_krav_vy } from '../../app/runtime_flags.js';
import { resolve_map_entry } from '../../audit_logic.js';
import { find_pass_criterion_def_by_storage_id } from '../../logic/entity_id_match.js';
import {
    format_deficiency_id_label,
    should_show_deficiency_id_in_title
} from '../../utils/deficiency_id_display.js';
import {
    consume_krav_vy_dom_flow,
    log_krav_vy_knapp,
    register_krav_vy_knapp_dom_watch,
    start_krav_vy_knapp_flow,
    log_krav_vy_textarea,
    log_krav_vy_observation_ui_mismatch
} from './krav_vy_knapp_debug_log.js';
import { get_status_icon } from '../requirements_list/requirement_list_status_icons.js';
import {
    apply_observation_wrapper_visibility,
    audit_observation_ui,
    read_check_stored_data,
    read_pc_stored_data,
    should_show_pass_criteria_list,
    should_show_observation_wrapper,
    effective_pc_status
} from './checklist_observation_visibility.js';
import {
    get_panel_sync_remaining_ms,
    is_check_panel_animation_blocked,
    is_panel_sync_blocked,
    is_slide_out_in_progress,
    PANEL_ANIMATION_MS,
    PANEL_OPEN_CLASS,
    set_panel_open,
    toggle_slide_hidden_element
} from './criteria_panel.js';

export const ChecklistHandler = {
    container_ref: null,
    on_status_change_callback: null,
    on_observation_change_callback: null,
    on_observation_blur_commit_callback: null,
    on_before_status_change_sync_callback: null,
    on_observation_draft_update_callback: null,
    on_observation_hide_commit_callback: null,
    get_pc_observation_draft: null,
    on_stuck_description_saved_callback: null,

    /** @type {Map<string, string>} */
    _observation_focus_snapshots: null,

    /** @type {Map<string, string>} */
    _observation_dom_cache: null,

    /** Kriterier vars observationsfält dolts med sparad användartext (återställs utan malltext). */
    /** @type {Set<string>} */
    _observation_hidden_with_text_keys: null,

    Translation: null,
    Helpers: null,
    
    is_audit_locked: false,
    /** @type {null|(() => boolean)} */
    get_is_audit_frozen: null,
    /** @type {null|(() => boolean)} */
    get_is_audit_archived: null,
    /** @type {null|(() => HTMLElement|null)} */
    get_dom_focus_sync_root: null,
    lock_helpers: null,
    get_audit_id: null,
    get_sample_id: null,
    get_requirement_map_key: null,
    requirement_definition_ref: null,
    requirement_result_ref: null,

    is_dom_built: false,
    last_language_code: null,
    audit_id: null,
    sample_id: null,
    requirement_id: null,

    /** Aktuell låst/arkiverad-status för UI; läser state när gettaren finns (t.ex. vid update_dom utan render). */
    _audit_frozen_for_ui() {
        if (typeof this.get_is_audit_frozen === 'function') {
            return Boolean(this.get_is_audit_frozen());
        }
        return Boolean(this.is_audit_locked);
    },

    /** Arkiverad granskning: enda läget där observationsfält sätts readOnly. */
    _audit_archived_for_ui() {
        if (typeof this.get_is_audit_archived === 'function') {
            return Boolean(this.get_is_audit_archived());
        }
        return false;
    },

    _build_button_focus_target(button_element) {
        if (!button_element) return null;
        const action = button_element.getAttribute('data-action');
        if (!action) return null;
        const check_item = button_element.closest('.check-item[data-check-id]');
        const pc_item = button_element.closest('.pass-criterion-item[data-pc-id]');
        return {
            action,
            check_id: check_item?.dataset?.checkId || null,
            pc_id: pc_item?.dataset?.pcId || null
        };
    },

    _status_button_snapshot_key(check_id, pc_id, action) {
        return `${check_id}::${pc_id || ''}::${action}`;
    },

    _status_change_flight_key(check_id, pc_id) {
        return `${check_id}::${pc_id ?? ''}`;
    },

    _acquire_status_change_flight(check_id, pc_id) {
        if (!this._status_change_flights) {
            this._status_change_flights = new Set();
        }
        const key = this._status_change_flight_key(check_id, pc_id);
        if (this._status_change_flights.has(key)) {
            return false;
        }
        this._status_change_flights.add(key);
        return true;
    },

    _release_status_change_flight(check_id, pc_id) {
        this._status_change_flights?.delete(this._status_change_flight_key(check_id, pc_id));
    },

    /**
     * Uppdaterar knappar och observationsfält direkt vid klick så användaren ser ändringen
     * innan async sparning och serversynk (särskilt viktigt vid högre nätverkslatens på V2).
     */
    _apply_optimistic_status_button_ui(change_info) {
        if (!change_info?.type || !this.requirement_result_ref?.checkResults || !this.container_ref) {
            return;
        }
        const check_id = change_info.checkId;
        const check_result_data = read_check_stored_data(this.requirement_result_ref.checkResults, check_id);
        if (!check_result_data) return;

        const check_wrapper = this.container_ref.querySelector(
            `.check-item[data-check-id="${CSS.escape(String(check_id))}"]`
        );
        if (!check_wrapper) return;

        if (change_info.type === 'check_overall_status_change') {
            const current = check_result_data.overallStatus || 'not_audited';
            const next = current === change_info.newStatus ? 'not_audited' : change_info.newStatus;
            const complies_btn = check_wrapper.querySelector('button[data-action="set-check-complies"]');
            const not_complies_btn = check_wrapper.querySelector('button[data-action="set-check-not-complies"]');
            if (complies_btn && not_complies_btn) {
                this._apply_status_button_active_state(complies_btn, next === 'passed', {
                    check_id,
                    pc_id: null,
                    action: 'set-check-complies'
                });
                this._apply_status_button_active_state(not_complies_btn, next === 'not_applicable', {
                    check_id,
                    pc_id: null,
                    action: 'set-check-not-complies'
                });
            }
            const pc_panel = check_wrapper.querySelector('.pass-criteria-panel');
            if (pc_panel) {
                const count = pc_panel.querySelectorAll('.pass-criterion-item[data-pc-id]').length;
                this._set_criteria_panel_visibility(
                    check_wrapper,
                    pc_panel,
                    should_show_pass_criteria_list(next, count)
                );
            }
            const compliance_panel = check_wrapper.querySelector('.compliance-info-panel');
            const compliance_info_text = compliance_panel?.querySelector('.compliance-info-text');
            if (compliance_panel) {
                if (next === 'not_applicable' && compliance_info_text) {
                    compliance_info_text.textContent = this.Translation.t('condition_not_met_criteria_auto_passed');
                }
                this._set_criteria_panel_visibility(
                    check_wrapper,
                    compliance_panel,
                    next === 'not_applicable'
                );
            }
            return;
        }

        if (change_info.type !== 'pc_status_change' || !change_info.pcId) return;
        if ((check_result_data.overallStatus || 'not_audited') !== 'passed') return;

        const pc_id = change_info.pcId;
        const pc_item_li = check_wrapper.querySelector(
            `.pass-criterion-item[data-pc-id="${CSS.escape(String(pc_id))}"]`
        );
        if (!pc_item_li) return;

        const pc_data = read_pc_stored_data(check_result_data, pc_id);
        const current = pc_data.status || 'not_audited';
        const next = current === change_info.newStatus ? 'not_audited' : change_info.newStatus;
        const effective = effective_pc_status('passed', next);

        const passed_btn = pc_item_li.querySelector('button[data-action="set-pc-passed"]');
        const failed_btn = pc_item_li.querySelector('button[data-action="set-pc-failed"]');
        if (passed_btn && failed_btn) {
            this._apply_status_button_active_state(passed_btn, effective === 'passed', {
                check_id,
                pc_id,
                action: 'set-pc-passed'
            });
            this._apply_status_button_active_state(failed_btn, effective === 'failed', {
                check_id,
                pc_id,
                action: 'set-pc-failed'
            });
        }

        const pc_status_text_container = pc_item_li.querySelector('.pass-criterion-status');
        if (pc_status_text_container && this.Helpers?.create_element && this.Translation?.t) {
            const t = this.Translation.t;
            const pc_status_text = t(`audit_status_${effective}`);
            pc_status_text_container.innerHTML = '';
            pc_status_text_container.setAttribute('aria-hidden', 'true');
            const pc_strong_element = this.Helpers.create_element('strong', { text_content: t('status') });
            pc_status_text_container.appendChild(pc_strong_element);
            pc_status_text_container.appendChild(document.createTextNode(': '));
            pc_status_text_container.appendChild(this.Helpers.create_element('span', {
                class_name: `status-text status-${effective}`,
                text_content: pc_status_text
            }));
        }

        const observation_wrapper = pc_item_li.querySelector('.pc-observation-detail-wrapper');
        this._sync_observation_wrapper_visibility(
            observation_wrapper,
            'passed',
            { status: next },
            check_id,
            pc_id,
            { animate: true }
        );
    },

    _detect_user_event_source(event) {
        if (!event) return 'okänd';
        if (!event.isTrusted) return 'programmatisk_händelse';
        if (event.type === 'click' && event.detail === 0) return 'tangentbord';
        if (event.type === 'click') return 'klick';
        return event.type || 'okänd';
    },

    _status_button_label(action) {
        const labels = {
            'set-check-complies': 'Kontrollpunkt: Stämmer',
            'set-check-not-complies': 'Kontrollpunkt: Stämmer inte',
            'set-pc-passed': 'Godkännandekriterium: Godkänt',
            'set-pc-failed': 'Godkännandekriterium: Underkänt'
        };
        return labels[action] || action;
    },

    _sync_observation_wrapper_visibility(
        observation_wrapper,
        overall_manual_status,
        pc_data,
        check_id = null,
        pc_id = null,
        { animate = false } = {}
    ) {
        const pc_status = typeof pc_data === 'string' ? pc_data : pc_data?.status;
        const textarea = observation_wrapper?.querySelector?.('textarea.pc-observation-detail-textarea') ?? null;
        const wrapper_el = observation_wrapper instanceof HTMLElement ? observation_wrapper : null;
        const was_hidden = wrapper_el ? wrapper_el.hidden : true;
        const should_show = should_show_observation_wrapper(overall_manual_status, pc_status);

        if (wrapper_el && is_slide_out_in_progress(wrapper_el)) {
            return { applied: false, deferred_hide: false };
        }
        if (should_show === !was_hidden) {
            return { applied: false, deferred_hide: false };
        }

        if (textarea && check_id != null && pc_id != null && !should_show) {
            this._snapshot_observation_before_hide(check_id, pc_id, textarea);
        }

        let result = { applied: false, deferred_hide: false };
        if (!should_show && wrapper_el) {
            const active = document.activeElement;
            if (active instanceof Node && wrapper_el.contains(active)) {
                return { applied: false, deferred_hide: true };
            }
        }

        if (wrapper_el && animate) {
            const changed = toggle_slide_hidden_element(wrapper_el, should_show, { animate: true });
            result = { applied: changed, deferred_hide: false };
        } else {
            result = apply_observation_wrapper_visibility(
                observation_wrapper,
                overall_manual_status,
                pc_status
            );
        }

        if (textarea && check_id != null && pc_id != null && should_show && was_hidden) {
            this._restore_observation_textarea_after_show(check_id, pc_id, textarea);
        }

        return result;
    },

    _snapshot_observation_before_hide(check_id, pc_id, textarea) {
        const text = textarea.value ?? '';
        this._persist_observation_dom_value(check_id, pc_id, text);
        if (!this._observation_hidden_with_text_keys) {
            this._observation_hidden_with_text_keys = new Set();
        }
        if (String(text).trim()) {
            this._observation_hidden_with_text_keys.add(this._observation_cache_key(check_id, pc_id));
        }
        if (this.on_observation_hide_commit_callback) {
            this.on_observation_hide_commit_callback();
        }
    },

    _pick_user_observation_text(check_id, pc_id, observation_textarea = null) {
        const dom_value = observation_textarea?.value ?? '';
        if (String(dom_value).trim()) {
            return dom_value;
        }
        const cached = this._get_cached_observation_text(check_id, pc_id);
        if (typeof cached === 'string') {
            return cached;
        }
        const draft = typeof this.get_pc_observation_draft === 'function'
            ? this.get_pc_observation_draft(check_id, pc_id)
            : undefined;
        if (typeof draft === 'string') {
            return draft;
        }
        return '';
    },

    _restore_observation_textarea_after_show(check_id, pc_id, textarea) {
        const key = this._observation_cache_key(check_id, pc_id);
        if (!this._observation_hidden_with_text_keys?.has(key)) {
            return false;
        }
        const text = this._pick_user_observation_text(check_id, pc_id, textarea);
        if (textarea.value !== text) {
            textarea.value = text;
            this._persist_observation_dom_value(check_id, pc_id, text);
        }
        if (this.Helpers?.init_auto_resize_for_textarea) {
            this.Helpers.init_auto_resize_for_textarea(textarea);
        }
        return true;
    },

    _observation_was_hidden_with_user_text(check_id, pc_id) {
        return this._observation_hidden_with_text_keys?.has(this._observation_cache_key(check_id, pc_id)) === true;
    },

    _defer_criteria_panel_sync(check_wrapper, panel, should_show) {
        const remaining_ms = get_panel_sync_remaining_ms(panel) || PANEL_ANIMATION_MS;
        window.setTimeout(() => {
            if (!panel || !document.contains(panel)) {
                return;
            }
            this._set_criteria_panel_visibility(check_wrapper, panel, should_show, { animate: false });
        }, remaining_ms + 30);
    },

    _set_criteria_panel_visibility(check_wrapper, panel, should_show, { animate = true } = {}) {
        if (!panel) {
            return;
        }
        const check_id = check_wrapper?.dataset?.checkId ?? null;
        const is_open = panel.classList.contains(PANEL_OPEN_CLASS) && !panel.hidden;
        const blocked = is_panel_sync_blocked(panel, check_id);
        if (blocked) {
            if (!animate) {
                this._defer_criteria_panel_sync(check_wrapper, panel, should_show);
            }
            return;
        }
        if (should_show === is_open) {
            return;
        }
        if (!should_show && is_open) {
            const active_element = document.activeElement;
            if (active_element && panel.contains(active_element)) {
                const fallback = check_wrapper?.querySelector('button[data-action="set-check-complies"]')
                    || check_wrapper?.querySelector('button[data-action="set-check-not-complies"]');
                if (fallback && document.contains(fallback)) {
                    try {
                        fallback.focus({ preventScroll: true });
                    } catch {
                        fallback.focus();
                    }
                }
            }
        }
        set_panel_open(panel, should_show, { animate, check_id });
    },

    _heal_pc_ui_from_data({
        check_id,
        pc_id,
        pc_item_li,
        check_result_data,
        context,
        sync_textarea_value = true,
        env = null
    }) {
        if (!pc_item_li || !check_result_data) {
            return { healed: false, deferred_hide: false };
        }
        const overall_manual_status = check_result_data?.overallStatus || 'not_audited';
        const pc_data = read_pc_stored_data(check_result_data, pc_id);
        const current_pc_status = effective_pc_status(overall_manual_status, pc_data.status);

        const passed_btn = pc_item_li.querySelector('button[data-action="set-pc-passed"]');
        const failed_btn = pc_item_li.querySelector('button[data-action="set-pc-failed"]');
        if (passed_btn && failed_btn) {
            this._apply_status_button_active_state(passed_btn, current_pc_status === 'passed', {
                check_id,
                pc_id,
                action: 'set-pc-passed'
            });
            this._apply_status_button_active_state(failed_btn, current_pc_status === 'failed', {
                check_id,
                pc_id,
                action: 'set-pc-failed'
            });
        }

        const observation_wrapper = pc_item_li.querySelector('.pc-observation-detail-wrapper');
        const visibility_result = this._sync_observation_wrapper_visibility(
            observation_wrapper,
            overall_manual_status,
            pc_data,
            check_id,
            pc_id
        );

        if (sync_textarea_value) {
            const observation_textarea = pc_item_li.querySelector('textarea.pc-observation-detail-textarea');
            const active_el = env?.active_el_for_sync ?? document.activeElement;
            const sync_focus_root = env?.sync_focus_root
                ?? ((typeof this.get_dom_focus_sync_root === 'function' ? this.get_dom_focus_sync_root() : null)
                    || this.container_ref);
            const has_pc_observation_textarea_focus = env?.has_pc_observation_textarea_focus
                ?? this.has_active_pc_observation_focus();
            const is_this_focused = observation_textarea && active_el === observation_textarea;
            const typing_other = !is_this_focused && active_el instanceof HTMLElement
                && sync_focus_root?.contains(active_el)
                && (active_el.tagName === 'TEXTAREA' || active_el.tagName === 'INPUT')
                && !has_pc_observation_textarea_focus;
            const editing_elsewhere = has_pc_observation_textarea_focus && !is_this_focused;
            if (observation_textarea && current_pc_status === 'failed' && !is_this_focused
                && !typing_other && !editing_elsewhere) {
                const target_value = this._resolve_observation_target_for_textarea(
                    check_id,
                    pc_id,
                    pc_data,
                    overall_manual_status,
                    observation_textarea
                );
                this._sync_observation_textarea_from_target(
                    observation_textarea,
                    target_value,
                    check_id,
                    pc_id
                );
            }
        }

        const audit = audit_observation_ui({
            overall_manual_status,
            pc_status: pc_data.status,
            wrapper_visible: Boolean(observation_wrapper && !observation_wrapper.hidden),
            failed_button_active: failed_btn ? failed_btn.classList.contains('active') : null
        });
        if (audit.mismatch && is_debug_krav_vy()) {
            log_krav_vy_observation_ui_mismatch({
                context,
                check_id,
                pc_id,
                overall_status: overall_manual_status,
                pc_status_i_data: pc_data.status || 'not_audited',
                skäl: audit.reasons,
                effective_pc_status: audit.effective_pc_status,
                deferred_hide: visibility_result.deferred_hide,
                läkt: false
            });
        }

        return {
            healed: !audit.mismatch || visibility_result.deferred_hide,
            deferred_hide: visibility_result.deferred_hide
        };
    },

    _heal_all_checklist_ui_from_data(context = 'after_update_dom') {
        if (!this.container_ref || !this.requirement_result_ref?.checkResults) return;

        const sync_focus_root = (typeof this.get_dom_focus_sync_root === 'function'
            ? this.get_dom_focus_sync_root()
            : null) || this.container_ref;
        const env = {
            sync_focus_root,
            active_el_for_sync: document.activeElement,
            has_pc_observation_textarea_focus: this.has_active_pc_observation_focus()
        };
        const audit_frozen = this._audit_frozen_for_ui();
        let mismatch_count = 0;

        this.container_ref.querySelectorAll('.check-item[data-check-id]').forEach((check_wrapper) => {
            const check_id = check_wrapper.dataset.checkId;
            const check_result_data = read_check_stored_data(
                this.requirement_result_ref.checkResults,
                check_id
            );
            if (!check_result_data) return;

            const overall_manual_status = check_result_data.overallStatus || 'not_audited';
            const complies_btn = check_wrapper.querySelector('button[data-action="set-check-complies"]');
            const not_complies_btn = check_wrapper.querySelector('button[data-action="set-check-not-complies"]');
            if (complies_btn && not_complies_btn) {
                const heal_opts = { skip_if_unchanged: true };
                this._apply_status_button_active_state(complies_btn, overall_manual_status === 'passed', {
                    check_id,
                    pc_id: null,
                    action: 'set-check-complies'
                }, heal_opts);
                this._apply_status_button_active_state(not_complies_btn, overall_manual_status === 'not_applicable', {
                    check_id,
                    pc_id: null,
                    action: 'set-check-not-complies'
                }, heal_opts);
            }

            const pc_panel = check_wrapper.querySelector('.pass-criteria-panel');
            if (pc_panel && !is_check_panel_animation_blocked(check_id) && !is_panel_sync_blocked(pc_panel, check_id)) {
                const pc_count = pc_panel.querySelectorAll('.pass-criterion-item[data-pc-id]').length;
                this._set_criteria_panel_visibility(
                    check_wrapper,
                    pc_panel,
                    should_show_pass_criteria_list(overall_manual_status, pc_count),
                    { animate: false }
                );
            }

            check_wrapper.querySelectorAll('.pass-criterion-item[data-pc-id]').forEach((pc_item_li) => {
                const pc_id = pc_item_li.dataset.pcId;
                const heal_result = this._heal_pc_ui_from_data({
                    check_id,
                    pc_id,
                    pc_item_li,
                    check_result_data,
                    context,
                    sync_textarea_value: true,
                    env
                });
                if (!heal_result.healed) {
                    mismatch_count += 1;
                }
            });
        });

        // Bygg inte om hela checklist-DOM vid synk-mismatch — det förstör observations-textareas
        // som var dolda men fortfarande innehöll osparad text.
    },

    _register_hmr_dom_rebuild() {
        if (typeof import.meta === 'undefined' || !import.meta.hot) return;
        import.meta.hot.dispose(() => {
            this.is_dom_built = false;
        });
    },

    _remember_status_button_trigger(check_id, pc_id, action, trigger) {
        if (!this._status_button_triggers) {
            this._status_button_triggers = new Map();
        }
        const key = this._status_button_snapshot_key(check_id, pc_id, action);
        this._status_button_triggers.set(key, trigger);
    },

    _apply_status_button_active_state(button_el, should_be_active, { check_id, pc_id, action }, opts = {}) {
        if (!button_el) return;
        const was_active = button_el.classList.contains('active');
        const aria_pressed = button_el.getAttribute('aria-pressed') === 'true';
        const already_synced = was_active === should_be_active && aria_pressed === should_be_active;
        if (opts.skip_if_unchanged && already_synced) {
            return;
        }
        button_el.classList.toggle('active', should_be_active);
        button_el.setAttribute('aria-pressed', should_be_active ? 'true' : 'false');
        const is_active = button_el.classList.contains('active');
        if (was_active === is_active) return;

        const key = this._status_button_snapshot_key(check_id, pc_id, action);
        const trigger = this._status_button_triggers?.get(key) || null;
        if (trigger) {
            this._status_button_triggers.delete(key);
        }
        const flow_id = consume_krav_vy_dom_flow(key);
        if (!flow_id && !trigger) return;
        log_krav_vy_knapp('DOM/utseende uppdaterat', {
            flow_id: flow_id || null,
            knapp: this._status_button_label(action),
            action,
            check_id,
            pc_id: pc_id || null,
            tidigare: was_active ? 'markerad (aktiv färg)' : 'omarkerad',
            nytt: is_active ? 'markerad (aktiv färg)' : 'omarkerad',
            orsak: trigger?.source || 'annat (t.ex. synk eller omrendering)',
            händelse_typ: trigger?.event_type || null
        });
    },

    /**
     * Hittar status-/kryssknapp utan att sätta fokus (används för jämförelse vid återfokus).
     */
    _resolve_status_button_element(button_target) {
        if (!button_target || !this.container_ref) return null;

        let search_root = this.container_ref;
        if (button_target.check_id) {
            const check_selector = `.check-item[data-check-id="${CSS.escape(button_target.check_id)}"]`;
            const check_item = this.container_ref.querySelector(check_selector);
            if (check_item) search_root = check_item;
        }
        if (button_target.pc_id) {
            const pc_selector = `.pass-criterion-item[data-pc-id="${CSS.escape(button_target.pc_id)}"]`;
            const pc_item = search_root.querySelector(pc_selector);
            if (pc_item) search_root = pc_item;
        }

        const button_el = search_root.querySelector(`button[data-action="${CSS.escape(button_target.action)}"]`);
        const has_layout = button_el && typeof button_el.getClientRects === 'function'
            ? button_el.getClientRects().length > 0
            : false;

        if (!button_el || !has_layout || !document.contains(button_el)) return null;
        return button_el;
    },

    /**
     * Återapplicerar väntande kryssfokus bara när fokus saknas eller redan ligger på rätt knapp —
     * inte när användaren flyttat fokus till kommentar, navigering eller annan kontroll.
     */
    _reapply_pending_status_button_focus() {
        const pending = get_pending_checklist_focus_target();
        if (!pending?.action || !this.container_ref) return;
        if (typeof pending.set_at !== 'number' || Date.now() - pending.set_at > 5000) return;

        const target = { action: pending.action, check_id: pending.check_id, pc_id: pending.pc_id };
        const pending_btn = this._resolve_status_button_element(target);

        const ae = document.activeElement;
        if (ae && ae !== document.body && ae !== document.documentElement) {
            const has_layout = typeof ae.getClientRects === 'function' ? ae.getClientRects().length > 0 : true;
            if (has_layout && document.contains(ae)) {
                if (!this.container_ref.contains(ae)) {
                    return;
                }
                const tag = ae.tagName?.toLowerCase();
                if (tag === 'textarea' || tag === 'input' || tag === 'select') {
                    return;
                }
                if (tag === 'button' || tag === 'a') {
                    return;
                }
                return;
            }
        }

        if (!pending_btn) return;
        try {
            pending_btn.focus({ preventScroll: true });
        } catch (e) {
            pending_btn.focus();
        }
    },

    _try_focus_button_target(button_target) {
        const button_to_focus = this._resolve_status_button_element(button_target);
        if (!button_to_focus) return false;
        try {
            button_to_focus.focus({ preventScroll: true });
        } catch (e) {
            button_to_focus.focus();
        }
        return true;
    },

    _should_skip_focus_restore_to_button(button_target) {
        if (!button_target || !this.container_ref) return false;
        const active = document.activeElement;
        if (!active || !this.container_ref.contains(active)) return false;
        const tag = active.tagName?.toLowerCase();
        if (tag === 'textarea' || tag === 'input' || tag === 'select') return true;
        if (tag === 'button' || tag === 'a') return true;
        return false;
    },

    _restore_focus_to_button_if_needed(button_target) {
        if (!button_target || !this.container_ref) return;
        requestAnimationFrame(() => {
            const active = document.activeElement;
            if (active && this.container_ref.contains(active)) {
                // Om fokuset ligger kvar på ett element som blivit dolt (t.ex. via `hidden`
                // eller `display:none`) ska vi ändå återställa fokus, annars kan skärmläsare
                // hoppa till sidstart/andra “fallback”-fokus.
                const has_layout = typeof active.getClientRects === 'function'
                    ? active.getClientRects().length > 0
                    : false;
                if (has_layout) return;
            }
            let search_root = this.container_ref;
            if (button_target.check_id) {
                const check_selector = `.check-item[data-check-id="${CSS.escape(button_target.check_id)}"]`;
                const check_item = this.container_ref.querySelector(check_selector);
                if (check_item) {
                    search_root = check_item;
                }
            }
            if (button_target.pc_id) {
                const pc_selector = `.pass-criterion-item[data-pc-id="${CSS.escape(button_target.pc_id)}"]`;
                const pc_item = search_root.querySelector(pc_selector);
                if (pc_item) {
                    search_root = pc_item;
                }
            }
            const button_to_focus = search_root.querySelector(`button[data-action="${CSS.escape(button_target.action)}"]`);
            if (!button_to_focus || !document.contains(button_to_focus)) return;
            try {
                button_to_focus.focus({ preventScroll: true });
            } catch (e) {
                button_to_focus.focus();
            }
        });
    },

    _restore_focus_to_button_with_retry(button_target, { restore_custom_flag_to = null } = {}) {
        if (!button_target || !this.container_ref) return;

        // Hindrar att `update_dom()` försöker fokusera textarea när den visas/döljs.
        // `restore_custom_flag_to` används när anroparen redan satt `customFocusApplied` före dispatch/render.
        const prev_custom_focus_applied = restore_custom_flag_to !== null && restore_custom_flag_to !== undefined
            ? restore_custom_flag_to
            : window.customFocusApplied;
        window.customFocusApplied = true;

        const try_focus = () => {
            if (!this.container_ref) return;
            if (this._should_skip_focus_restore_to_button(button_target)) return;
            this._try_focus_button_target(button_target);
        };

        try_focus();
        queueMicrotask(try_focus);

        // Kort fönster så markdown-verktyg m.m. inte blockeras för länge.
        setTimeout(() => { window.customFocusApplied = prev_custom_focus_applied; }, 650);
    },

    // --- HELPER FUNCTION ---
    _safe_parse_markdown_inline(markdown_string) {
        if (typeof marked === 'undefined' || !this.Helpers.escape_html) {
            return this.Helpers.escape_html(markdown_string);
        }

        const renderer = new marked.Renderer();
        renderer.link = (href, title, text) => {
            const safe_href = this.Helpers.escape_html(href);
            const safe_text = this.Helpers.escape_html(text);
            return `<a href="${safe_href}" target="_blank" rel="noopener noreferrer">${safe_text}</a>`;
        };
        // Escape raw HTML code so it shows as text, but respect markdown-generated HTML
        renderer.html = (html_token) => {
            const text_to_escape = (typeof html_token === 'object' && html_token !== null && typeof html_token.text === 'string')
                ? html_token.text
                : String(html_token || '');
            return this.Helpers.escape_html(text_to_escape);
        };

        const parsed_markdown = marked.parse(String(markdown_string || ''), { renderer, breaks: true, gfm: true });
        
        // Use sanitize_html if available for extra security
        if (this.Helpers.sanitize_html) {
            return this.Helpers.sanitize_html(parsed_markdown);
        }
        
        return parsed_markdown;
    },

    _get_plain_text_from_html(html_string) {
        const div = document.createElement('div');
        div.innerHTML = html_string || '';
        return (div.textContent || div.innerText || '').trim();
    },

    _button_aria_label_with_context(button_label, context_plain) {
        const label = typeof button_label === 'string' ? button_label.trim() : '';
        const ctx = typeof context_plain === 'string' ? context_plain.trim() : '';
        if (!ctx) return label || '';
        if (!label) return ctx;
        return `${label}: ${ctx}`;
    },

    _create_audit_toggle_button({ button_classes, action, aria_label, label_text, icon_status }) {
        const icon_kind = icon_status === 'passed' ? 'passed' : 'failed';
        const button = this.Helpers.create_element('button', {
            class_name: button_classes,
            attributes: {
                type: 'button',
                'data-action': action,
                'aria-pressed': 'false',
                'aria-label': aria_label
            }
        });
        button.appendChild(this.Helpers.create_element('span', {
            class_name: 'audit-toggle-button__icon',
            text_content: get_status_icon(icon_kind),
            attributes: { 'aria-hidden': 'true' }
        }));
        button.appendChild(this.Helpers.create_element('span', {
            class_name: 'audit-toggle-button__label',
            text_content: label_text
        }));
        return button;
    },

    init(_container, _callbacks, options = {}) {
        this.container_ref = _container;
        this.on_status_change_callback = _callbacks.onStatusChange;
        this.on_observation_change_callback = _callbacks.onObservationChange;
        this.on_observation_change_immediate_callback = _callbacks.onObservationChangeImmediate || null;
        this.on_observation_blur_commit_callback = _callbacks.onObservationBlurCommit || null;
        this.on_before_status_change_sync_callback = _callbacks.onBeforeStatusChangeSync || null;
        this.on_stuck_description_saved_callback = _callbacks.onStuckDescriptionSaved || null;
        this._observation_focus_snapshots = new Map();
        this._observation_dom_cache = new Map();
        this._observation_hidden_with_text_keys = new Set();
        this._status_button_triggers = new Map();
        this._status_change_flights = new Set();
        this.is_dom_built = false;

        const deps = options.deps || {};
        this.Translation = deps.Translation || window.Translation;
        this.Helpers = deps.Helpers || window.Helpers;
        this.get_observations_from_other_samples = options.getObservationsFromOtherSamples || (() => []);
        this.get_dom_focus_sync_root = typeof options.getDomFocusSyncRoot === 'function'
            ? options.getDomFocusSyncRoot
            : null;
        this.get_is_audit_frozen = typeof options.getIsAuditFrozen === 'function'
            ? options.getIsAuditFrozen
            : null;
        this.get_is_audit_archived = typeof options.getIsAuditArchived === 'function'
            ? options.getIsAuditArchived
            : null;
        this.lock_helpers = options.lockHelpers || null;
        this.get_audit_id = typeof options.getAuditId === 'function' ? options.getAuditId : null;
        this.get_sample_id = typeof options.getSampleId === 'function' ? options.getSampleId : null;
        this.get_requirement_map_key = typeof options.getRequirementMapKey === 'function' ? options.getRequirementMapKey : null;
        this.get_pc_observation_draft = typeof options.getPcObservationDraft === 'function'
            ? options.getPcObservationDraft
            : null;
        this.on_observation_draft_update_callback = _callbacks.onObservationDraftUpdate || null;
        this.on_observation_hide_commit_callback = _callbacks.onObservationHideCommit || null;

        // Bind handlers to this instance
        this.handle_checklist_click = this.handle_checklist_click.bind(this);
        this.handle_textarea_input = this.handle_textarea_input.bind(this);
        this.handle_attach_media_click = this.handle_attach_media_click.bind(this);
        this.handle_stuck_click = this.handle_stuck_click.bind(this);
        this.handle_copy_observation_click = this.handle_copy_observation_click.bind(this);
        this.handle_pc_observation_focusin = this.handle_pc_observation_focusin.bind(this);
        this.handle_pc_observation_focusout = this.handle_pc_observation_focusout.bind(this);
        this.handle_status_button_pointerdown = this.handle_status_button_pointerdown.bind(this);
        this.handle_observation_flush_pointerdown = this.handle_observation_flush_pointerdown.bind(this);

        this.container_ref.addEventListener('pointerdown', this.handle_observation_flush_pointerdown, true);
        this.container_ref.addEventListener('pointerdown', this.handle_status_button_pointerdown, true);
        this.container_ref.addEventListener('click', this.handle_checklist_click);
        this.container_ref.addEventListener('input', this.handle_textarea_input);
        this.container_ref.addEventListener('focusin', this.handle_pc_observation_focusin);
        this.container_ref.addEventListener('focusout', this.handle_pc_observation_focusout);
        this._register_hmr_dom_rebuild();
    },

    /**
     * True när fokus ligger i en observations-textarea för underkänt kriterium (används vid sparning till store).
     * @returns {boolean}
     */
    _get_pc_failure_template(check_id, pc_id) {
        const check_def = this.requirement_definition_ref?.checks?.find(
            (c) => String(c?.id ?? c?.key) === String(check_id)
        );
        const pc_def = find_pass_criterion_def_by_storage_id(check_def?.passCriteria, pc_id);
        return typeof pc_def?.failureStatementTemplate === 'string' ? pc_def.failureStatementTemplate : '';
    },

    _observation_cache_key(check_id, pc_id) {
        return `${String(check_id)}\0${String(pc_id)}`;
    },

    _cache_observation_text(check_id, pc_id, text) {
        if (!this._observation_dom_cache) {
            this._observation_dom_cache = new Map();
        }
        this._observation_dom_cache.set(this._observation_cache_key(check_id, pc_id), text);
    },

    _get_cached_observation_text(check_id, pc_id) {
        return this._observation_dom_cache?.get(this._observation_cache_key(check_id, pc_id));
    },

    _persist_observation_dom_value(check_id, pc_id, text) {
        this._cache_observation_text(check_id, pc_id, text);
        this._set_pc_observation_detail(
            this.requirement_result_ref?.checkResults,
            check_id,
            pc_id,
            text
        );
        if (typeof this.on_observation_draft_update_callback === 'function') {
            this.on_observation_draft_update_callback(check_id, pc_id, text);
        }
    },

    /** Läser alla observations-textareas (även dolda) till minne/utkast före klick eller statusändring. */
    _flush_all_observation_textareas_to_memory() {
        if (!this.container_ref || !this.requirement_result_ref?.checkResults) return;
        this.container_ref.querySelectorAll('textarea.pc-observation-detail-textarea').forEach((textarea) => {
            const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
            const check_item = textarea.closest('.check-item[data-check-id]');
            if (!pc_item || !check_item) return;
            const check_id = check_item.dataset.checkId;
            const pc_id = pc_item.dataset.pcId;
            this._persist_observation_dom_value(check_id, pc_id, textarea.value ?? '');
        });
    },

    _resolve_observation_target_for_textarea(check_id, pc_id, pc_data, overall_manual_status, observation_textarea = null) {
        if (this._observation_was_hidden_with_user_text(check_id, pc_id)) {
            return this._pick_user_observation_text(check_id, pc_id, observation_textarea);
        }
        const dom_value = observation_textarea?.value ?? '';
        if (String(dom_value).trim()) {
            return dom_value;
        }
        const cached = this._get_cached_observation_text(check_id, pc_id);
        if (typeof cached === 'string' && String(cached).trim()) {
            return cached;
        }
        const draft = typeof this.get_pc_observation_draft === 'function'
            ? this.get_pc_observation_draft(check_id, pc_id)
            : undefined;
        if (typeof draft === 'string' && String(draft).trim()) {
            return draft;
        }
        const store_value = pc_data?.observationDetail ?? '';
        if (String(store_value).trim()) {
            return store_value;
        }
        if (effective_pc_status(overall_manual_status, pc_data?.status) === 'failed') {
            const template = this._get_pc_failure_template(check_id, pc_id);
            if (template) return template;
        }
        return '';
    },

    _should_apply_observation_textarea_sync(observation_textarea, target_value, should_sync_obs, overall_manual_status, pc_status, check_id, pc_id) {
        if (!should_sync_obs || !observation_textarea) return false;
        if (effective_pc_status(overall_manual_status, pc_status) !== 'failed') {
            return false;
        }
        const current = observation_textarea.value ?? '';
        const target = target_value ?? '';
        if (String(current).trim() && current !== target) {
            this._persist_observation_dom_value(check_id, pc_id, current);
            return false;
        }
        if (String(target).trim() === '' && String(current).trim() !== '') {
            return false;
        }
        return current !== target;
    },

    _sync_observation_textarea_from_target(observation_textarea, target_value, check_id, pc_id) {
        if (!observation_textarea || observation_textarea.value === target_value) return;
        observation_textarea.value = target_value;
        this._persist_observation_dom_value(check_id, pc_id, target_value);
        if (this.Helpers?.init_auto_resize_for_textarea) {
            this.Helpers.init_auto_resize_for_textarea(observation_textarea);
        }
    },

    _set_pc_observation_detail(check_results, check_id, pc_id, text) {
        if (!check_results) return;
        const chk = resolve_map_entry(check_results, check_id);
        const check_result = chk?.value;
        if (!check_result) return;
        if (!check_result.passCriteria || typeof check_result.passCriteria !== 'object') {
            check_result.passCriteria = {};
        }
        const pc = resolve_map_entry(check_result.passCriteria, pc_id);
        if (pc?.value && typeof pc.value === 'object' && pc.value !== null) {
            pc.value.observationDetail = text;
            return;
        }
        const status = typeof pc?.value === 'string' ? pc.value : 'not_audited';
        const storage_key = pc?.storageKey ?? String(pc_id);
        check_result.passCriteria[storage_key] = {
            status,
            observationDetail: text,
            timestamp: null,
            attachedMediaFilenames: []
        };
    },

    handle_observation_flush_pointerdown() {
        this._flush_all_observation_textareas_to_memory();
    },

    handle_status_button_pointerdown(event) {
        const button = event.target?.closest?.('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        if (
            action !== 'set-check-complies' &&
            action !== 'set-check-not-complies' &&
            action !== 'set-pc-passed' &&
            action !== 'set-pc-failed'
        ) {
            return;
        }
        if (typeof this.on_before_status_change_sync_callback === 'function') {
            this.on_before_status_change_sync_callback();
        }
    },

    has_active_pc_observation_focus() {
        if (!this.container_ref) return false;
        const el = document.activeElement;
        if (!el || el.tagName?.toLowerCase() !== 'textarea') return false;
        if (!this.container_ref.contains(el)) return false;
        return el.classList.contains('pc-observation-detail-textarea');
    },

    handle_pc_observation_focusin(event) {
        const textarea = event.target;
        if (!textarea?.classList?.contains('pc-observation-detail-textarea')) return;
        const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
        const check_item = textarea.closest('.check-item[data-check-id]');
        if (!pc_item || !check_item) return;
        
        const check_id = check_item.dataset.checkId;
        const pc_id = pc_item.dataset.pcId;
        const key = `${check_id}::${pc_id}`;
        this._observation_focus_snapshots.set(key, textarea.value ?? '');
        
        if (this.lock_helpers && this.get_audit_id && this.get_sample_id && this.get_requirement_map_key) {
            const audit_id = this.get_audit_id();
            const sample_id = this.get_sample_id();
            const req_id = this.get_requirement_map_key();
            if (audit_id && sample_id && req_id) {
                const part_key = this.lock_helpers.makeObservationDetailPartKey(audit_id, sample_id, req_id, check_id, pc_id);
                void this.lock_helpers.tryAcquireLock({ audit_id, part_key });
            }
        }
    },

    handle_pc_observation_focusout(event) {
        const textarea = event.target;
        if (!textarea?.classList?.contains('pc-observation-detail-textarea')) return;
        const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
        const check_item = textarea.closest('.check-item[data-check-id]');
        if (!pc_item || !check_item || !this.requirement_result_ref?.checkResults) return;
        const check_id = check_item.dataset.checkId;
        const pc_id = pc_item.dataset.pcId;
        const key = `${check_id}::${pc_id}`;
        const current = textarea.value ?? '';

        this._persist_observation_dom_value(check_id, pc_id, current);

        if (this.lock_helpers && this.get_audit_id && this.get_sample_id && this.get_requirement_map_key) {
            const audit_id = this.get_audit_id();
            const sample_id = this.get_sample_id();
            const req_id = this.get_requirement_map_key();
            if (audit_id && sample_id && req_id) {
                const part_key = this.lock_helpers.makeObservationDetailPartKey(audit_id, sample_id, req_id, check_id, pc_id);
                void this.lock_helpers.releaseLock({ audit_id, part_key });
            }
        }
        if (!this._observation_focus_snapshots.has(key)) {
            const check_result_data = read_check_stored_data(this.requirement_result_ref.checkResults, check_id);
            const stored_data = read_pc_stored_data(check_result_data, pc_id);
            const stored_observation = stored_data?.observationDetail ?? '';
            if (current !== stored_observation && this.on_observation_blur_commit_callback) {
                this.on_observation_blur_commit_callback();
            }
            this._schedule_heal_pc_after_focus_left(check_id, pc_id, pc_item);
            return;
        }
        const snapshot = this._observation_focus_snapshots.get(key);
        this._observation_focus_snapshots.delete(key);
        const schedule_heal = () => this._schedule_heal_pc_after_focus_left(check_id, pc_id, pc_item);
        if (snapshot === current) {
            schedule_heal();
            return;
        }

        if (this.requirement_result_ref?.checkResults) {
            const chk_resolved = resolve_map_entry(this.requirement_result_ref.checkResults, check_id);
            const check_result = chk_resolved?.value;
            const pc_resolved = check_result?.passCriteria
                ? resolve_map_entry(check_result.passCriteria, pc_id)
                : null;
            const pc_entry = pc_resolved?.value;
            if (pc_entry && typeof pc_entry === 'object') {
                const ts = this.Helpers?.get_current_iso_datetime_utc
                    ? this.Helpers.get_current_iso_datetime_utc()
                    : new Date().toISOString();
                pc_entry.timestamp = ts;
                pc_entry.updatedBy = get_current_user_name();
            }
        }
        if (this.on_observation_blur_commit_callback) {
            this.on_observation_blur_commit_callback();
        }
        queueMicrotask(schedule_heal);
    },

    _schedule_heal_pc_after_focus_left(check_id, pc_id, pc_item_li) {
        requestAnimationFrame(() => {
            if (!pc_item_li?.isConnected || !this.requirement_result_ref?.checkResults) return;
            const check_result_data = read_check_stored_data(
                this.requirement_result_ref.checkResults,
                check_id
            );
            if (!check_result_data) return;
            this._heal_pc_ui_from_data({
                check_id,
                pc_id,
                pc_item_li,
                check_result_data,
                context: 'observation_focusout',
                sync_textarea_value: false
            });
        });
    },
    
    handle_checklist_click(event) {
        const attach_btn = event.target.closest('button[data-action="attach-media"]');
        if (attach_btn) {
            this.handle_attach_media_click(event, attach_btn);
            return;
        }

        const stuck_btn = event.target.closest('button[data-action="stuck"]');
        if (stuck_btn) {
            this.handle_stuck_click(event, stuck_btn);
            return;
        }

        const copy_obs_btn = event.target.closest('button[data-action="copy-observation"]');
        if (copy_obs_btn) {
            this.handle_copy_observation_click(event, copy_obs_btn);
            return;
        }

        const target_button = event.target.closest('button[data-action]');
        if (!target_button) {
            return;
        }

        const action = target_button.dataset.action;
        const check_item_element = target_button.closest('.check-item[data-check-id]');
        const pc_item_element = target_button.closest('.pass-criterion-item[data-pc-id]');
        const button_focus_target = this._build_button_focus_target(target_button);
        
        if (!check_item_element) return;
        const check_id = check_item_element.dataset.checkId;

        const change_info = { type: null, checkId: check_id };

        if (action === 'set-check-complies') {
            change_info.type = 'check_overall_status_change';
            change_info.newStatus = 'passed';
        } else if (action === 'set-check-not-complies') {
            change_info.type = 'check_overall_status_change';
            change_info.newStatus = 'not_applicable';
        } else if (pc_item_element) {
            const pc_id = pc_item_element.dataset.pcId;
            change_info.pcId = pc_id;
            if (action === 'set-pc-passed') {
                change_info.type = 'pc_status_change';
                change_info.newStatus = 'passed';
            } else if (action === 'set-pc-failed') {
                change_info.type = 'pc_status_change';
                change_info.newStatus = 'failed';
            }
        }
        
        if (change_info.type && this.on_status_change_callback) {
            if (!this._acquire_status_change_flight(check_id, change_info.pcId || null)) {
                return;
            }
            const release_status_change_flight = () => {
                this._release_status_change_flight(check_id, change_info.pcId || null);
            };

            this._apply_optimistic_status_button_ui(change_info);

            const trigger = {
                source: this._detect_user_event_source(event),
                event_type: event.type,
                is_trusted: event.isTrusted,
                pointer_type: event.pointerType || null
            };
            change_info.trigger = trigger;
            const flow_id = start_krav_vy_knapp_flow({
                knapp: this._status_button_label(action),
                action,
                check_id,
                pc_id: change_info.pcId || null,
                orsak: trigger.source,
                händelse_typ: trigger.event_type,
                is_trusted: trigger.is_trusted,
                pointer_type: trigger.pointer_type
            });
            change_info.flow_id = flow_id;
            this._remember_status_button_trigger(check_id, change_info.pcId || null, action, trigger);
            register_krav_vy_knapp_dom_watch(
                flow_id,
                this._status_button_snapshot_key(check_id, change_info.pcId || null, action)
            );
            if (action === 'set-check-complies' || action === 'set-check-not-complies') {
                const sibling_action = action === 'set-check-complies' ? 'set-check-not-complies' : 'set-check-complies';
                this._remember_status_button_trigger(check_id, null, sibling_action, trigger);
                register_krav_vy_knapp_dom_watch(
                    flow_id,
                    this._status_button_snapshot_key(check_id, null, sibling_action)
                );
            } else if (action === 'set-pc-passed' || action === 'set-pc-failed') {
                const sibling_action = action === 'set-pc-passed' ? 'set-pc-failed' : 'set-pc-passed';
                this._remember_status_button_trigger(check_id, change_info.pcId, sibling_action, trigger);
                register_krav_vy_knapp_dom_watch(
                    flow_id,
                    this._status_button_snapshot_key(check_id, change_info.pcId, sibling_action)
                );
            }

            const should_keep_focus_on_status_button = change_info.type === 'check_overall_status_change' ||
                (change_info.type === 'pc_status_change' &&
                    (change_info.newStatus === 'passed' || change_info.newStatus === 'failed'));
            // Måste sättas före callback: `update_dom()` anropas synkront vid dispatch och kan annars
            // flytta fokus till textarea innan återställningen hinner sätta skyddet.
            const prev_custom_focus_flag = window.customFocusApplied;
            if (should_keep_focus_on_status_button) {
                window.customFocusApplied = true;
                set_pending_checklist_focus_target({
                    action: button_focus_target.action,
                    check_id: button_focus_target.check_id,
                    pc_id: button_focus_target.pc_id,
                    set_at: Date.now()
                });
            }
            const callback_result = this.on_status_change_callback(change_info);
            if (callback_result != null && typeof callback_result.then === 'function') {
                callback_result.catch((e) => {
                    if (window.ConsoleManager?.warn) {
                        window.ConsoleManager.warn('[ChecklistHandler] onStatusChange:', e);
                    }
                }).finally(() => {
                    release_status_change_flight();
                    if (should_keep_focus_on_status_button) {
                        this._restore_focus_to_button_with_retry(button_focus_target, {
                            restore_custom_flag_to: prev_custom_focus_flag
                        });
                    }
                });
            } else {
                release_status_change_flight();
                if (should_keep_focus_on_status_button) {
                    this._restore_focus_to_button_with_retry(button_focus_target, {
                        restore_custom_flag_to: prev_custom_focus_flag
                    });
                }
            }
        }
    },

    handle_attach_media_click(event, attach_btn) {
        event.preventDefault();
        const pc_item = attach_btn.closest('.pass-criterion-item[data-pc-id]');
        const check_item = attach_btn.closest('.check-item[data-check-id]');
        if (!pc_item || !check_item) return;

        const pc_id = pc_item.dataset.pcId;
        const check_id = check_item.dataset.checkId;

        const ModalComponent = app_runtime_refs.modal_component;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;

        const t = this.Translation.t;
        ModalComponent.show(
            {
                h1_text: t('attach_media_modal_h1'),
                message_text: t('attach_media_modal_intro')
            },
            (container, modal) => {
                const form_group = this.Helpers.create_element('div', { class_name: 'form-group' });
                const label = this.Helpers.create_element('label', {
                    attributes: { for: 'attach-media-filenames' },
                    text_content: t('attach_media_modal_filename_label')
                });
                form_group.appendChild(label);

                const chk_open = resolve_map_entry(this.requirement_result_ref?.checkResults, check_id);
                const check_open = chk_open?.value;
                const pc_open = check_open?.passCriteria
                    ? resolve_map_entry(check_open.passCriteria, pc_id)
                    : null;
                const existing_filenames = pc_open?.value?.attachedMediaFilenames;
                const initial_text = Array.isArray(existing_filenames) ? existing_filenames.join('\n') : '';
                const textarea = this.Helpers.create_element('textarea', {
                    id: 'attach-media-filenames',
                    class_name: 'form-control',
                    attributes: { rows: '3' }
                });
                textarea.value = initial_text;
                if (this.Helpers?.init_auto_resize_for_textarea) {
                    this.Helpers.init_auto_resize_for_textarea(textarea);
                }
                form_group.appendChild(textarea);
                container.appendChild(form_group);

                const actions_wrapper = this.Helpers.create_element('div', { class_name: 'modal-attach-media-actions' });
                const save_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('attach_media_modal_save')
                });
                save_btn.addEventListener('click', () => {
                    const filenames = textarea.value
                        .split('\n')
                        .map(s => s.trim())
                        .filter(Boolean);
                    const chk_save = resolve_map_entry(this.requirement_result_ref?.checkResults, check_id);
                    const check_result = chk_save?.value;
                    const pc_save = check_result?.passCriteria
                        ? resolve_map_entry(check_result.passCriteria, pc_id)
                        : null;
                    if (pc_save?.value) {
                        pc_save.value.attachedMediaFilenames = filenames;
                        if (this.on_observation_change_callback) {
                            this.on_observation_change_callback();
                        }
                        // Uppdatera bifoga-media-knappens text/aria direkt (annars väntar UI tills annat fokus triggar update_dom).
                        this.update_dom();
                    }
                    modal.close(attach_btn);
                });
                const discard_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    attributes: { type: 'button' },
                    text_content: t('attach_media_modal_discard')
                });
                discard_btn.addEventListener('click', () => {
                    modal.close(attach_btn);
                });
                actions_wrapper.appendChild(save_btn);
                actions_wrapper.appendChild(discard_btn);
                container.appendChild(actions_wrapper);
            }
        );
    },

    handle_stuck_click(event, stuck_btn) {
        event.preventDefault();
        if (!this.requirement_result_ref) return;

        const ModalComponent = app_runtime_refs.modal_component;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;

        const t = this.Translation.t;
        const existing_description = (typeof this.requirement_result_ref.stuckProblemDescription === 'string')
            ? this.requirement_result_ref.stuckProblemDescription
            : '';

        ModalComponent.show(
            {
                h1_text: t('stuck_modal_h1'),
                message_text: t('stuck_modal_intro')
            },
            (container, modal) => {
                const form_group = this.Helpers.create_element('div', { class_name: 'form-group' });
                const label = this.Helpers.create_element('label', {
                    attributes: { for: 'stuck-problem-description' },
                    text_content: t('stuck_modal_label')
                });
                form_group.appendChild(label);

                const textarea = this.Helpers.create_element('textarea', {
                    id: 'stuck-problem-description',
                    class_name: 'form-control',
                    attributes: { rows: '5' }
                });
                textarea.value = existing_description;
                if (this.Helpers?.init_auto_resize_for_textarea) {
                    this.Helpers.init_auto_resize_for_textarea(textarea);
                }
                form_group.appendChild(textarea);
                container.appendChild(form_group);

                const actions_wrapper = this.Helpers.create_element('div', { class_name: 'modal-attach-media-actions' });
                const save_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('stuck_modal_save')
                });
                save_btn.addEventListener('click', () => {
                    const raw = textarea.value || '';
                    const description = this.Helpers?.trim_textarea_preserve_lines
                        ? this.Helpers.trim_textarea_preserve_lines(raw)
                        : raw.trim();
                    this.requirement_result_ref.stuckProblemDescription = description;
                    this.requirement_result_ref.lastStatusUpdate = this.Helpers?.get_current_iso_datetime_utc?.() || new Date().toISOString();
                    this.requirement_result_ref.lastStatusUpdateBy = get_current_user_name();
                    if (is_debug_stuck_sync()) {
                        consoleManager.log('[GV-Debug] Modal: Spara klickad, textlängd:', description.length);
                    }
                    if (this.on_stuck_description_saved_callback) {
                        this.on_stuck_description_saved_callback();
                    } else if (this.on_observation_change_callback) {
                        this.on_observation_change_callback();
                    }
                    modal.close(stuck_btn);
                });
                const discard_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    attributes: { type: 'button' },
                    text_content: t('stuck_modal_discard')
                });
                discard_btn.addEventListener('click', () => {
                    modal.close(stuck_btn);
                });
                actions_wrapper.appendChild(save_btn);
                actions_wrapper.appendChild(discard_btn);
                if ((existing_description || '').trim() !== '') {
                    const problem_solved_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-default', 'modal-action-right'],
                        attributes: { type: 'button' },
                        text_content: t('stuck_modal_problem_solved')
                    });
                    problem_solved_btn.addEventListener('click', () => {
                        this.requirement_result_ref.stuckProblemDescription = '';
                        this.requirement_result_ref.lastStatusUpdate = this.Helpers?.get_current_iso_datetime_utc?.() || new Date().toISOString();
                        this.requirement_result_ref.lastStatusUpdateBy = get_current_user_name();
                        if (is_debug_stuck_sync()) {
                            consoleManager.log('[GV-Debug] Modal: Problemet är löst klickad');
                        }
                        if (this.on_stuck_description_saved_callback) {
                            this.on_stuck_description_saved_callback();
                        } else if (this.on_observation_change_callback) {
                            this.on_observation_change_callback();
                        }
                        modal.close(stuck_btn);
                    });
                    actions_wrapper.appendChild(problem_solved_btn);
                }
                container.appendChild(actions_wrapper);
            }
        );
    },

    handle_copy_observation_click(event, copy_btn) {
        event.preventDefault();
        const pc_item = copy_btn.closest('.pass-criterion-item[data-pc-id]');
        const check_item = copy_btn.closest('.check-item[data-check-id]');
        if (!pc_item || !check_item) return;

        const pc_id = pc_item.dataset.pcId;
        const check_id = check_item.dataset.checkId;
        const observations = this.get_observations_from_other_samples(check_id, pc_id);

        const ModalComponent = app_runtime_refs.modal_component;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;

        const t = this.Translation.t;

        if (observations.length === 0) {
            ModalComponent.show(
                {
                    h1_text: t('copy_observation_modal_title'),
                    message_text: t('copy_observation_modal_empty')
                },
                (container, modal) => {
                    const close_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-default'],
                        attributes: { type: 'button' },
                        text_content: t('copy_observation_modal_close')
                    });
                    close_btn.addEventListener('click', () => modal.close(copy_btn));
                    container.appendChild(close_btn);
                }
            );
            return;
        }

        ModalComponent.show(
            {
                h1_text: t('copy_observation_modal_title'),
                message_text: ''
            },
            (container, modal) => {
                const fieldset = this.Helpers.create_element('fieldset', {
                    class_name: 'copy-observation-radio-group',
                    attributes: { 'aria-label': t('copy_observation_modal_title') }
                });
                const radio_name = `copy-observation-${check_id}-${pc_id}`;
                observations.forEach((text, index) => {
                    const id = `copy-obs-${check_id}-${pc_id}-${index}`;
                    const label = this.Helpers.create_element('label', {
                        class_name: 'copy-observation-radio-option',
                        attributes: { for: id }
                    });
                    const radio = this.Helpers.create_element('input', {
                        attributes: {
                            type: 'radio',
                            name: radio_name,
                            id,
                            value: String(index),
                            checked: index === 0
                        }
                    });
                    const text_span = this.Helpers.create_element('span', { class_name: 'copy-observation-radio-text', text_content: text });
                    label.appendChild(radio);
                    label.appendChild(text_span);
                    fieldset.appendChild(label);
                });
                container.appendChild(fieldset);

                const actions_wrapper = this.Helpers.create_element('div', { class_name: 'modal-copy-observation-actions' });
                const paste_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    attributes: { type: 'button' },
                    text_content: t('copy_observation_modal_paste')
                });
                paste_btn.addEventListener('click', () => {
                    const selected = container.querySelector(`input[name="${CSS.escape(radio_name)}"]:checked`);
                    if (selected) {
                        const idx = parseInt(selected.value, 10);
                        const text_to_paste = observations[idx];
                        const textarea_id = `pc-observation-${check_id}-${pc_id}`;
                        const textarea = this.container_ref.querySelector(`#${CSS.escape(textarea_id)}`);
                        if (textarea && typeof text_to_paste === 'string') {
                            const chk_paste = resolve_map_entry(this.requirement_result_ref?.checkResults, check_id);
                            const check_result_paste = chk_paste?.value;
                            const pc_paste = check_result_paste?.passCriteria
                                ? resolve_map_entry(check_result_paste.passCriteria, pc_id)
                                : null;
                            if (pc_paste?.value) {
                                pc_paste.value.observationDetail = text_to_paste;
                                const ts = this.Helpers?.get_current_iso_datetime_utc
                                    ? this.Helpers.get_current_iso_datetime_utc()
                                    : new Date().toISOString();
                                pc_paste.value.timestamp = ts;
                                pc_paste.value.updatedBy = get_current_user_name();
                            }
                            textarea.value = text_to_paste;
                            if (this.on_observation_blur_commit_callback) {
                                this.on_observation_blur_commit_callback();
                            }
                        }
                    }
                    modal.close(copy_btn);
                });
                const close_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    attributes: { type: 'button' },
                    text_content: t('copy_observation_modal_close')
                });
                close_btn.addEventListener('click', () => modal.close(copy_btn));
                actions_wrapper.appendChild(paste_btn);
                actions_wrapper.appendChild(close_btn);
                container.appendChild(actions_wrapper);
            }
        );
    },
    
    handle_textarea_input(event) {
        const textarea = event.target;
        if (!textarea.classList.contains('pc-observation-detail-textarea')) return;
        
        const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
        const check_item = textarea.closest('.check-item[data-check-id]');
        if (pc_item && check_item && this.requirement_result_ref?.checkResults) {
            const check_id = check_item.dataset.checkId;
            const pc_id = pc_item.dataset.pcId;
            const chk_in = resolve_map_entry(this.requirement_result_ref.checkResults, check_id);
            const check_result_in = chk_in?.value;
            const pc_in = check_result_in?.passCriteria
                ? resolve_map_entry(check_result_in.passCriteria, pc_id)
                : null;
            this._set_pc_observation_detail(
                this.requirement_result_ref.checkResults,
                check_id,
                pc_id,
                textarea.value ?? ''
            );
            if (event.type === 'input') {
                log_krav_vy_textarea('Textarea input (lokal state)', {
                    fält: 'Observation',
                    check_id,
                    pc_id,
                    värde_längd: (textarea.value || '').length
                });
                if (this.on_observation_change_callback) {
                    this.on_observation_change_callback();
                }
            }
        }
    },

    _create_update_badge(type) {
        const t = this.Translation.t;
        const is_new = type === 'new';
        const label = is_new ? t('pass_criterion_badge_new') : t('pass_criterion_badge_updated');
        const icon_svg = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('update', ['currentColor'], 14) : '';
        const span = this.Helpers.create_element('span', {
            class_name: `pass-criterion-update-badge pass-criterion-update-badge--${type}`,
            attributes: { 'aria-hidden': 'true' }
        });
        if (icon_svg) {
            const icon_wrapper = document.createElement('span');
            icon_wrapper.setAttribute('aria-hidden', 'true');
            icon_wrapper.innerHTML = icon_svg;
            span.appendChild(icon_wrapper);
        }
        span.appendChild(document.createTextNode(' ' + label));
        return span;
    },

    _get_pc_result_data(check_result_data, pc_id) {
        return check_result_data?.passCriteria?.[pc_id]
            ?? check_result_data?.passCriteria?.[String(pc_id)]
            ?? { status: 'not_audited', observationDetail: '' };
    },

    _sync_pass_criterion_deficiency_id_on_title(pc_title_h4, audit_frozen, pc_status, deficiency_id) {
        const t = this.Translation.t;
        const show = should_show_deficiency_id_in_title(audit_frozen, pc_status, deficiency_id);
        let el = pc_title_h4.querySelector('.pass-criterion-deficiency-id');
        if (!show) {
            el?.remove();
            return;
        }
        const label = format_deficiency_id_label(deficiency_id, t);
        if (!label) {
            el?.remove();
            return;
        }
        if (!el) {
            el = this.Helpers.create_element('span', { class_name: 'pass-criterion-deficiency-id' });
            pc_title_h4.appendChild(el);
        }
        el.textContent = label;
    },

    _set_pass_criterion_title_aria_label(pc_title_h4, criterion_title, pc_status_text, audit_frozen, pc_status, deficiency_id) {
        const t = this.Translation.t;
        const parts = [criterion_title, pc_status_text];
        if (should_show_deficiency_id_in_title(audit_frozen, pc_status, deficiency_id)) {
            const def_label = format_deficiency_id_label(deficiency_id, t);
            if (def_label) parts.push(def_label);
        }
        pc_title_h4.setAttribute('aria-label', parts.join('. '));
    },

    _create_pass_criterion_title_h4({ numbering, check_id, pc_id, check_result_data, details }) {
        const t = this.Translation.t;
        const audit_frozen = this._audit_frozen_for_ui();
        const pc_data = this._get_pc_result_data(check_result_data, pc_id);
        const current_pc_status = pc_data.status || 'not_audited';
        const criterion_title = `${t('pass_criterion_label')} ${numbering}`;
        const pc_status_text = t(`audit_status_${current_pc_status}`);

        const pc_title_h4 = this.Helpers.create_element('h4', { class_name: 'pass-criterion-title' });
        const title_main = this.Helpers.create_element('span', { class_name: 'pass-criterion-title-main' });
        title_main.appendChild(this.Helpers.create_element('strong', { text_content: criterion_title }));

        const in_added = check_id && pc_id && details?.added?.some(e => e.checkId === check_id && e.passCriterionId === pc_id);
        const in_updated = check_id && pc_id && details?.updated?.some(e => e.checkId === check_id && e.passCriterionId === pc_id);
        if (in_added) {
            title_main.appendChild(document.createTextNode(' '));
            title_main.appendChild(this._create_update_badge('new'));
        } else if (in_updated) {
            title_main.appendChild(document.createTextNode(' '));
            title_main.appendChild(this._create_update_badge('updated'));
        }
        pc_title_h4.appendChild(title_main);
        this._sync_pass_criterion_deficiency_id_on_title(pc_title_h4, audit_frozen, current_pc_status, pc_data.deficiencyId);
        this._set_pass_criterion_title_aria_label(
            pc_title_h4, criterion_title, pc_status_text, audit_frozen, current_pc_status, pc_data.deficiencyId
        );
        return pc_title_h4;
    },

    build_initial_dom() {
        const t = this.Translation.t;
        const details = this.requirement_update_details;
        this._flush_all_observation_textareas_to_memory();
        this.container_ref.innerHTML = '';

        if (!this.requirement_definition_ref?.checks?.length) {
            this.container_ref.appendChild(this.Helpers.create_element('p', { class_name: 'text-muted', text_content: t('no_checks_for_this_requirement') }));
            this.is_dom_built = true;
            return;
        }

        const checks_region = this.Helpers.create_element('section', {
            class_name: 'checks-container',
            attributes: {
                role: 'region',
                'aria-label': t('checks_landmark_label')
            }
        });

        const checks_header_row = this.Helpers.create_element('div', { class_name: 'checks-header-row' });
        const checks_h2 = this.Helpers.create_element('h2', { text_content: t('checks_title') });
        const checks_header_actions = this.Helpers.create_element('div', { class_name: 'checks-header-actions' });
        checks_header_row.appendChild(checks_h2);
        checks_header_row.appendChild(checks_header_actions);
        checks_region.appendChild(checks_header_row);

        this.requirement_definition_ref.checks.forEach((check_definition, check_index) => {
            const check_id = check_definition?.id ?? check_definition?.key;
            const check_result_data = this.requirement_result_ref?.checkResults?.[check_id]
                ?? this.requirement_result_ref?.checkResults?.[String(check_id)];
            const check_wrapper = this.Helpers.create_element('div', { 
                class_name: 'check-item',
                attributes: {'data-check-id': check_id }
            });

            const check_title_label = `${t('check_item_title')} ${check_index + 1}`;
            const condition_h3 = this.Helpers.create_element('h3', { class_name: 'check-condition-title' });
            condition_h3.textContent = check_title_label;
            if (check_id && details?.addedChecks?.includes(check_id)) {
                condition_h3.appendChild(document.createTextNode(' '));
                condition_h3.appendChild(this._create_update_badge('new'));
            }
            check_wrapper.appendChild(condition_h3);

            const condition_text_div = this.Helpers.create_element('div', {
                class_name: ['check-condition-text', 'markdown-content'],
                html_content: this._safe_parse_markdown_inline(check_definition.condition)
            });
            check_wrapper.appendChild(condition_text_div);

            const condition_plain = this._get_plain_text_from_html(
                this._safe_parse_markdown_inline(check_definition.condition || '')
            );
            const complies_aria = this._button_aria_label_with_context(t('check_complies'), condition_plain);
            const not_complies_aria = this._button_aria_label_with_context(t('check_does_not_comply'), condition_plain);
            
            const actions_div = this.Helpers.create_element('div', {
                class_name: 'condition-actions'
            });
            actions_div.append(
                this._create_audit_toggle_button({
                    button_classes: ['button', 'button-success', 'button-small'],
                    action: 'set-check-complies',
                    aria_label: complies_aria,
                    label_text: t('check_complies'),
                    icon_status: 'passed'
                }),
                this._create_audit_toggle_button({
                    button_classes: ['button', 'button-danger', 'button-small'],
                    action: 'set-check-not-complies',
                    aria_label: not_complies_aria,
                    label_text: t('check_does_not_comply'),
                    icon_status: 'failed'
                })
            );
            check_wrapper.appendChild(actions_div);
            
            check_wrapper.appendChild(this.Helpers.create_element('p', { class_name: 'check-status-display', attributes: { 'aria-hidden': 'true' } }));
            
            const pc_panel = this.Helpers.create_element('div', {
                class_name: 'criteria-panel pass-criteria-panel'
            });
            const pc_inner = this.Helpers.create_element('div', { class_name: 'criteria-panel__inner' });
            const pc_list = this.Helpers.create_element('ul', { class_name: 'pass-criteria-list' });
            const overall_for_pc_list = check_result_data?.overallStatus || 'not_audited';
            const should_show_pc_list = should_show_pass_criteria_list(
                overall_for_pc_list,
                (check_definition.passCriteria || []).length
            );
            pc_panel.hidden = !should_show_pc_list;
            pc_panel.classList.toggle(PANEL_OPEN_CLASS, should_show_pc_list);
            pc_inner.appendChild(pc_list);
            pc_panel.appendChild(pc_inner);
            (check_definition.passCriteria || []).forEach((pc_def, pc_index) => {
                const pc_id = pc_def?.id ?? pc_def?.key;
                const pc_item_li = this.Helpers.create_element('li', { 
                    class_name: 'pass-criterion-item', 
                    attributes: {'data-pc-id': pc_id }
                });

                const numbering = `${check_index + 1}.${pc_index + 1}`;
                pc_item_li.appendChild(this._create_pass_criterion_title_h4({
                    numbering,
                    check_id,
                    pc_id,
                    check_result_data,
                    details
                }));

                const requirement_content_div = this.Helpers.create_element('div', {
                    class_name: ['pass-criterion-requirement', 'markdown-content'],
                    html_content: this._safe_parse_markdown_inline(pc_def.requirement)
                });
                pc_item_li.appendChild(requirement_content_div);
                // Använd renderad (plain) text som påståendetext så skärmläsaren får samma innehåll som användaren ser.
                const requirement_plain = this._get_plain_text_from_html(
                    this._safe_parse_markdown_inline(pc_def.requirement)
                );
                
                pc_item_li.appendChild(this.Helpers.create_element('div', {
                    class_name: 'pass-criterion-status',
                    attributes: { 'aria-live': 'polite', 'aria-atomic': 'true' }
                }));

                const pc_actions_div = this.Helpers.create_element('div', {
                    class_name: 'pass-criterion-actions'
                });
                const passed_aria = this._button_aria_label_with_context(t('pass_criterion_approved'), requirement_plain);
                const failed_aria = this._button_aria_label_with_context(t('pass_criterion_failed'), requirement_plain);
                pc_actions_div.append(
                    this._create_audit_toggle_button({
                        button_classes: ['button', 'button-success', 'button-small'],
                        action: 'set-pc-passed',
                        aria_label: passed_aria,
                        label_text: t('pass_criterion_approved'),
                        icon_status: 'passed'
                    }),
                    this._create_audit_toggle_button({
                        button_classes: ['button', 'button-danger', 'button-small'],
                        action: 'set-pc-failed',
                        aria_label: failed_aria,
                        label_text: t('pass_criterion_failed'),
                        icon_status: 'failed'
                    })
                );
                pc_item_li.appendChild(pc_actions_div);

                const observation_wrapper = this.Helpers.create_element('div', { class_name: 'pc-observation-detail-wrapper form-group' });
                const observation_label = this.Helpers.create_element('label', { 
                    attributes: { for: `pc-observation-${check_id}-${pc_id}` }, 
                    text_content: t('pc_observation_detail_label') 
                });
                observation_wrapper.appendChild(observation_label);
                
                const observation_hint = this.Helpers.create_element('div', { class_name: 'lock-hint text-muted' });
                observation_hint.id = `lock-hint-${check_id}-${pc_id}`;
                observation_hint.style.fontSize = '0.85em';
                observation_hint.style.fontWeight = 'bold';
                observation_hint.style.color = '#d32f2f';
                observation_hint.setAttribute('aria-live', 'polite');
                observation_wrapper.appendChild(observation_hint);

                const pc_data_init = read_pc_stored_data(check_result_data, pc_id);
                const observation_textarea = this.Helpers.create_element('textarea', {
                    id: `pc-observation-${check_id}-${pc_id}`,
                    class_name: 'form-control pc-observation-detail-textarea',
                    attributes: { rows: '4' }
                });
                const cached_observation = this._pick_user_observation_text(check_id, pc_id);
                if (cached_observation) {
                    observation_textarea.value = cached_observation;
                } else if (pc_data_init.observationDetail) {
                    observation_textarea.value = pc_data_init.observationDetail;
                }
                observation_wrapper.appendChild(observation_textarea);

                const attach_media_row = this.Helpers.create_element('div', { class_name: 'pc-attach-media-row' });
                const copy_observation_row = this.Helpers.create_element('div', { class_name: 'pc-copy-observation-row', attributes: { hidden: 'hidden' } });
                const copy_observation_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small'],
                    attributes: {
                        'data-action': 'copy-observation',
                        'data-check-id': check_id,
                        'data-pc-id': pc_id,
                        type: 'button',
                        'aria-label': t('copy_observation_from_other_button')
                    },
                    text_content: t('copy_observation_from_other_button')
                });
                copy_observation_row.appendChild(copy_observation_btn);
                attach_media_row.appendChild(copy_observation_row);
                const criterion_title = `${t('pass_criterion_label')} ${numbering}`;
                const pc_result = this.requirement_result_ref?.checkResults?.[check_id]?.passCriteria?.[pc_id];
                const attached_filenames = Array.isArray(pc_result?.attachedMediaFilenames)
                    ? pc_result.attachedMediaFilenames.filter(f => f && String(f).trim())
                    : [];
                const attached_count = attached_filenames.length;
                const attach_btn_label = attached_count > 0
                    ? t('edit_attached_media_button', { count: attached_count })
                    : t('attach_media_button');
                const attach_aria_label = `${attach_btn_label} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`;
                const image_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('image', ['currentColor'], 16) : '';
                const video_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('videocam', ['currentColor'], 16) : '';
                const attach_icons_html = (image_icon || video_icon)
                    ? `<span class="attach-media-button-icons" aria-hidden="true">${image_icon}${video_icon}</span>`
                    : '';
                const attach_media_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small'],
                    attributes: {
                        'data-action': 'attach-media',
                        'data-check-id': check_id,
                        'data-pc-id': pc_id,
                        type: 'button',
                        'aria-label': attach_aria_label
                    },
                    html_content: `<span>${this.Helpers.escape_html(attach_btn_label)}</span>${attach_icons_html}`
                });
                attach_media_row.appendChild(attach_media_btn);

                observation_wrapper.appendChild(attach_media_row);

                this._sync_observation_wrapper_visibility(
                    observation_wrapper,
                    overall_for_pc_list,
                    pc_data_init,
                    check_id,
                    pc_id
                );

                const is_first_criterion = check_index === 0 && pc_index === 0;
                if (is_first_criterion) {
                    const has_stuck_content = (this.requirement_result_ref?.stuckProblemDescription || '').trim() !== '';
                    const stuck_aria_label = has_stuck_content
                        ? `${t('stuck_button')} ${t('stuck_button_has_content')} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`
                        : `${t('stuck_button')} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`;
                    const warning_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('warning', ['currentColor'], 16) : '';
                    const indicator_html = has_stuck_content
                        ? ` <span class="stuck-button-indicator">${this.Helpers.escape_html(t('stuck_button_has_content'))}</span>`
                        : '';
                    const stuck_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-default', 'button-small', 'stuck-button', ...(has_stuck_content ? ['stuck-button--has-content'] : [])],
                        attributes: {
                            'data-action': 'stuck',
                            'data-check-id': check_id,
                            'data-pc-id': pc_id,
                            type: 'button',
                            'aria-label': stuck_aria_label
                        },
                        html_content: `<span>${this.Helpers.escape_html(t('stuck_button'))}${indicator_html}</span>${warning_icon ? `<span class="stuck-button-icon" aria-hidden="true">${warning_icon}</span>` : ''}`
                    });
                    checks_header_actions.appendChild(stuck_btn);
                }

                pc_item_li.appendChild(observation_wrapper);
                pc_list.appendChild(pc_item_li);
            });
            check_wrapper.appendChild(pc_panel);

            const compliance_panel = this.Helpers.create_element('div', {
                class_name: 'criteria-panel compliance-info-panel'
            });
            const compliance_inner = this.Helpers.create_element('div', { class_name: 'criteria-panel__inner' });
            compliance_inner.appendChild(this.Helpers.create_element('p', {
                class_name: 'text-muted compliance-info-text',
                style: 'font-style: italic;'
            }));
            compliance_panel.appendChild(compliance_inner);
            compliance_panel.hidden = true;
            check_wrapper.appendChild(compliance_panel);
            
            checks_region.appendChild(check_wrapper);
        });

        this.container_ref.appendChild(checks_region);

        this.is_dom_built = true;
    },

    update_dom() {
        const patch_scope = this._patch_scope || null;

        if (patch_scope?.mode === 'pc_only' && patch_scope.check_id && patch_scope.pc_id) {
            const check_wrapper = this.container_ref?.querySelector(
                `.check-item[data-check-id="${CSS.escape(String(patch_scope.check_id))}"]`
            );
            if (check_wrapper) {
                this._update_dom_single_check_wrapper(check_wrapper, patch_scope.pc_id, {
                    force_status_button_sync: true
                });
            }
            this._heal_all_checklist_ui_from_data('after_update_dom_pc_only');
            this._reapply_pending_status_button_focus();
            return;
        }

        if (patch_scope?.mode === 'check_and_pcs' && patch_scope.check_id) {
            this._update_dom_check_and_pass_criteria(patch_scope.check_id);
            this._heal_all_checklist_ui_from_data('after_update_dom_check_and_pcs');
            this._reapply_pending_status_button_focus();
            return;
        }

        this._update_dom_full();
        this._heal_all_checklist_ui_from_data('after_update_dom_full');
        this._reapply_pending_status_button_focus();
    },

    /**
     * Minimalt: bara godkännandekriteriets knapppar + observationsfält vid kriterium-klick.
     */
    _update_dom_pc_only(check_id, pc_id) {
        const t = this.Translation.t;
        const check_wrapper = this.container_ref?.querySelector(
            `.check-item[data-check-id="${CSS.escape(String(check_id))}"]`
        );
        const pc_item_li = check_wrapper?.querySelector(
            `.pass-criterion-item[data-pc-id="${CSS.escape(String(pc_id))}"]`
        );
        if (!check_wrapper || !pc_item_li) {
            return;
        }

        const check_result_data = read_check_stored_data(
            this.requirement_result_ref.checkResults,
            check_id
        );
        const overall_manual_status = check_result_data?.overallStatus || 'not_audited';
        const pc_data = read_pc_stored_data(check_result_data, pc_id);
        const current_pc_status = effective_pc_status(overall_manual_status, pc_data.status);

        const passed_btn = pc_item_li.querySelector('button[data-action="set-pc-passed"]');
        const failed_btn = pc_item_li.querySelector('button[data-action="set-pc-failed"]');
        if (passed_btn && failed_btn) {
            this._apply_status_button_active_state(passed_btn, current_pc_status === 'passed', {
                check_id,
                pc_id,
                action: 'set-pc-passed'
            });
            this._apply_status_button_active_state(failed_btn, current_pc_status === 'failed', {
                check_id,
                pc_id,
                action: 'set-pc-failed'
            });
        }

        const observation_wrapper = pc_item_li.querySelector('.pc-observation-detail-wrapper');
        this._sync_observation_wrapper_visibility(
            observation_wrapper,
            overall_manual_status,
            pc_data,
            check_id,
            pc_id
        );

        const observation_textarea = pc_item_li.querySelector('textarea.pc-observation-detail-textarea');
        const restored_after_show = observation_textarea
            ? this._restore_observation_textarea_after_show(check_id, pc_id, observation_textarea)
            : false;
        if (observation_textarea && current_pc_status === 'failed' && !restored_after_show
            && !this._observation_was_hidden_with_user_text(check_id, pc_id)) {
            const target_value = this._resolve_observation_target_for_textarea(
                check_id,
                pc_id,
                pc_data,
                overall_manual_status,
                observation_textarea
            );
            if (this._should_apply_observation_textarea_sync(
                observation_textarea,
                target_value,
                true,
                overall_manual_status,
                pc_data.status,
                check_id,
                pc_id
            )) {
                this._sync_observation_textarea_from_target(
                    observation_textarea,
                    target_value,
                    check_id,
                    pc_id
                );
            } else if (this.Helpers?.init_auto_resize_for_textarea) {
                this.Helpers.init_auto_resize_for_textarea(observation_textarea);
            }
        }

        const audit_frozen = this._audit_frozen_for_ui();
        const copy_observation_row = pc_item_li.querySelector('.pc-copy-observation-row');
        if (copy_observation_row) {
            const observations = this.get_observations_from_other_samples(check_id, pc_id);
            copy_observation_row.hidden = !(observations.length > 0 && current_pc_status === 'failed' && !audit_frozen);
        }

    },

    /**
     * Kontrollpunkt-klick: uppdatera bara den kontrollpunktens kriterielista (inte andra kontrollpunkter).
     */
    _update_dom_check_and_pass_criteria(check_id) {
        const all_check_wrappers = this.container_ref.querySelectorAll('.check-item[data-check-id]');
        const check_wrapper = [...all_check_wrappers].find(
            (wrapper) => wrapper.dataset.checkId === String(check_id)
        );
        if (!check_wrapper) {
            return;
        }
        this._update_dom_single_check_wrapper(check_wrapper, null);
    },

    _update_dom_full() {
        const t = this.Translation.t;
        const audit_frozen = this._audit_frozen_for_ui();
        const audit_archived = this._audit_archived_for_ui();
        const patch_scope = null;
        const sync_focus_root = (typeof this.get_dom_focus_sync_root === 'function' ? this.get_dom_focus_sync_root() : null)
            || this.container_ref;
        const active_el_for_sync = document.activeElement;
        const any_textarea_or_input_focused_in_sync_root = Boolean(
            active_el_for_sync && sync_focus_root?.contains(active_el_for_sync) &&
                (active_el_for_sync.tagName === 'TEXTAREA' || active_el_for_sync.tagName === 'INPUT')
        );
        const has_pc_observation_textarea_focus = this.has_active_pc_observation_focus();

        const all_check_wrappers = this.container_ref.querySelectorAll('.check-item[data-check-id]');
        all_check_wrappers.forEach((check_wrapper) => {
            this._update_dom_single_check_wrapper(
                check_wrapper,
                null,
                {
                    audit_frozen,
                    audit_archived,
                    sync_focus_root,
                    active_el_for_sync,
                    any_textarea_or_input_focused_in_sync_root,
                    has_pc_observation_textarea_focus
                }
            );
        });

        this._update_dom_stuck_button(t);
    },

    _update_dom_stuck_button(t) {
        const stuck_btn = this.container_ref.querySelector('.stuck-button');
        if (!stuck_btn) return;
        const has_stuck_content = (this.requirement_result_ref?.stuckProblemDescription || '').trim() !== '';
        const check_id = stuck_btn.getAttribute('data-check-id');
        const pc_id = stuck_btn.getAttribute('data-pc-id');
        const check_def = this.requirement_definition_ref?.checks?.find(c => (c?.id || c?.key) === check_id);
        const pc_def = check_def?.passCriteria?.find(p => (p?.id || p?.key) === pc_id);
        const numbering = check_def && pc_def
            ? `${(this.requirement_definition_ref.checks?.indexOf(check_def) ?? 0) + 1}.${(check_def.passCriteria?.indexOf(pc_def) ?? 0) + 1}`
            : '';
        const criterion_title = `${t('pass_criterion_label')} ${numbering}`;
        const requirement_plain = this._get_plain_text_from_html(
            this._safe_parse_markdown_inline(this.requirement_definition_ref?.title || '')
        );
        const stuck_aria_label = has_stuck_content
            ? `${t('stuck_button')} ${t('stuck_button_has_content')} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`
            : `${t('stuck_button')} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`;
        stuck_btn.setAttribute('aria-label', stuck_aria_label);
        stuck_btn.classList.toggle('stuck-button--has-content', has_stuck_content);
        const text_span = stuck_btn.querySelector('span:first-child');
        if (text_span) {
            const indicator_html = has_stuck_content
                ? ` <span class="stuck-button-indicator">${this.Helpers.escape_html(t('stuck_button_has_content'))}</span>`
                : '';
            text_span.innerHTML = this.Helpers.escape_html(t('stuck_button')) + indicator_html;
        }
    },

    _update_dom_single_check_wrapper(check_wrapper, pc_id_filter, env = null) {
        const t = this.Translation.t;
        const audit_frozen = env?.audit_frozen ?? this._audit_frozen_for_ui();
        const audit_archived = env?.audit_archived ?? this._audit_archived_for_ui();
        const sync_focus_root = env?.sync_focus_root
            ?? ((typeof this.get_dom_focus_sync_root === 'function' ? this.get_dom_focus_sync_root() : null) || this.container_ref);
        const active_el_for_sync = env?.active_el_for_sync ?? document.activeElement;
        const any_textarea_or_input_focused_in_sync_root = env?.any_textarea_or_input_focused_in_sync_root ?? Boolean(
            active_el_for_sync && sync_focus_root?.contains(active_el_for_sync) &&
                (active_el_for_sync.tagName === 'TEXTAREA' || active_el_for_sync.tagName === 'INPUT')
        );
        const has_pc_observation_textarea_focus = env?.has_pc_observation_textarea_focus
            ?? this.has_active_pc_observation_focus();

        const check_id = check_wrapper.dataset.checkId;
            const check_result_data = read_check_stored_data(
                this.requirement_result_ref.checkResults,
                check_id
            );
            const calculated_check_status = check_result_data?.status || 'not_audited';
            const overall_manual_status = check_result_data?.overallStatus || 'not_audited';

            check_wrapper.className = `check-item status-${calculated_check_status}`;

            const check_def_top = this.requirement_definition_ref?.checks?.find(c => (c?.id || c?.key) === check_id);
            const condition_plain_for_aria = check_def_top
                ? this._get_plain_text_from_html(this._safe_parse_markdown_inline(check_def_top.condition || ''))
                : '';

            const complies_btn = check_wrapper.querySelector('button[data-action="set-check-complies"]');
            const not_complies_btn = check_wrapper.querySelector('button[data-action="set-check-not-complies"]');
            
            if (complies_btn && not_complies_btn) {
                const heal_opts = env?.force_status_button_sync ? {} : { skip_if_unchanged: true };
                this._apply_status_button_active_state(complies_btn, overall_manual_status === 'passed', {
                    check_id,
                    pc_id: null,
                    action: 'set-check-complies'
                }, heal_opts);
                this._apply_status_button_active_state(not_complies_btn, overall_manual_status === 'not_applicable', {
                    check_id,
                    pc_id: null,
                    action: 'set-check-not-complies'
                }, heal_opts);
                complies_btn.setAttribute(
                    'aria-label',
                    this._button_aria_label_with_context(t('check_complies'), condition_plain_for_aria)
                );
                not_complies_btn.setAttribute(
                    'aria-label',
                    this._button_aria_label_with_context(t('check_does_not_comply'), condition_plain_for_aria)
                );
                complies_btn.parentElement.style.display = audit_frozen ? 'none' : 'flex';
            }
            
            const condition_h3 = check_wrapper.querySelector('.check-condition-title');
            const status_text = t(`audit_status_${calculated_check_status}`);
            const title_text = condition_h3.textContent.trim();
            condition_h3.setAttribute('aria-label', `${title_text}. ${status_text.toLowerCase()}`);

            const status_text_container = check_wrapper.querySelector('.check-status-display');
            status_text_container.innerHTML = '';
            status_text_container.setAttribute('aria-hidden', 'true');
            const strong_element = this.Helpers.create_element('strong', { text_content: t('check_status') });
            status_text_container.appendChild(strong_element);
            status_text_container.appendChild(document.createTextNode(': '));
            const status_span = this.Helpers.create_element('span', { 
                class_name: `status-text status-${calculated_check_status}`, 
                text_content: status_text 
            });
            status_text_container.appendChild(status_span);
            
            const pc_panel = check_wrapper.querySelector('.pass-criteria-panel');
            const compliance_panel = check_wrapper.querySelector('.compliance-info-panel');
            const compliance_info_text = compliance_panel?.querySelector('.compliance-info-text');

            if (pc_panel && !is_check_panel_animation_blocked(check_id) && !is_panel_sync_blocked(pc_panel, check_id)) {
                const pc_count = pc_panel.querySelectorAll('.pass-criterion-item[data-pc-id]').length;
                this._set_criteria_panel_visibility(
                    check_wrapper,
                    pc_panel,
                    should_show_pass_criteria_list(overall_manual_status, pc_count),
                    { animate: false }
                );
            }
            if (overall_manual_status === 'not_applicable' && compliance_info_text) {
                compliance_info_text.textContent = t('condition_not_met_criteria_auto_passed');
            }
            if (compliance_panel && !is_check_panel_animation_blocked(check_id) && !is_panel_sync_blocked(compliance_panel, check_id)) {
                this._set_criteria_panel_visibility(
                    check_wrapper,
                    compliance_panel,
                    overall_manual_status === 'not_applicable',
                    { animate: false }
                );
            }

            check_wrapper.querySelectorAll('.pass-criterion-item[data-pc-id]').forEach(pc_item_li => {
                const pc_id = pc_item_li.dataset.pcId;
                if (pc_id_filter && pc_id !== String(pc_id_filter)) {
                    return;
                }
                const pc_data = read_pc_stored_data(check_result_data, pc_id);
                const current_pc_status = effective_pc_status(overall_manual_status, pc_data.status);

                const pc_status_text_container = pc_item_li.querySelector('.pass-criterion-status');
                pc_status_text_container.innerHTML = '';
                pc_status_text_container.setAttribute('aria-hidden', 'true');
                const pc_status_text = t(`audit_status_${current_pc_status}`);
                const pc_strong_element = this.Helpers.create_element('strong', { text_content: t('status') });
                pc_status_text_container.appendChild(pc_strong_element);
                pc_status_text_container.appendChild(document.createTextNode(': '));
                const pc_status_span = this.Helpers.create_element('span', { 
                    class_name: `status-text status-${current_pc_status}`, 
                    text_content: pc_status_text 
                });
                pc_status_text_container.appendChild(pc_status_span);

                const pc_title_h4 = pc_item_li.querySelector('.pass-criterion-title');
                if (pc_title_h4) {
                    const check_def = this.requirement_definition_ref?.checks?.find(c => (c?.id || c?.key) === check_id);
                    const pc_def = check_def?.passCriteria?.find(p => (p?.id || p?.key) === pc_id);
                    const check_idx = check_def ? (this.requirement_definition_ref.checks?.indexOf(check_def) ?? 0) : 0;
                    const pc_idx = pc_def ? (check_def?.passCriteria?.indexOf(pc_def) ?? 0) : 0;
                    const numbering = `${check_idx + 1}.${pc_idx + 1}`;
                    const criterion_title = `${t('pass_criterion_label')} ${numbering}`;
                    this._sync_pass_criterion_deficiency_id_on_title(
                        pc_title_h4, audit_frozen, current_pc_status, pc_data.deficiencyId
                    );
                    this._set_pass_criterion_title_aria_label(
                        pc_title_h4, criterion_title, pc_status_text, audit_frozen, current_pc_status, pc_data.deficiencyId
                    );
                }

                const passed_btn = pc_item_li.querySelector('button[data-action="set-pc-passed"]');
                const failed_btn = pc_item_li.querySelector('button[data-action="set-pc-failed"]');

                if (passed_btn && failed_btn) {
                    const heal_opts = env?.force_status_button_sync ? {} : { skip_if_unchanged: true };
                    this._apply_status_button_active_state(passed_btn, current_pc_status === 'passed', {
                        check_id,
                        pc_id,
                        action: 'set-pc-passed'
                    }, heal_opts);
                    this._apply_status_button_active_state(failed_btn, current_pc_status === 'failed', {
                        check_id,
                        pc_id,
                        action: 'set-pc-failed'
                    }, heal_opts);
                    const pc_def_aria = this.requirement_definition_ref?.checks
                        ?.find(c => (c?.id || c?.key) === check_id)
                        ?.passCriteria?.find(p => (p?.id || p?.key) === pc_id);
                    const requirement_plain_aria = this._get_plain_text_from_html(
                        this._safe_parse_markdown_inline(pc_def_aria?.requirement || '')
                    );
                    passed_btn.setAttribute(
                        'aria-label',
                        this._button_aria_label_with_context(t('pass_criterion_approved'), requirement_plain_aria)
                    );
                    failed_btn.setAttribute(
                        'aria-label',
                        this._button_aria_label_with_context(t('pass_criterion_failed'), requirement_plain_aria)
                    );
                    passed_btn.parentElement.style.display = audit_frozen ? 'none' : 'flex';
                }

                const observation_wrapper = pc_item_li.querySelector('.pc-observation-detail-wrapper');
                const update_observation_lock_ui = (textarea) => {
                    if (!textarea) return;
                    textarea.disabled = false;
                    let locked_by_other = false;
                    let remote_lock = null;
                    if (this.lock_helpers && this.get_audit_id && this.get_sample_id && this.get_requirement_map_key) {
                        const audit_id = this.get_audit_id();
                        const sample_id = this.get_sample_id();
                        const req_id = this.get_requirement_map_key();
                        if (audit_id && sample_id && req_id) {
                            const part_key = this.lock_helpers.makeObservationDetailPartKey(audit_id, sample_id, req_id, check_id, pc_id);
                            remote_lock = this.lock_helpers.getRemoteLock(part_key);
                            const my_client_lock_id = this.lock_helpers.ensureClientLockId(part_key);
                            locked_by_other = this.lock_helpers.isRemoteLockHeldByOtherUser(
                                remote_lock,
                                get_current_user_name(),
                                my_client_lock_id
                            );
                        }
                    }

                    const want_readonly = locked_by_other || audit_archived;
                    if (textarea.readOnly !== want_readonly) {
                        const had_focus = document.activeElement === textarea;
                        textarea.readOnly = want_readonly;
                        if (had_focus && !want_readonly) {
                            setTimeout(() => {
                                const active = document.activeElement;
                                if (active !== textarea && (active === document.body || active === null)) {
                                    textarea.focus({ preventScroll: true });
                                }
                            }, 0);
                        }
                    }
                    textarea.classList.toggle('readonly-textarea', want_readonly);

                    const wrapper = textarea.closest('.form-group');
                    if (wrapper) {
                        let hint_el = wrapper.querySelector('.lock-hint');
                        if (hint_el) {
                            if (locked_by_other) {
                                const display_name = remote_lock?.user_name || t('another_user');
                                hint_el.textContent = t('user_is_editing_field', { name: display_name });
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

                const observation_textarea = observation_wrapper ? observation_wrapper.querySelector('textarea.pc-observation-detail-textarea') : null;
                
                this._sync_observation_wrapper_visibility(
                    observation_wrapper,
                    overall_manual_status,
                    pc_data,
                    check_id,
                    pc_id
                );

                if (observation_textarea) {
                    update_observation_lock_ui(observation_textarea);
                }

                const restored_after_show = observation_textarea
                    ? this._restore_observation_textarea_after_show(check_id, pc_id, observation_textarea)
                    : false;

                const target_observation_value = this._resolve_observation_target_for_textarea(
                    check_id,
                    pc_id,
                    pc_data,
                    overall_manual_status,
                    observation_textarea
                );
                if (observation_textarea && !restored_after_show
                    && !this._observation_was_hidden_with_user_text(check_id, pc_id)) {
                    const is_this_focused = document.activeElement === observation_textarea;
                    const pc_observation_editing_elsewhere = has_pc_observation_textarea_focus && !is_this_focused;
                    const typing_other_field_in_plate = !is_this_focused && any_textarea_or_input_focused_in_sync_root
                        && !has_pc_observation_textarea_focus;
                    const should_sync_obs = !is_this_focused && !pc_observation_editing_elsewhere && !typing_other_field_in_plate;
                    if (this._should_apply_observation_textarea_sync(
                        observation_textarea,
                        target_observation_value,
                        should_sync_obs,
                        overall_manual_status,
                        pc_data.status,
                        check_id,
                        pc_id
                    )) {
                        this._sync_observation_textarea_from_target(
                            observation_textarea,
                            target_observation_value,
                            check_id,
                            pc_id
                        );
                    } else if (this.Helpers?.init_auto_resize_for_textarea) {
                        this.Helpers.init_auto_resize_for_textarea(observation_textarea);
                    }
                }

                const attach_media_btn = pc_item_li.querySelector('button[data-action="attach-media"]');
                if (attach_media_btn) {
                    const attached_filenames = Array.isArray(pc_data.attachedMediaFilenames)
                        ? pc_data.attachedMediaFilenames.filter(f => f && String(f).trim())
                        : [];
                    const attached_count = attached_filenames.length;
                    const attach_btn_label = attached_count > 0
                        ? t('edit_attached_media_button', { count: attached_count })
                        : t('attach_media_button');
                    const check_def = this.requirement_definition_ref?.checks?.find(c => (c?.id || c?.key) === check_id);
                    const pc_def = check_def?.passCriteria?.find(p => (p?.id || p?.key) === pc_id);
                    const check_idx = check_def ? (this.requirement_definition_ref.checks?.indexOf(check_def) ?? 0) : 0;
                    const pc_idx = pc_def ? (check_def?.passCriteria?.indexOf(pc_def) ?? 0) : 0;
                    const numbering = `${check_idx + 1}.${pc_idx + 1}`;
                    const criterion_title = `${t('pass_criterion_label')} ${numbering}`;
                    const requirement_plain = this._get_plain_text_from_html(
                        this._safe_parse_markdown_inline(pc_def?.requirement || '')
                    );
                    const attach_aria_label = `${attach_btn_label} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`;
                    attach_media_btn.setAttribute('aria-label', attach_aria_label);
                    const text_span = attach_media_btn.querySelector('span:first-child');
                    if (text_span) {
                        text_span.textContent = attach_btn_label;
                    }
                }

                const copy_observation_row = pc_item_li.querySelector('.pc-copy-observation-row');
                if (copy_observation_row) {
                    const observations = this.get_observations_from_other_samples(check_id, pc_id);
                    const should_show = observations.length > 0 && current_pc_status === 'failed' && !audit_frozen;
                    copy_observation_row.hidden = !should_show;
                }
            });
    },

    _requirement_definition_identity(requirement_definition) {
        if (!requirement_definition) {
            return '';
        }
        return String(requirement_definition.key ?? requirement_definition.id ?? '');
    },

    _resume_blocked_panel_animation(check_wrapper) {
        const check_id = check_wrapper?.dataset?.checkId;
        if (!check_id || !is_check_panel_animation_blocked(check_id)) {
            return;
        }
        const check_result_data = read_check_stored_data(
            this.requirement_result_ref?.checkResults,
            check_id
        );
        const overall_manual_status = check_result_data?.overallStatus || 'not_audited';
        const pc_panel = check_wrapper.querySelector('.pass-criteria-panel');
        if (pc_panel) {
            const pc_count = pc_panel.querySelectorAll('.pass-criterion-item[data-pc-id]').length;
            if (should_show_pass_criteria_list(overall_manual_status, pc_count) && !pc_panel.classList.contains('slide-down-in')) {
                pc_panel.hidden = false;
                pc_panel.classList.add(PANEL_OPEN_CLASS);
                pc_panel.classList.remove('slide-down-out');
                pc_panel.classList.add('slide-down-in');
                void pc_panel.offsetHeight;
            }
        }
        const compliance_panel = check_wrapper.querySelector('.compliance-info-panel');
        if (compliance_panel && overall_manual_status === 'not_applicable' && !compliance_panel.classList.contains('slide-down-in')) {
            compliance_panel.hidden = false;
            compliance_panel.classList.add(PANEL_OPEN_CLASS);
            compliance_panel.classList.remove('slide-down-out');
            compliance_panel.classList.add('slide-down-in');
            void compliance_panel.offsetHeight;
        }
    },

    render(requirement_definition, requirement_result, locked_status, update_details, patch_scope) {
        const next_def_id = this._requirement_definition_identity(requirement_definition);
        const prev_def_id = this._requirement_definition_identity(this.requirement_definition_ref);
        if (next_def_id !== prev_def_id) {
            this.is_dom_built = false;
            this._status_button_triggers = new Map();
        }
        this.requirement_definition_ref = requirement_definition;
        this.requirement_result_ref = requirement_result;
        this.is_audit_locked = locked_status;
        this.requirement_update_details = update_details || null;
        this._patch_scope = patch_scope || null;

        const current_lang = typeof this.Translation?.get_current_language_code === 'function'
            ? this.Translation.get_current_language_code()
            : null;
        if (this.last_language_code !== current_lang) {
            this.last_language_code = current_lang;
            this.is_dom_built = false;
        }

        if (
            this.is_dom_built
            && this.container_ref?.querySelector('.check-item .pass-criteria-list')
            && !this.container_ref.querySelector('.check-item .pass-criteria-panel')
        ) {
            this.is_dom_built = false;
        }

        if (!this.is_dom_built) {
            this.build_initial_dom();
        }

        this.update_dom();
        this.container_ref?.querySelectorAll('.check-item[data-check-id]').forEach((check_wrapper) => {
            this._resume_blocked_panel_animation(check_wrapper);
        });
        this._patch_scope = null;
    },

    /**
     * Synkar innehållet från alla observationstextareas i DOM till requirement_result_ref.
     * Anropas före sparning så att senaste textarea-värden följer med, och vid destroy/navigering.
     * @param {Object} options
     * @param {boolean} [options.trim=true] - om true trimmas värdena (vid navigering bort). Annars rå text.
     */
    flush_observations_before_destroy(options = {}) {
        const should_trim = options.trim !== false;
        if (!this.container_ref || !this.requirement_result_ref?.checkResults) return;
        const textareas = this.container_ref.querySelectorAll('textarea.pc-observation-detail-textarea');
        textareas.forEach((textarea) => {
            const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
            const check_item = textarea.closest('.check-item[data-check-id]');
            if (pc_item && check_item) {
                const check_id = check_item.dataset.checkId;
                const pc_id = pc_item.dataset.pcId;
                const chk_flush = resolve_map_entry(this.requirement_result_ref.checkResults, check_id);
                const check_result_flush = chk_flush?.value;
                const pc_flush = check_result_flush?.passCriteria
                    ? resolve_map_entry(check_result_flush.passCriteria, pc_id)
                    : null;
                const raw = textarea.value || '';
                const text_value = should_trim && this.Helpers?.trim_textarea_preserve_lines
                    ? this.Helpers.trim_textarea_preserve_lines(raw)
                    : should_trim ? raw.trim() : raw;
                this._set_pc_observation_detail(
                    this.requirement_result_ref.checkResults,
                    check_id,
                    pc_id,
                    text_value
                );
            }
        });
    },

    destroy() {
        if (this.container_ref) {
            this.flush_observations_before_destroy();
            this.container_ref.removeEventListener('pointerdown', this.handle_observation_flush_pointerdown, true);
            this.container_ref.removeEventListener('pointerdown', this.handle_status_button_pointerdown, true);
            this.container_ref.removeEventListener('click', this.handle_checklist_click);
            this.container_ref.removeEventListener('input', this.handle_textarea_input);
            this.container_ref.removeEventListener('focusin', this.handle_pc_observation_focusin);
            this.container_ref.removeEventListener('focusout', this.handle_pc_observation_focusout);
            this.container_ref.innerHTML = '';
        }
        this._observation_focus_snapshots = new Map();
        this._observation_dom_cache = new Map();
        this._observation_hidden_with_text_keys = new Set();
        this._status_button_triggers = new Map();
        this._status_change_flights = new Set();
        this.is_dom_built = false;
        this.get_dom_focus_sync_root = null;
        this.get_is_audit_archived = null;
        this.get_is_audit_frozen = null;
        this.get_pc_observation_draft = null;
        this.container_ref = null;
    }
};

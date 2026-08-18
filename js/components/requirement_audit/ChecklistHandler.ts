/**
 * @fileoverview ChecklistHandler — checklista för kravgranskning (klass + singleton).
 */

import { vite_register_hmr_dispose } from '../../utils/vite_import_meta_hot.js';
import {
    read_check_stored_data,
    should_show_pass_criteria_list
} from './checklist_observation_visibility.js';
import {
    is_check_panel_animation_blocked,
    PANEL_OPEN_CLASS
} from './criteria_panel.js';
import { has_active_pc_observation_focus } from './checklist_event_handlers.js';
import type { StatusChangeInfo } from './checklist_event_handler_types.js';
import type { ChecklistLockHelpers } from './checklist_event_handler_types.js';
import type { StatusButtonTrigger } from './checklist_status_button_ui.js';
import type { DomUpdatePatchScope } from './checklist_dom_update.js';
import { attach_checklist_handler_delegates } from './checklist_handler_delegates.js';
import type {
    ChecklistCallbacks,
    ChecklistHandlerHelpers,
    ChecklistHandlerTranslation,
    ChecklistInitOptions
} from './checklist_handler_types.js';

export class ChecklistHandlerClass {
    container_ref: HTMLElement | null = null;
    on_status_change_callback: ChecklistCallbacks['onStatusChange'] | null = null;
    on_observation_change_callback: ChecklistCallbacks['onObservationChange'] | null = null;
    on_observation_change_immediate_callback: ChecklistCallbacks['onObservationChangeImmediate'] | null = null;
    on_observation_blur_commit_callback: ChecklistCallbacks['onObservationBlurCommit'] | null = null;
    on_before_status_change_sync_callback: ChecklistCallbacks['onBeforeStatusChangeSync'] | null = null;
    on_observation_draft_update_callback: ChecklistCallbacks['onObservationDraftUpdate'] | null = null;
    on_observation_hide_commit_callback: ChecklistCallbacks['onObservationHideCommit'] | null = null;
    get_pc_observation_draft: ChecklistInitOptions['getPcObservationDraft'] | null = null;
    on_stuck_description_saved_callback: ChecklistCallbacks['onStuckDescriptionSaved'] | null = null;
    on_attached_media_saved_callback: ChecklistCallbacks['onAttachedMediaSaved'] | null = null;

    _observation_focus_snapshots = new Map<string, string>();
    _observation_dom_cache = new Map<string, string>();
    _observation_hidden_with_text_keys = new Set<string>();
    _status_button_triggers = new Map<string, StatusButtonTrigger>();
    _status_change_flights = new Set<string>();

    Translation: ChecklistHandlerTranslation | null = null;
    Helpers: ChecklistHandlerHelpers | null = null;

    is_audit_locked = false;
    get_is_audit_frozen: (() => boolean) | null = null;
    get_is_audit_archived: (() => boolean) | null = null;
    get_dom_focus_sync_root: (() => HTMLElement | null) | null = null;
    lock_helpers: ChecklistLockHelpers | null = null;
    get_audit_id: (() => string | null) | null = null;
    get_sample_id: (() => string | null) | null = null;
    get_requirement_map_key: (() => string | null) | null = null;
    get_state: (() => { auditStatus?: string } | null) | null = null;
    get_observations_from_other_samples: (check_id: string, pc_id: string) => string[] = () => [];

    requirement_definition_ref: Record<string, unknown> | null = null;
    requirement_result_ref: {
        checkResults?: Record<string, unknown>;
        stuckProblemDescription?: string;
    } | null = null;
    requirement_update_details: Record<string, unknown> | null = null;
    _patch_scope: DomUpdatePatchScope = null;

    is_dom_built = false;
    last_language_code: string | null = null;
    last_sample_id: string | null = null;

    /** Arrow wrappers så addEventListener anropar ChecklistHandler-instansen, inte DOM-containern. */
    readonly _on_container_pointerdown_flush = (): void => {
        this.handle_observation_flush_pointerdown();
    };
    readonly _on_container_pointerdown_status = (event: Event): void => {
        this.handle_status_button_pointerdown(event);
    };
    readonly _on_container_click = (event: Event): void => {
        this.handle_checklist_click(event);
    };
    readonly _on_container_input = (event: Event): void => {
        this.handle_textarea_input(event);
    };
    readonly _on_container_focusin = (event: FocusEvent): void => {
        this.handle_pc_observation_focusin(event);
    };
    readonly _on_container_focusout = (event: FocusEvent): void => {
        this.handle_pc_observation_focusout(event);
    };

    /** Sätts på prototyp via attach_checklist_handler_delegates — declare, inte !, så egenskaper inte skuggar prototypen. */
    declare handle_checklist_click: (event: Event) => void;
    declare handle_textarea_input: (event: Event) => void;
    declare handle_attach_media_click: (event: Event, attach_btn: HTMLButtonElement) => void;
    declare handle_stuck_click: (event: Event, stuck_btn: HTMLButtonElement) => void;
    declare handle_copy_observation_click: (event: Event, copy_btn: HTMLButtonElement) => void;
    declare handle_pc_observation_focusin: (event: FocusEvent) => void;
    declare handle_pc_observation_focusout: (event: FocusEvent) => void;
    declare handle_status_button_pointerdown: (event: Event) => void;
    declare handle_observation_flush_pointerdown: () => void;

    declare build_initial_dom: () => void;
    declare update_dom: () => void;
    declare _set_pc_observation_detail: (
        check_results: Record<string, unknown> | null | undefined,
        check_id: string,
        pc_id: string,
        text: string
    ) => void;

    _audit_frozen_for_ui(): boolean {
        if (typeof this.get_is_audit_frozen === 'function') {
            return Boolean(this.get_is_audit_frozen());
        }
        return Boolean(this.is_audit_locked);
    }

    _audit_archived_for_ui(): boolean {
        if (typeof this.get_is_audit_archived === 'function') {
            return Boolean(this.get_is_audit_archived());
        }
        return false;
    }

    _register_hmr_dom_rebuild(): void {
        vite_register_hmr_dispose(() => {
            this.is_dom_built = false;
        });
    }

    init(container: HTMLElement, callbacks: ChecklistCallbacks, options: ChecklistInitOptions = {}): void {
        this.container_ref = container;
        this.on_status_change_callback = callbacks.onStatusChange || null;
        this.on_observation_change_callback = callbacks.onObservationChange || null;
        this.on_observation_change_immediate_callback = callbacks.onObservationChangeImmediate || null;
        this.on_observation_blur_commit_callback = callbacks.onObservationBlurCommit || null;
        this.on_before_status_change_sync_callback = callbacks.onBeforeStatusChangeSync || null;
        this.on_stuck_description_saved_callback = callbacks.onStuckDescriptionSaved || null;
        this.on_attached_media_saved_callback = callbacks.onAttachedMediaSaved || null;
        this._observation_focus_snapshots = new Map();
        this._observation_dom_cache = new Map();
        this._observation_hidden_with_text_keys = new Set();
        this._status_button_triggers = new Map();
        this._status_change_flights = new Set();
        this.is_dom_built = false;

        const deps = options.deps || {};
        const win = window as Window & {
            Translation?: ChecklistHandlerTranslation;
            Helpers?: ChecklistHandlerHelpers;
        };
        this.Translation = deps.Translation || win.Translation || null;
        this.Helpers = deps.Helpers || win.Helpers || null;
        this.get_observations_from_other_samples = options.getObservationsFromOtherSamples || (() => []);
        this.get_dom_focus_sync_root = typeof options.getDomFocusSyncRoot === 'function' ? options.getDomFocusSyncRoot : null;
        this.get_is_audit_frozen = typeof options.getIsAuditFrozen === 'function' ? options.getIsAuditFrozen : null;
        this.get_is_audit_archived = typeof options.getIsAuditArchived === 'function' ? options.getIsAuditArchived : null;
        this.lock_helpers = options.lockHelpers || null;
        this.get_audit_id = typeof options.getAuditId === 'function' ? options.getAuditId : null;
        this.get_sample_id = typeof options.getSampleId === 'function' ? options.getSampleId : null;
        this.get_requirement_map_key = typeof options.getRequirementMapKey === 'function' ? options.getRequirementMapKey : null;
        this.get_state = typeof options.getState === 'function' ? options.getState : null;
        this.get_pc_observation_draft = typeof options.getPcObservationDraft === 'function' ? options.getPcObservationDraft : null;
        this.on_observation_draft_update_callback = callbacks.onObservationDraftUpdate || null;
        this.on_observation_hide_commit_callback = callbacks.onObservationHideCommit || null;

        container.addEventListener('pointerdown', this._on_container_pointerdown_flush, true);
        container.addEventListener('pointerdown', this._on_container_pointerdown_status, true);
        container.addEventListener('click', this._on_container_click);
        container.addEventListener('input', this._on_container_input);
        container.addEventListener('focusin', this._on_container_focusin);
        container.addEventListener('focusout', this._on_container_focusout);
        this._register_hmr_dom_rebuild();
    }

    has_active_pc_observation_focus(): boolean {
        return has_active_pc_observation_focus(this as never);
    }

    _requirement_definition_identity(requirement_definition: Record<string, unknown> | null): string {
        if (!requirement_definition) return '';
        return String(requirement_definition.key ?? requirement_definition.id ?? '');
    }

    _resume_blocked_panel_animation(check_wrapper: HTMLElement): void {
        const check_id = check_wrapper?.dataset?.checkId;
        if (!check_id || !is_check_panel_animation_blocked(check_id)) return;
        const check_result_data = read_check_stored_data(this.requirement_result_ref?.checkResults, check_id);
        const overall_manual_status = check_result_data?.overallStatus || 'not_audited';
        const pc_panel = check_wrapper.querySelector('.pass-criteria-panel') as HTMLElement | null;
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
        const compliance_panel = check_wrapper.querySelector('.compliance-info-panel') as HTMLElement | null;
        if (compliance_panel && overall_manual_status === 'not_applicable' && !compliance_panel.classList.contains('slide-down-in')) {
            compliance_panel.hidden = false;
            compliance_panel.classList.add(PANEL_OPEN_CLASS);
            compliance_panel.classList.remove('slide-down-out');
            compliance_panel.classList.add('slide-down-in');
            void compliance_panel.offsetHeight;
        }
    }

    render(
        requirement_definition: Record<string, unknown>,
        requirement_result: ChecklistHandlerClass['requirement_result_ref'],
        locked_status: boolean,
        update_details: Record<string, unknown> | null,
        patch_scope: DomUpdatePatchScope
    ): void {
        const next_def_id = this._requirement_definition_identity(requirement_definition);
        const prev_def_id = this._requirement_definition_identity(this.requirement_definition_ref);
        if (next_def_id !== prev_def_id) {
            this.is_dom_built = false;
            this._status_button_triggers = new Map();
        }
        const current_sample_id = typeof this.get_sample_id === 'function' ? this.get_sample_id() : null;
        if (current_sample_id !== this.last_sample_id) {
            this.last_sample_id = current_sample_id;
            this.clear_observation_transient_state();
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
            this._resume_blocked_panel_animation(check_wrapper as HTMLElement);
        });
        this._patch_scope = null;
    }

    flush_observations_before_destroy(options: { trim?: boolean } = {}): void {
        const should_trim = options.trim !== false;
        if (!this.container_ref || !this.requirement_result_ref?.checkResults) return;
        this.container_ref.querySelectorAll('textarea.pc-observation-detail-textarea').forEach((textarea) => {
            const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
            const check_item = textarea.closest('.check-item[data-check-id]');
            if (!pc_item || !check_item) return;
            const check_id = (check_item as HTMLElement).dataset.checkId!;
            const pc_id = (pc_item as HTMLElement).dataset.pcId!;
            const raw = (textarea as HTMLTextAreaElement).value || '';
            const text_value = should_trim && this.Helpers?.trim_textarea_preserve_lines
                ? this.Helpers.trim_textarea_preserve_lines(raw)
                : should_trim ? raw.trim() : raw;
            this._set_pc_observation_detail(this.requirement_result_ref!.checkResults!, check_id, pc_id, text_value);
        });
    }

    /** Rensar observationscache mellan granskningsdelar (samma krav, nytt sample). */
    clear_observation_transient_state(): void {
        this._observation_dom_cache = new Map();
        this._observation_hidden_with_text_keys = new Set();
        this._observation_focus_snapshots = new Map();
    }

    destroy(): void {
        if (this.container_ref) {
            this.flush_observations_before_destroy();
            this.container_ref.removeEventListener('pointerdown', this._on_container_pointerdown_flush, true);
            this.container_ref.removeEventListener('pointerdown', this._on_container_pointerdown_status, true);
            this.container_ref.removeEventListener('click', this._on_container_click);
            this.container_ref.removeEventListener('input', this._on_container_input);
            this.container_ref.removeEventListener('focusin', this._on_container_focusin);
            this.container_ref.removeEventListener('focusout', this._on_container_focusout);
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
}

attach_checklist_handler_delegates(ChecklistHandlerClass.prototype as never);

export const ChecklistHandler = new ChecklistHandlerClass();

export function createChecklistHandler(): ChecklistHandlerClass {
    return new ChecklistHandlerClass();
}

export type { StatusChangeInfo };

/**
 * @fileoverview Typer och hjälpare för DOM-uppdatering i ChecklistHandler.
 */

import { has_active_pc_observation_focus, type ChecklistEventHandlerHost } from './checklist_event_handlers.js';
import type { ChecklistDomBuildHost } from './checklist_dom_build.js';
import type { ChecklistObservationTextHost } from './checklist_observation_text.js';
import type { ChecklistStatusButtonHost } from './checklist_status_button_ui.js';

export type DomUpdatePatchScope = {
    mode?: 'pc_only' | 'check_and_pcs';
    check_id?: string;
    pc_id?: string;
} | null;

export type DomUpdateEnv = {
    audit_frozen?: boolean;
    audit_archived?: boolean;
    sync_focus_root?: HTMLElement | null;
    active_el_for_sync?: Element | null;
    any_textarea_or_input_focused_in_sync_root?: boolean;
    has_pc_observation_textarea_focus?: boolean;
    force_status_button_sync?: boolean;
};

export type HealPcEnv = {
    sync_focus_root?: HTMLElement | null;
    active_el_for_sync?: Element | null;
    has_pc_observation_textarea_focus?: boolean;
};

export type HealPcParams = {
    check_id: string;
    pc_id: string;
    pc_item_li: HTMLElement;
    check_result_data: { overallStatus?: string; passCriteria?: Record<string, unknown> };
    context: string;
    sync_textarea_value?: boolean;
    env?: HealPcEnv | null;
};

export interface ChecklistDomUpdateHost extends ChecklistStatusButtonHost {
    container_ref: HTMLElement | null;
    requirement_definition_ref: {
        title?: string;
        checks?: Array<{
            id?: string;
            key?: string;
            condition?: string;
            passCriteria?: Array<{ id?: string; key?: string; requirement?: string }>;
        }>;
    } | null;
    requirement_result_ref: {
        checkResults?: Record<string, unknown>;
        stuckProblemDescription?: string;
    } | null;
    Translation: { t: (key: string, params?: Record<string, unknown>) => string };
    Helpers: {
        create_element: (...args: unknown[]) => HTMLElement;
        escape_html?: (s: string) => string;
        init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
    };
    get_pc_observation_draft?: ((check_id: string, pc_id: string) => string | undefined) | null;
    on_observation_draft_update_callback?: ((check_id: string, pc_id: string, text: string) => void) | null;
    on_observation_hide_commit_callback?: (() => void) | null;
    _observation_dom_cache?: Map<string, string>;
    _observation_hidden_with_text_keys?: Set<string>;
    _patch_scope?: DomUpdatePatchScope;
    get_dom_focus_sync_root?: (() => HTMLElement | null) | null;
    get_observations_from_other_samples: (check_id: string, pc_id: string) => string[];
    lock_helpers?: {
        makeObservationDetailPartKey: (
            audit_id: string,
            sample_id: string,
            req_id: string,
            check_id: string,
            pc_id: string
        ) => string;
        getRemoteLock: (part_key: string) => { user_name?: string } | null;
        ensureClientLockId: (part_key: string) => string;
        isRemoteLockHeldByOtherUser: (
            remote_lock: { user_name?: string } | null,
            user_name: string,
            client_lock_id: string
        ) => boolean;
    } | null;
    get_audit_id?: (() => string | null) | null;
    get_sample_id?: (() => string | null) | null;
    get_requirement_map_key?: (() => string | null) | null;
    _audit_frozen_for_ui(): boolean;
    _audit_archived_for_ui(): boolean;
}

export type DomUpdateObservationHost = ChecklistDomUpdateHost & ChecklistObservationTextHost;
export type DomUpdateBuildHost = ChecklistDomUpdateHost & ChecklistDomBuildHost;
export type DomUpdateEventHost = ChecklistDomUpdateHost & ChecklistEventHandlerHost;

export function as_observation_host(host: ChecklistDomUpdateHost): DomUpdateObservationHost {
    return host as DomUpdateObservationHost;
}

export function as_build_host(host: ChecklistDomUpdateHost): DomUpdateBuildHost {
    return host as DomUpdateBuildHost;
}

export function as_event_host(host: ChecklistDomUpdateHost): DomUpdateEventHost {
    return host as DomUpdateEventHost;
}

export function resolve_sync_focus_root(host: ChecklistDomUpdateHost): HTMLElement | null {
    return (typeof host.get_dom_focus_sync_root === 'function' ? host.get_dom_focus_sync_root() : null)
        || host.container_ref;
}

export function resolve_dom_update_env(host: ChecklistDomUpdateHost, env: DomUpdateEnv | null = null): Required<
    Pick<
        DomUpdateEnv,
        | 'audit_frozen'
        | 'audit_archived'
        | 'sync_focus_root'
        | 'active_el_for_sync'
        | 'any_textarea_or_input_focused_in_sync_root'
        | 'has_pc_observation_textarea_focus'
    >
> & { force_status_button_sync: boolean } {
    const sync_focus_root = env?.sync_focus_root ?? resolve_sync_focus_root(host);
    const active_el_for_sync = env?.active_el_for_sync ?? document.activeElement;
    return {
        audit_frozen: env?.audit_frozen ?? host._audit_frozen_for_ui(),
        audit_archived: env?.audit_archived ?? host._audit_archived_for_ui(),
        sync_focus_root,
        active_el_for_sync,
        any_textarea_or_input_focused_in_sync_root: env?.any_textarea_or_input_focused_in_sync_root ?? Boolean(
            active_el_for_sync && sync_focus_root?.contains(active_el_for_sync)
                && (active_el_for_sync instanceof HTMLElement
                    && (active_el_for_sync.tagName === 'TEXTAREA' || active_el_for_sync.tagName === 'INPUT'))
        ),
        has_pc_observation_textarea_focus: env?.has_pc_observation_textarea_focus
            ?? has_active_pc_observation_focus(as_event_host(host)),
        force_status_button_sync: Boolean(env?.force_status_button_sync)
    };
}

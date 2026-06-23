/**
 * @fileoverview Typer och host-gränssnitt för ChecklistHandler-händelsehanterare.
 */

import { read_check_stored_data } from './checklist_observation_visibility.js';
import type { ChecklistStatusButtonHost, StatusButtonTarget } from './checklist_status_button_ui.js';
import type { ChecklistObservationTextHost } from './checklist_observation_text.js';

export type StatusChangeInfo = {
    type: 'check_overall_status_change' | 'pc_status_change' | null;
    checkId: string;
    pcId?: string;
    newStatus?: string;
    trigger?: {
        source: string;
        event_type: string | null;
        is_trusted?: boolean;
        pointer_type?: string | null;
    };
    flow_id?: string | null;
};

export type ChecklistLockHelpers = {
    makeObservationDetailPartKey: (
        audit_id: string,
        sample_id: string,
        req_id: string,
        check_id: string,
        pc_id: string
    ) => string;
    tryAcquireLock: (opts: { audit_id: string; part_key: string }) => Promise<unknown>;
    releaseLock: (opts: { audit_id: string; part_key: string }) => Promise<unknown>;
};

export interface ChecklistEventHandlerHost extends ChecklistStatusButtonHost, Omit<ChecklistObservationTextHost, 'Helpers'> {
    requirement_result_ref: {
        checkResults?: Record<string, unknown>;
        stuckProblemDescription?: string;
        lastStatusUpdate?: string;
        lastStatusUpdateBy?: string;
    } | null;
    _observation_focus_snapshots: Map<string, string>;
    Translation: { t: (key: string, params?: Record<string, unknown>) => string };
    Helpers: {
        create_element: (...args: unknown[]) => HTMLElement;
        init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
        trim_textarea_preserve_lines?: (raw: string) => string;
        get_current_iso_datetime_utc?: () => string;
        escape_html?: (s: string) => string;
    } | null;
    lock_helpers?: ChecklistLockHelpers | null;
    get_audit_id?: (() => string | null) | null;
    get_sample_id?: (() => string | null) | null;
    get_requirement_map_key?: (() => string | null) | null;
    get_state?: (() => { auditStatus?: string } | null) | null;
    get_observations_from_other_samples: (check_id: string, pc_id: string) => string[];
    on_before_status_change_sync_callback?: (() => void) | null;
    on_observation_blur_commit_callback?: (() => void) | null;
    on_observation_change_callback?: (() => void) | null;
    on_status_change_callback?: ((change_info: StatusChangeInfo) => unknown) | null;
    on_stuck_description_saved_callback?: (() => void | Promise<void>) | null;
    on_attached_media_saved_callback?: (() => void) | null;
    _flush_all_observation_textareas_to_memory(): void;
    _persist_observation_dom_value(check_id: string, pc_id: string, text: string): void;
    _heal_pc_ui_from_data(params: {
        check_id: string;
        pc_id: string;
        pc_item_li: HTMLElement;
        check_result_data: ReturnType<typeof read_check_stored_data>;
        context: string;
        sync_textarea_value?: boolean;
        env?: unknown;
    }): { healed: boolean; deferred_hide: boolean };
    _build_button_focus_target(button_element: HTMLElement | null): StatusButtonTarget | null;
    _acquire_status_change_flight(check_id: string, pc_id: string | null): boolean;
    _release_status_change_flight(check_id: string, pc_id: string | null): void;
    _apply_optimistic_status_button_ui(change_info: StatusChangeInfo): void;
    _detect_user_event_source(event: Event): string;
    _status_button_label(action: string): string;
    _remember_status_button_trigger(
        check_id: string,
        pc_id: string | null,
        action: string,
        trigger: StatusChangeInfo['trigger']
    ): void;
    _status_button_snapshot_key(check_id: string, pc_id: string | null, action: string): string;
    _restore_focus_to_button_with_retry(
        button_target: StatusButtonTarget | null,
        opts?: { restore_custom_flag_to?: boolean | null }
    ): void;
    _set_pc_observation_detail(
        check_results: Record<string, unknown> | null | undefined,
        check_id: string,
        pc_id: string,
        text: string
    ): void;
    update_dom(): void;
    _update_dom_stuck_button(t: (key: string, params?: Record<string, unknown>) => string): void;
}

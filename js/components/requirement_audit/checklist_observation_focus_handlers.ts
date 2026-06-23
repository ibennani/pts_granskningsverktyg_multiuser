/**
 * @fileoverview Fokushantering för observationsfält i ChecklistHandler.
 */

import { resolve_map_entry } from '../../audit_logic.js';
import { get_current_user_name } from '../../utils/helpers.js';
import { read_check_stored_data, read_pc_stored_data } from './checklist_observation_visibility.js';
import type { ChecklistEventHandlerHost } from './checklist_event_handler_types.js';

export function handle_observation_flush_pointerdown(host: ChecklistEventHandlerHost): void {
    host._flush_all_observation_textareas_to_memory();
}

export function handle_status_button_pointerdown(host: ChecklistEventHandlerHost, event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest?.('button[data-action]');
    if (!button) return;
    const action = (button as HTMLElement).dataset.action;
    if (
        action !== 'set-check-complies' &&
        action !== 'set-check-not-complies' &&
        action !== 'set-pc-passed' &&
        action !== 'set-pc-failed'
    ) {
        return;
    }
    if (typeof host.on_before_status_change_sync_callback === 'function') {
        host.on_before_status_change_sync_callback();
    }
}

export function has_active_pc_observation_focus(host: ChecklistEventHandlerHost): boolean {
    if (!host.container_ref) return false;
    const el = document.activeElement;
    if (!el || el.tagName?.toLowerCase() !== 'textarea') return false;
    if (!host.container_ref.contains(el)) return false;
    return el.classList.contains('pc-observation-detail-textarea');
}

function try_acquire_observation_lock(
    host: ChecklistEventHandlerHost,
    check_id: string,
    pc_id: string
): void {
    if (!host.lock_helpers || !host.get_audit_id || !host.get_sample_id || !host.get_requirement_map_key) {
        return;
    }
    const audit_id = host.get_audit_id();
    const sample_id = host.get_sample_id();
    const req_id = host.get_requirement_map_key();
    if (!audit_id || !sample_id || !req_id) return;
    const part_key = host.lock_helpers.makeObservationDetailPartKey(
        audit_id, sample_id, req_id, check_id, pc_id
    );
    void host.lock_helpers.tryAcquireLock({ audit_id, part_key });
}

function release_observation_lock(
    host: ChecklistEventHandlerHost,
    check_id: string,
    pc_id: string
): void {
    if (!host.lock_helpers || !host.get_audit_id || !host.get_sample_id || !host.get_requirement_map_key) {
        return;
    }
    const audit_id = host.get_audit_id();
    const sample_id = host.get_sample_id();
    const req_id = host.get_requirement_map_key();
    if (!audit_id || !sample_id || !req_id) return;
    const part_key = host.lock_helpers.makeObservationDetailPartKey(
        audit_id, sample_id, req_id, check_id, pc_id
    );
    void host.lock_helpers.releaseLock({ audit_id, part_key });
}

export function handle_pc_observation_focusin(host: ChecklistEventHandlerHost, event: FocusEvent): void {
    const textarea = event.target;
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    if (!textarea.classList.contains('pc-observation-detail-textarea')) return;
    const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
    const check_item = textarea.closest('.check-item[data-check-id]');
    if (!pc_item || !check_item) return;

    const check_id = (check_item as HTMLElement).dataset.checkId!;
    const pc_id = (pc_item as HTMLElement).dataset.pcId!;
    const key = `${check_id}::${pc_id}`;
    host._observation_focus_snapshots.set(key, textarea.value ?? '');
    try_acquire_observation_lock(host, check_id, pc_id);
}

function update_pc_timestamp_on_observation_change(
    host: ChecklistEventHandlerHost,
    check_id: string,
    pc_id: string
): void {
    if (!host.requirement_result_ref?.checkResults) return;
    const chk_resolved = resolve_map_entry(host.requirement_result_ref.checkResults, check_id);
    const check_result = chk_resolved?.value as { passCriteria?: Record<string, unknown> } | undefined;
    const pc_resolved = check_result?.passCriteria
        ? resolve_map_entry(check_result.passCriteria, pc_id)
        : null;
    const pc_entry = pc_resolved?.value;
    if (pc_entry && typeof pc_entry === 'object') {
        const ts = host.Helpers?.get_current_iso_datetime_utc
            ? host.Helpers.get_current_iso_datetime_utc()
            : new Date().toISOString();
        (pc_entry as { timestamp?: string; updatedBy?: string }).timestamp = ts;
        (pc_entry as { timestamp?: string; updatedBy?: string }).updatedBy = get_current_user_name();
    }
}

export function handle_pc_observation_focusout(host: ChecklistEventHandlerHost, event: FocusEvent): void {
    const textarea = event.target;
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    if (!textarea.classList.contains('pc-observation-detail-textarea')) return;
    const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]') as HTMLElement | null;
    const check_item = textarea.closest('.check-item[data-check-id]') as HTMLElement | null;
    if (!pc_item || !check_item || !host.requirement_result_ref?.checkResults) return;

    const check_id = check_item.dataset.checkId!;
    const pc_id = pc_item.dataset.pcId!;
    const key = `${check_id}::${pc_id}`;
    const current = textarea.value ?? '';

    host._persist_observation_dom_value(check_id, pc_id, current);
    release_observation_lock(host, check_id, pc_id);

    const schedule_heal = () => schedule_heal_pc_after_focus_left(host, check_id, pc_id, pc_item);

    if (!host._observation_focus_snapshots.has(key)) {
        const check_result_data = read_check_stored_data(host.requirement_result_ref.checkResults, check_id);
        const stored_data = read_pc_stored_data(check_result_data, pc_id);
        const stored_observation = stored_data?.observationDetail ?? '';
        if (current !== stored_observation && host.on_observation_blur_commit_callback) {
            host.on_observation_blur_commit_callback();
        }
        schedule_heal();
        return;
    }

    const snapshot = host._observation_focus_snapshots.get(key)!;
    host._observation_focus_snapshots.delete(key);
    if (snapshot === current) {
        schedule_heal();
        return;
    }

    update_pc_timestamp_on_observation_change(host, check_id, pc_id);
    if (host.on_observation_blur_commit_callback) {
        host.on_observation_blur_commit_callback();
    }
    queueMicrotask(schedule_heal);
}

export function schedule_heal_pc_after_focus_left(
    host: ChecklistEventHandlerHost,
    check_id: string,
    pc_id: string,
    pc_item_li: HTMLElement
): void {
    requestAnimationFrame(() => {
        if (!pc_item_li?.isConnected || !host.requirement_result_ref?.checkResults) return;
        const check_result_data = read_check_stored_data(
            host.requirement_result_ref.checkResults,
            check_id
        );
        if (!check_result_data) return;
        host._heal_pc_ui_from_data({
            check_id,
            pc_id,
            pc_item_li,
            check_result_data,
            context: 'observation_focusout',
            sync_textarea_value: false
        });
    });
}

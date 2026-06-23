/**
 * @fileoverview Statusknapp-klick och statusändring för ChecklistHandler.
 */

import { set_pending_checklist_focus_target } from '../../app/browser_globals.js';
import {
    register_krav_vy_knapp_dom_watch,
    start_krav_vy_knapp_flow
} from './krav_vy_knapp_debug_log.js';
import type { StatusButtonTarget } from './checklist_status_button_ui.js';
import type { ChecklistEventHandlerHost, StatusChangeInfo } from './checklist_event_handler_types.js';
import {
    handle_attach_media_click,
    handle_copy_observation_click,
    handle_stuck_click
} from './checklist_media_modal_handlers.js';

export function build_status_change_info(
    action: string,
    check_id: string,
    pc_item_element: Element | null
): StatusChangeInfo {
    const change_info: StatusChangeInfo = { type: null, checkId: check_id };
    if (action === 'set-check-complies') {
        change_info.type = 'check_overall_status_change';
        change_info.newStatus = 'passed';
    } else if (action === 'set-check-not-complies') {
        change_info.type = 'check_overall_status_change';
        change_info.newStatus = 'not_applicable';
    } else if (pc_item_element) {
        const pc_id = (pc_item_element as HTMLElement).dataset.pcId!;
        change_info.pcId = pc_id;
        if (action === 'set-pc-passed') {
            change_info.type = 'pc_status_change';
            change_info.newStatus = 'passed';
        } else if (action === 'set-pc-failed') {
            change_info.type = 'pc_status_change';
            change_info.newStatus = 'failed';
        }
    }
    return change_info;
}

function register_status_button_dom_watch(
    host: ChecklistEventHandlerHost,
    flow_id: string | null,
    check_id: string,
    pc_id: string | null,
    action: string,
    trigger: NonNullable<StatusChangeInfo['trigger']>
): void {
    host._remember_status_button_trigger(check_id, pc_id, action, trigger);
    register_krav_vy_knapp_dom_watch(
        flow_id ?? '',
        host._status_button_snapshot_key(check_id, pc_id, action)
    );
    if (action === 'set-check-complies' || action === 'set-check-not-complies') {
        const sibling = action === 'set-check-complies' ? 'set-check-not-complies' : 'set-check-complies';
        host._remember_status_button_trigger(check_id, null, sibling, trigger);
        register_krav_vy_knapp_dom_watch(flow_id ?? '', host._status_button_snapshot_key(check_id, null, sibling));
    } else if (action === 'set-pc-passed' || action === 'set-pc-failed') {
        const sibling = action === 'set-pc-passed' ? 'set-pc-failed' : 'set-pc-passed';
        host._remember_status_button_trigger(check_id, pc_id, sibling, trigger);
        register_krav_vy_knapp_dom_watch(flow_id ?? '', host._status_button_snapshot_key(check_id, pc_id, sibling));
    }
}

export function dispatch_status_change(
    host: ChecklistEventHandlerHost,
    change_info: StatusChangeInfo,
    action: string,
    check_id: string,
    button_focus_target: StatusButtonTarget | null,
    event: Event
): void {
    if (!change_info.type || !host.on_status_change_callback) return;
    if (!host._acquire_status_change_flight(check_id, change_info.pcId || null)) return;

    const release_flight = () => {
        host._release_status_change_flight(check_id, change_info.pcId || null);
    };

    host._apply_optimistic_status_button_ui(change_info);

    const trigger = {
        source: host._detect_user_event_source(event),
        event_type: event.type,
        is_trusted: (event as Event & { isTrusted?: boolean }).isTrusted,
        pointer_type: (event as PointerEvent).pointerType || null
    };
    change_info.trigger = trigger;
    const flow_id = start_krav_vy_knapp_flow({
        knapp: host._status_button_label(action),
        action,
        check_id,
        pc_id: change_info.pcId || null,
        orsak: trigger.source,
        händelse_typ: trigger.event_type,
        is_trusted: trigger.is_trusted,
        pointer_type: trigger.pointer_type
    });
    change_info.flow_id = flow_id;
    register_status_button_dom_watch(host, flow_id, check_id, change_info.pcId || null, action, trigger);

    const keep_focus = change_info.type === 'check_overall_status_change' ||
        (change_info.type === 'pc_status_change' &&
            (change_info.newStatus === 'passed' || change_info.newStatus === 'failed'));
    const prev_custom_focus_flag = (window as Window & { customFocusApplied?: boolean }).customFocusApplied;
    if (keep_focus && button_focus_target) {
        (window as Window & { customFocusApplied?: boolean }).customFocusApplied = true;
        set_pending_checklist_focus_target({
            action: button_focus_target.action,
            check_id: button_focus_target.check_id,
            pc_id: button_focus_target.pc_id,
            set_at: Date.now()
        });
    }

    const callback_result = host.on_status_change_callback(change_info);
    const restore = () => {
        if (keep_focus) {
            host._restore_focus_to_button_with_retry(button_focus_target, {
                restore_custom_flag_to: prev_custom_focus_flag
            });
        }
    };

    if (callback_result != null && typeof (callback_result as Promise<unknown>).then === 'function') {
        (callback_result as Promise<unknown>).catch((e) => {
            if ((window as Window & { ConsoleManager?: { warn: (msg: string, err: unknown) => void } }).ConsoleManager?.warn) {
                (window as Window & { ConsoleManager?: { warn: (msg: string, err: unknown) => void } }).ConsoleManager!.warn(
                    '[ChecklistHandler] onStatusChange:',
                    e
                );
            }
        }).finally(() => {
            release_flight();
            restore();
        });
    } else {
        release_flight();
        restore();
    }
}

export function handle_checklist_click(host: ChecklistEventHandlerHost, event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const attach_btn = target.closest('button[data-action="attach-media"]');
    if (attach_btn) {
        handle_attach_media_click(host, event, attach_btn as HTMLButtonElement);
        return;
    }

    const stuck_btn = target.closest('button[data-action="stuck"]');
    if (stuck_btn) {
        handle_stuck_click(host, event, stuck_btn as HTMLButtonElement);
        return;
    }

    const copy_obs_btn = target.closest('button[data-action="copy-observation"]');
    if (copy_obs_btn) {
        handle_copy_observation_click(host, event, copy_obs_btn as HTMLButtonElement);
        return;
    }

    const target_button = target.closest('button[data-action]') as HTMLButtonElement | null;
    if (!target_button) return;

    const action = target_button.dataset.action!;
    const check_item_element = target_button.closest('.check-item[data-check-id]');
    const pc_item_element = target_button.closest('.pass-criterion-item[data-pc-id]');
    const button_focus_target = host._build_button_focus_target(target_button);
    if (!check_item_element) return;

    const check_id = (check_item_element as HTMLElement).dataset.checkId!;
    const change_info = build_status_change_info(action, check_id, pc_item_element);
    dispatch_status_change(host, change_info, action, check_id, button_focus_target, event);
}

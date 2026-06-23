/**
 * @fileoverview Statusknappar, fokusåterställning och flight-hantering för ChecklistHandler.
 */

import { get_pending_checklist_focus_target } from '../../app/browser_globals.js';
import { consume_krav_vy_dom_flow, log_krav_vy_knapp } from './krav_vy_knapp_debug_log.js';

export type StatusButtonTarget = {
    action: string;
    check_id: string | null;
    pc_id: string | null;
};

export type StatusButtonIds = {
    check_id: string;
    pc_id: string | null;
    action: string;
};

export type StatusButtonTrigger = {
    source?: string;
    event_type?: string | null;
};

/** Minsta state som statusknapp-modulen behöver från handlern. */
export interface ChecklistStatusButtonHost {
    container_ref: HTMLElement | null;
    _status_change_flights?: Set<string>;
    _status_button_triggers?: Map<string, StatusButtonTrigger>;
}

export function build_button_focus_target(button_element: HTMLElement | null): StatusButtonTarget | null {
    if (!button_element) return null;
    const action = button_element.getAttribute('data-action');
    if (!action) return null;
    const check_item = button_element.closest('.check-item[data-check-id]') as HTMLElement | null;
    const pc_item = button_element.closest('.pass-criterion-item[data-pc-id]') as HTMLElement | null;
    return {
        action,
        check_id: check_item?.dataset?.checkId || null,
        pc_id: pc_item?.dataset?.pcId || null
    };
}

export function status_button_snapshot_key(check_id: string, pc_id: string | null, action: string): string {
    return `${check_id}::${pc_id || ''}::${action}`;
}

export function status_change_flight_key(check_id: string, pc_id: string | null | undefined): string {
    return `${check_id}::${pc_id ?? ''}`;
}

export function acquire_status_change_flight(host: ChecklistStatusButtonHost, check_id: string, pc_id: string | null): boolean {
    if (!host._status_change_flights) {
        host._status_change_flights = new Set();
    }
    const key = status_change_flight_key(check_id, pc_id);
    if (host._status_change_flights.has(key)) {
        return false;
    }
    host._status_change_flights.add(key);
    return true;
}

export function release_status_change_flight(host: ChecklistStatusButtonHost, check_id: string, pc_id: string | null): void {
    host._status_change_flights?.delete(status_change_flight_key(check_id, pc_id));
}

export function detect_user_event_source(event: Event | null | undefined): string {
    if (!event) return 'okänd';
    if (!('isTrusted' in event) || !event.isTrusted) return 'programmatisk_händelse';
    if (event.type === 'click' && 'detail' in event && event.detail === 0) return 'tangentbord';
    if (event.type === 'click') return 'klick';
    return event.type || 'okänd';
}

export function status_button_label(action: string): string {
    const labels: Record<string, string> = {
        'set-check-complies': 'Kontrollpunkt: Stämmer',
        'set-check-not-complies': 'Kontrollpunkt: Stämmer inte',
        'set-pc-passed': 'Godkännandekriterium: Godkänt',
        'set-pc-failed': 'Godkännandekriterium: Underkänt'
    };
    return labels[action] || action;
}

export function remember_status_button_trigger(
    host: ChecklistStatusButtonHost,
    check_id: string,
    pc_id: string | null,
    action: string,
    trigger: StatusButtonTrigger
): void {
    if (!host._status_button_triggers) {
        host._status_button_triggers = new Map();
    }
    const key = status_button_snapshot_key(check_id, pc_id, action);
    host._status_button_triggers.set(key, trigger);
}

export function apply_status_button_active_state(
    host: ChecklistStatusButtonHost,
    button_el: HTMLElement | null,
    should_be_active: boolean,
    { check_id, pc_id, action }: StatusButtonIds,
    opts: { skip_if_unchanged?: boolean } = {}
): void {
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

    const key = status_button_snapshot_key(check_id, pc_id, action);
    const trigger = host._status_button_triggers?.get(key) || null;
    if (trigger) {
        host._status_button_triggers?.delete(key);
    }
    const flow_id = consume_krav_vy_dom_flow(key);
    if (!flow_id && !trigger) return;
    log_krav_vy_knapp('DOM/utseende uppdaterat', {
        flow_id: flow_id || null,
        knapp: status_button_label(action),
        action,
        check_id,
        pc_id: pc_id || null,
        tidigare: was_active ? 'markerad (aktiv färg)' : 'omarkerad',
        nytt: is_active ? 'markerad (aktiv färg)' : 'omarkerad',
        orsak: trigger?.source || 'annat (t.ex. synk eller omrendering)',
        händelse_typ: trigger?.event_type || null
    });
}

export function resolve_status_button_element(
    host: ChecklistStatusButtonHost,
    button_target: StatusButtonTarget | null
): HTMLButtonElement | null {
    if (!button_target || !host.container_ref) return null;

    let search_root: ParentNode = host.container_ref;
    if (button_target.check_id) {
        const check_selector = `.check-item[data-check-id="${CSS.escape(button_target.check_id)}"]`;
        const check_item = host.container_ref.querySelector(check_selector);
        if (check_item) search_root = check_item;
    }
    if (button_target.pc_id) {
        const pc_selector = `.pass-criterion-item[data-pc-id="${CSS.escape(button_target.pc_id)}"]`;
        const pc_item = search_root.querySelector(pc_selector);
        if (pc_item) search_root = pc_item;
    }

    const button_el = search_root.querySelector(`button[data-action="${CSS.escape(button_target.action)}"]`) as HTMLButtonElement | null;
    const has_layout = button_el && typeof button_el.getClientRects === 'function'
        ? button_el.getClientRects().length > 0
        : false;

    if (!button_el || !has_layout || !document.contains(button_el)) return null;
    return button_el;
}

export function reapply_pending_status_button_focus(host: ChecklistStatusButtonHost): void {
    const pending = get_pending_checklist_focus_target() as {
        action?: string;
        check_id?: string | null;
        pc_id?: string | null;
        set_at?: number;
    } | null | undefined;
    if (!pending?.action || !host.container_ref) return;
    if (typeof pending.set_at !== 'number' || Date.now() - pending.set_at > 5000) return;

    const target: StatusButtonTarget = {
        action: pending.action,
        check_id: pending.check_id ?? null,
        pc_id: pending.pc_id ?? null
    };
    const pending_btn = resolve_status_button_element(host, target);

    const ae = document.activeElement;
    if (ae && ae !== document.body && ae !== document.documentElement) {
        const has_layout = typeof (ae as HTMLElement).getClientRects === 'function'
            ? (ae as HTMLElement).getClientRects().length > 0
            : true;
        if (has_layout && document.contains(ae)) {
            if (!host.container_ref.contains(ae)) {
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
    } catch {
        pending_btn.focus();
    }
}

export function try_focus_button_target(host: ChecklistStatusButtonHost, button_target: StatusButtonTarget | null): boolean {
    const button_to_focus = resolve_status_button_element(host, button_target);
    if (!button_to_focus) return false;
    try {
        button_to_focus.focus({ preventScroll: true });
    } catch {
        button_to_focus.focus();
    }
    return true;
}

export function should_skip_focus_restore_to_button(
    host: ChecklistStatusButtonHost,
    button_target: StatusButtonTarget | null
): boolean {
    if (!button_target || !host.container_ref) return false;
    const active = document.activeElement;
    if (!active || !host.container_ref.contains(active)) return false;
    const tag = active.tagName?.toLowerCase();
    if (tag === 'textarea' || tag === 'input' || tag === 'select') return true;
    if (tag === 'button' || tag === 'a') return true;
    return false;
}

export function restore_focus_to_button_if_needed(
    host: ChecklistStatusButtonHost,
    button_target: StatusButtonTarget | null
): void {
    if (!button_target || !host.container_ref) return;
    requestAnimationFrame(() => {
        const active = document.activeElement as HTMLElement | null;
        if (active && host.container_ref?.contains(active)) {
            const has_layout = typeof active.getClientRects === 'function'
                ? active.getClientRects().length > 0
                : false;
            if (has_layout) return;
        }
        let search_root: ParentNode = host.container_ref!;
        if (button_target.check_id) {
            const check_selector = `.check-item[data-check-id="${CSS.escape(button_target.check_id)}"]`;
            const check_item = host.container_ref!.querySelector(check_selector);
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
        const button_to_focus = search_root.querySelector(
            `button[data-action="${CSS.escape(button_target.action)}"]`
        ) as HTMLButtonElement | null;
        if (!button_to_focus || !document.contains(button_to_focus)) return;
        try {
            button_to_focus.focus({ preventScroll: true });
        } catch {
            button_to_focus.focus();
        }
    });
}

export function restore_focus_to_button_with_retry(
    host: ChecklistStatusButtonHost,
    button_target: StatusButtonTarget | null,
    { restore_custom_flag_to = null }: { restore_custom_flag_to?: boolean | null } = {}
): void {
    if (!button_target || !host.container_ref) return;

    const prev_custom_focus_applied = restore_custom_flag_to !== null && restore_custom_flag_to !== undefined
        ? restore_custom_flag_to
        : (window as Window & { customFocusApplied?: boolean }).customFocusApplied;
    (window as Window & { customFocusApplied?: boolean }).customFocusApplied = true;

    const try_focus = () => {
        if (!host.container_ref) return;
        if (should_skip_focus_restore_to_button(host, button_target)) return;
        try_focus_button_target(host, button_target);
    };

    try_focus();
    queueMicrotask(try_focus);

    setTimeout(() => {
        (window as Window & { customFocusApplied?: boolean }).customFocusApplied = prev_custom_focus_applied;
    }, 650);
}

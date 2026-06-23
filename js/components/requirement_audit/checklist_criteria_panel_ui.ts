/**
 * @fileoverview Synlighet och animation för kriteriepaneler i ChecklistHandler.
 */

import {
    get_panel_sync_remaining_ms,
    is_panel_sync_blocked,
    PANEL_ANIMATION_MS,
    PANEL_OPEN_CLASS,
    set_panel_open
} from './criteria_panel.js';

/** Host för kriteriepanelsynk – inga metoder krävs idag. */
export type ChecklistCriteriaPanelUiHost = object;

export function defer_criteria_panel_sync(
    host: ChecklistCriteriaPanelUiHost,
    check_wrapper: HTMLElement | null,
    panel: HTMLElement | null,
    should_show: boolean
): void {
    const remaining_ms = get_panel_sync_remaining_ms(panel) || PANEL_ANIMATION_MS;
    window.setTimeout(() => {
        if (!panel || !document.contains(panel)) {
            return;
        }
        set_criteria_panel_visibility(host, check_wrapper, panel, should_show, { animate: false });
    }, remaining_ms + 30);
}

export function set_criteria_panel_visibility(
    host: ChecklistCriteriaPanelUiHost,
    check_wrapper: HTMLElement | null,
    panel: HTMLElement | null,
    should_show: boolean,
    { animate = true }: { animate?: boolean } = {}
): void {
    if (!panel) {
        return;
    }
    const check_id = check_wrapper?.dataset?.checkId ?? null;
    const is_open = panel.classList.contains(PANEL_OPEN_CLASS) && !panel.hidden;
    const blocked = is_panel_sync_blocked(panel, check_id);
    if (blocked) {
        if (!animate) {
            defer_criteria_panel_sync(host, check_wrapper, panel, should_show);
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
                    (fallback as HTMLElement).focus({ preventScroll: true });
                } catch {
                    (fallback as HTMLElement).focus();
                }
            }
        }
    }
    set_panel_open(panel, should_show, { animate, check_id });
}

/**
 * @fileoverview Animation vid växling mellan platt och grupperad granskningslista.
 */

import {
    EXPANDABLE_PANEL_TRANSITION_MS,
    animate_expandable_panel,
    prefers_reduced_motion,
    wait_element_transition
} from '../utils/expandable_panel_transition.js';

export const AUDIT_LIST_TRANSITION_MS = EXPANDABLE_PANEL_TRANSITION_MS;
/** En fas (ut- eller infasning) vid filter-/listväxling; två faser ger 0,5 s totalt. */
export const AUDIT_LIST_TOGGLE_TRANSITION_MS = AUDIT_LIST_TRANSITION_MS / 2;

export { prefers_reduced_motion, wait_element_transition };

const AUDIT_GROUP_EXPANDED_CLASS = 'audit-group-detail-panel--expanded';

/**
 * Animerar expandering eller kollaps av en grupprads detaljpanel (0,5 s).
 */
export async function animate_audit_group_panel(
    panel: HTMLElement,
    detail_row: HTMLElement,
    expand: boolean
): Promise<void> {
    await animate_expandable_panel(panel, detail_row, expand, AUDIT_GROUP_EXPANDED_CLASS);
}

/** Tar bort tillfälliga opacity-klasser efter listväxlingsanimation. */
export function clear_audit_lists_transition_classes(container: HTMLElement | null): void {
    if (!container) return;
    container.classList.remove('audit-lists--transition-exit', 'audit-lists--transition-enter-start');
}

/**
 * Tonar ut listor, renderar om och tonar in igen (0,5 s totalt om rörelse tillåts).
 */
export async function run_audit_lists_toggle_animation(
    get_container: () => HTMLElement | null,
    run_render: () => void
): Promise<void> {
    const container = get_container();
    if (!container || prefers_reduced_motion()) {
        run_render();
        clear_audit_lists_transition_classes(get_container());
        return;
    }

    container.classList.add('audit-lists--transition-exit');
    await wait_element_transition(container, AUDIT_LIST_TOGGLE_TRANSITION_MS);
    clear_audit_lists_transition_classes(container);

    run_render();

    const new_container = get_container();
    if (!new_container) return;

    clear_audit_lists_transition_classes(new_container);
    new_container.classList.add('audit-lists--transition-enter-start');
    await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
    });
    new_container.classList.remove('audit-lists--transition-enter-start');
    await wait_element_transition(new_container, AUDIT_LIST_TOGGLE_TRANSITION_MS);
}

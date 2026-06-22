/**
 * @fileoverview Animation vid växling mellan platt och grupperad granskningslista.
 */

export const AUDIT_LIST_TRANSITION_MS = 500;
/** En fas (ut- eller infasning) vid filter-/listväxling; två faser ger 0,5 s totalt. */
export const AUDIT_LIST_TOGGLE_TRANSITION_MS = AUDIT_LIST_TRANSITION_MS / 2;

/** Sant om användaren föredrar reducerad rörelse. */
export function prefers_reduced_motion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

/** Väntar på transitionend eller timeout. */
export function wait_element_transition(element: HTMLElement, duration_ms: number): Promise<void> {
    return new Promise((resolve) => {
        let finished = false;
        const done = () => {
            if (finished) return;
            finished = true;
            element.removeEventListener('transitionend', on_end);
            clearTimeout(timer);
            resolve();
        };
        const on_end = (event: TransitionEvent) => {
            if (event.target !== element) return;
            done();
        };
        element.addEventListener('transitionend', on_end);
        const timer = setTimeout(done, duration_ms + 50);
    });
}

function next_animation_frame(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
}

/**
 * Animerar expandering eller kollaps av en grupprads detaljpanel (0,5 s).
 */
export async function animate_audit_group_panel(
    panel: HTMLElement,
    detail_row: HTMLElement,
    expand: boolean
): Promise<void> {
    if (prefers_reduced_motion()) {
        panel.classList.toggle('audit-group-detail-panel--expanded', expand);
        detail_row.hidden = !expand;
        return;
    }

    if (expand) {
        detail_row.hidden = false;
        panel.classList.remove('audit-group-detail-panel--instant');
        await next_animation_frame();
        panel.classList.add('audit-group-detail-panel--expanded');
        await wait_element_transition(panel, AUDIT_LIST_TRANSITION_MS);
        return;
    }

    panel.classList.remove('audit-group-detail-panel--expanded');
    await wait_element_transition(panel, AUDIT_LIST_TRANSITION_MS);
    detail_row.hidden = true;
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
    await next_animation_frame();
    new_container.classList.remove('audit-lists--transition-enter-start');
    await wait_element_transition(new_container, AUDIT_LIST_TOGGLE_TRANSITION_MS);
}

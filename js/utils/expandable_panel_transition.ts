/**
 * @fileoverview Gemensam animation för utfällbara paneler (accordions).
 * Öppning och stängning tar 0,5 s vardera om användaren inte föredrar reducerad rörelse.
 */

export const EXPANDABLE_PANEL_TRANSITION_MS = 500;

export const EXPANDABLE_PANEL_EXPANDED_CLASS = 'expandable-panel--expanded';
export const EXPANDABLE_PANEL_INSTANT_CLASS = 'expandable-panel--instant';

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
 * Animerar expandering eller kollaps av en panel (standard 0,5 s, valfri duration_ms).
 * visibility_host döljs efter kollaps (t.ex. panel-wrapper eller tabellrad).
 */
export async function animate_expandable_panel(
    panel: HTMLElement,
    visibility_host: HTMLElement,
    expand: boolean,
    expanded_class_name: string = EXPANDABLE_PANEL_EXPANDED_CLASS,
    duration_ms: number = EXPANDABLE_PANEL_TRANSITION_MS
): Promise<void> {
    if (prefers_reduced_motion()) {
        panel.classList.toggle(expanded_class_name, expand);
        visibility_host.hidden = !expand;
        return;
    }

    if (expand) {
        visibility_host.hidden = false;
        panel.classList.remove(EXPANDABLE_PANEL_INSTANT_CLASS);
        await next_animation_frame();
        panel.classList.add(expanded_class_name);
        await wait_element_transition(panel, duration_ms);
        return;
    }

    panel.classList.remove(expanded_class_name);
    await wait_element_transition(panel, duration_ms);
    visibility_host.hidden = true;
}

/** Sätter expanderat tillstånd utan animation (t.ex. vid initial render). */
export function apply_instant_expanded_panel_state(
    panel: HTMLElement,
    visibility_host: HTMLElement,
    expanded: boolean,
    expanded_class_name: string = EXPANDABLE_PANEL_EXPANDED_CLASS
): void {
    if (expanded) {
        visibility_host.hidden = false;
        panel.classList.add(expanded_class_name, EXPANDABLE_PANEL_INSTANT_CLASS);
        requestAnimationFrame(() => panel.classList.remove(EXPANDABLE_PANEL_INSTANT_CLASS));
        return;
    }
    visibility_host.hidden = true;
    panel.classList.remove(expanded_class_name);
}

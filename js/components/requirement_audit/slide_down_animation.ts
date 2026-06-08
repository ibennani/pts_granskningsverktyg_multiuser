/**
 * @fileoverview Använder befintliga slide-down-in/out-klasser i granskningsvyn (0,5 s).
 */

export const SLIDE_DOWN_ANIMATION_MS = 500;

export type SlideVisibilityMode = 'display' | 'hidden';

export function prefers_reduced_slide_motion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function is_element_hidden(element: HTMLElement, mode: SlideVisibilityMode): boolean {
    if (mode === 'hidden') {
        return element.hidden;
    }
    if (element.style.display === 'none') {
        return true;
    }
    if (typeof window === 'undefined' || !window.getComputedStyle) {
        return false;
    }
    return window.getComputedStyle(element).display === 'none';
}

function set_element_hidden(element: HTMLElement, hidden: boolean, mode: SlideVisibilityMode): void {
    if (mode === 'hidden') {
        element.hidden = hidden;
        return;
    }
    element.style.display = hidden ? 'none' : '';
}

function clear_slide_classes(element: HTMLElement): void {
    element.classList.remove('slide-down-in', 'slide-down-out');
}

function schedule_slide_in(element: HTMLElement): void {
    clear_slide_classes(element);
    const start_animation = () => {
        element.classList.add('slide-down-in');
        window.setTimeout(() => {
            element.classList.remove('slide-down-in');
        }, SLIDE_DOWN_ANIMATION_MS);
    };
    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(start_animation);
        });
        return;
    }
    start_animation();
}

/** Pågår en slide-out-animation som inte ska avbrytas av synk. */
export function is_slide_out_in_progress(element: HTMLElement | null | undefined): boolean {
    return Boolean(element?.classList?.contains('slide-down-out'));
}

/**
 * Visar eller döljer element med befintlig tonings- och glidanimation.
 * Returnerar true om synligheten ändrades eller en animation startades.
 */
export function set_slide_element_visibility(
    element: HTMLElement | null | undefined,
    should_show: boolean,
    { animate = true, mode = 'display' }: { animate?: boolean; mode?: SlideVisibilityMode } = {}
): boolean {
    if (!element) {
        return false;
    }

    if (is_slide_out_in_progress(element)) {
        return false;
    }

    const is_hidden = is_element_hidden(element, mode);
    if (should_show && !is_hidden) {
        return false;
    }
    if (!should_show && is_hidden) {
        return false;
    }

    if (!animate || prefers_reduced_slide_motion()) {
        set_element_hidden(element, !should_show, mode);
        clear_slide_classes(element);
        return true;
    }

    if (should_show) {
        set_element_hidden(element, false, mode);
        schedule_slide_in(element);
        return true;
    }

    clear_slide_classes(element);
    element.classList.add('slide-down-out');
    window.setTimeout(() => {
        set_element_hidden(element, true, mode);
        clear_slide_classes(element);
    }, SLIDE_DOWN_ANIMATION_MS);
    return true;
}

/** Kriterielistan (.pass-criteria-list) – befintlig CSS-klass. */
export function set_pass_criteria_list_visibility(
    pc_list: HTMLElement | null | undefined,
    should_show: boolean,
    options: { animate?: boolean } = {}
): boolean {
    return set_slide_element_visibility(pc_list, should_show, {
        animate: options.animate,
        mode: 'display'
    });
}

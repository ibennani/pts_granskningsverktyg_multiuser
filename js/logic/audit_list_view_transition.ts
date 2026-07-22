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

/** Kort utfasning innan innehåll byts (stack dold under layout). */
export const TABLE_PAGE_FADE_OUT_MS = 125;

/** Layoutglidning för syskontabeller (parallell med infasning). */
export const TABLE_PAGE_LAYOUT_MS = 500;

/** Infasning av tabellstack (parallell med layoutglidning). */
export const TABLE_PAGE_FADE_IN_MS = 500;

/** Total väntetid: fade ut + parallell fas (max av layout och fade in). */
export const TABLE_PAGE_TRANSITION_TOTAL_MS =
    TABLE_PAGE_FADE_OUT_MS + Math.max(TABLE_PAGE_LAYOUT_MS, TABLE_PAGE_FADE_IN_MS);

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

export const TABLE_PAGE_TRANSITION_EXIT_CLASS = 'generic-table-stack--transition-exit';
export const TABLE_PAGE_TRANSITION_ENTER_CLASS = 'generic-table-stack--transition-enter-start';
export const TABLE_PAGE_HEIGHT_TRANSITION_CLASS = 'generic-table-page-layout-host--height-transition';

export type PaginationFocusAction = 'prev' | 'next';

const page_change_animating_roots = new WeakSet<HTMLElement>();

/** Tar bort tillfälliga opacity-klasser efter sidbytesanimation i tabellstack. */
export function clear_table_page_transition_classes(stack: HTMLElement | null): void {
    if (!stack) return;
    stack.classList.remove(TABLE_PAGE_TRANSITION_EXIT_CLASS, TABLE_PAGE_TRANSITION_ENTER_CLASS);
}

/** Tar bort höjdövergång efter sidbyte (klass och inline-stilar). */
export function clear_table_page_height_transition(layout_host: HTMLElement | null): void {
    if (!layout_host) return;
    layout_host.classList.remove(TABLE_PAGE_HEIGHT_TRANSITION_CLASS);
    layout_host.style.height = '';
    layout_host.style.overflow = '';
    layout_host.style.removeProperty('--table-page-layout-duration');
}

function clear_table_page_opacity_timing(stack: HTMLElement | null): void {
    if (!stack) return;
    stack.style.removeProperty('--table-page-opacity-duration');
}

function force_element_reflow(element: HTMLElement): void {
    void element.offsetHeight;
}

function next_animation_frame(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
    });
}

function apply_table_page_fade_out_timing(stack: HTMLElement): void {
    stack.style.setProperty('--table-page-opacity-duration', `${TABLE_PAGE_FADE_OUT_MS}ms`);
}

function apply_table_page_fade_in_timing(stack: HTMLElement): void {
    stack.style.setProperty('--table-page-opacity-duration', `${TABLE_PAGE_FADE_IN_MS}ms`);
}

function apply_table_page_layout_timing(layout_host: HTMLElement): void {
    layout_host.style.setProperty('--table-page-layout-duration', `${TABLE_PAGE_LAYOUT_MS}ms`);
}

/** Låser layout-host till given höjd så syskon inte hoppar vid omedelbar omrendering. */
function lock_layout_host_height(layout_host: HTMLElement, height_px: number): void {
    layout_host.style.overflow = 'hidden';
    layout_host.style.height = `${height_px}px`;
}

/** Mäter layout-hostens naturliga höjd utan att lämna låst läge permanent (height:auto-trick). */
function measure_layout_host_natural_height(layout_host: HTMLElement): number {
    const prev_height = layout_host.style.height;
    const prev_overflow = layout_host.style.overflow;
    layout_host.style.height = 'auto';
    layout_host.style.overflow = 'hidden';
    const natural_height = layout_host.offsetHeight;
    layout_host.style.height = prev_height;
    layout_host.style.overflow = prev_overflow;
    return natural_height;
}

/** Håller stack dold (opacity 0) utan animation mellan fas 1 och fas 3. */
function hold_table_stack_hidden(stack: HTMLElement): void {
    stack.classList.remove(TABLE_PAGE_TRANSITION_EXIT_CLASS);
    stack.classList.add(TABLE_PAGE_TRANSITION_ENTER_CLASS);
    force_element_reflow(stack);
}

/**
 * Animerar layout-host från låst höjd till innehållets naturliga höjd.
 * Syskontabeller under glider med eftersom höjden ändras i layoutflödet.
 */
async function animate_layout_host_height_after_render(
    layout_host: HTMLElement,
    from_height_px: number,
    duration_ms: number
): Promise<void> {
    const to_height_px = measure_layout_host_natural_height(layout_host);

    if (Math.abs(to_height_px - from_height_px) < 0.5) {
        return;
    }

    layout_host.classList.add(TABLE_PAGE_HEIGHT_TRANSITION_CLASS);
    force_element_reflow(layout_host);
    await next_animation_frame();
    layout_host.style.height = `${to_height_px}px`;
    await wait_element_transition(layout_host, duration_ms);
}

/**
 * Sidbytesanimation: kort fade ut, sedan parallell layoutglidning (0,5 s) och fade in stack.
 * Opacity gäller bara `.generic-table-stack`; syskontabeller flyttas via layout-host-höjd.
 */
export async function run_table_page_change_animation(
    get_stack: () => HTMLElement | null,
    run_render: () => void,
    get_layout_host?: () => HTMLElement | null
): Promise<void> {
    const stack = get_stack();
    const layout_host = get_layout_host?.() ?? stack?.parentElement ?? null;

    if (!stack || prefers_reduced_motion()) {
        run_render();
        clear_table_page_transition_classes(get_stack());
        clear_table_page_height_transition(get_layout_host?.() ?? layout_host);
        clear_table_page_opacity_timing(get_stack());
        return;
    }

    const old_height = layout_host?.offsetHeight ?? 0;
    const should_animate_height = Boolean(layout_host && old_height > 0);

    apply_table_page_fade_out_timing(stack);
    stack.classList.add(TABLE_PAGE_TRANSITION_EXIT_CLASS);
    await wait_element_transition(stack, TABLE_PAGE_FADE_OUT_MS);

    hold_table_stack_hidden(stack);

    if (should_animate_height && layout_host) {
        lock_layout_host_height(layout_host, old_height);
        apply_table_page_layout_timing(layout_host);
        force_element_reflow(layout_host);
    }

    run_render();

    const new_stack = get_stack();
    const new_layout_host = get_layout_host?.() ?? layout_host;
    if (!new_stack) {
        clear_table_page_height_transition(new_layout_host);
        return;
    }

    clear_table_page_transition_classes(new_stack);
    new_stack.classList.add(TABLE_PAGE_TRANSITION_ENTER_CLASS);

    apply_table_page_fade_in_timing(new_stack);
    await next_animation_frame();

    const fade_in_promise = (async () => {
        new_stack.classList.remove(TABLE_PAGE_TRANSITION_ENTER_CLASS);
        await wait_element_transition(new_stack, TABLE_PAGE_FADE_IN_MS);
        clear_table_page_opacity_timing(new_stack);
    })();

    const layout_promise =
        should_animate_height && new_layout_host
            ? animate_layout_host_height_after_render(
                  new_layout_host,
                  old_height,
                  TABLE_PAGE_LAYOUT_MS
              )
            : Promise.resolve();

    await Promise.all([fade_in_promise, layout_promise]);

    if (should_animate_height && new_layout_host) {
        clear_table_page_height_transition(new_layout_host);
    }
}

/** Sparar vilken pagineringsknapp som hade fokus (föregående eller nästa). */
export function capture_pagination_focus_action(stack: HTMLElement | null): PaginationFocusAction | null {
    if (!stack) return null;
    const active = document.activeElement;
    if (!active || !(active instanceof HTMLElement)) return null;
    const nav = stack.querySelector('.table-pagination-nav');
    if (!nav || !nav.contains(active)) return null;
    const action = active.getAttribute('data-pagination-action');
    if (action === 'prev' || action === 'next') return action;
    return null;
}

/** Återställer fokus på samma pagineringsknapp efter sidbyte om den fortfarande finns. */
export function restore_pagination_focus(
    stack: HTMLElement | null,
    action: PaginationFocusAction | null
): void {
    if (!stack || !action) return;
    const btn = stack.querySelector(
        `.table-pagination-btn[data-pagination-action="${CSS.escape(action)}"]`
    ) as HTMLElement | null;
    if (!btn || !document.contains(btn)) return;
    try {
        btn.focus({ preventScroll: true });
    } catch {
        btn.focus();
    }
}

type WrapTablePageChangeOptions = {
    is_blocked?: () => boolean;
};

/**
 * Omsluter sidbytescallback med parallell opacity- och layoutanimation (tabell + paginering).
 */
export function wrap_table_page_change_handler(
    root_el: HTMLElement,
    on_page_change: (page: number) => void,
    options: WrapTablePageChangeOptions = {}
): (page: number) => void {
    return (new_page: number) => {
        if (options.is_blocked?.() || page_change_animating_roots.has(root_el)) return;
        void (async () => {
            const get_stack = () => root_el.querySelector('.generic-table-stack') as HTMLElement | null;
            const get_layout_host = () => root_el;
            const focus_action = capture_pagination_focus_action(get_stack());
            page_change_animating_roots.add(root_el);
            try {
                await run_table_page_change_animation(
                    get_stack,
                    () => on_page_change(new_page),
                    get_layout_host
                );
            } finally {
                page_change_animating_roots.delete(root_el);
            }
            restore_pagination_focus(get_stack(), focus_action);
        })();
    };
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

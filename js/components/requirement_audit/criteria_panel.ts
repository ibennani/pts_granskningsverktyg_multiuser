/**

 * @fileoverview Öppnar/stänger kriteriepaneler med keyframe-slide (0,5 s).

 */



export const PANEL_OPEN_CLASS = 'criteria-panel--open';

export const PANEL_ANIMATION_MS = 500;



const SYNC_BLOCK_ATTR = 'data-sync-block-until';

const sync_block_until = new WeakMap<HTMLElement, number>();

/** Per kontrollpunkt – överlever DOM-ersättning och dubbla modulinstanser. */
const check_animation_block_until = new Map<string, number>();



function prefers_reduced_motion(): boolean {

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {

        return false;

    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;

}



function read_sync_block_until(panel: HTMLElement): number {

    return sync_block_until.get(panel) ?? Number(panel.getAttribute(SYNC_BLOCK_ATTR) || 0);

}



/** Blockera state-synk medan panel animeras. */

export function is_check_panel_animation_blocked(check_id: string | null | undefined): boolean {

    if (!check_id) {

        return false;

    }

    const until = check_animation_block_until.get(check_id) ?? 0;

    if (until <= Date.now()) {

        check_animation_block_until.delete(check_id);

        return false;

    }

    return true;

}



export function is_panel_sync_blocked(

    panel: HTMLElement | null | undefined,

    check_id: string | null | undefined = null

): boolean {

    if (is_check_panel_animation_blocked(check_id)) {

        return true;

    }

    if (!panel) {

        return false;

    }

    return read_sync_block_until(panel) > Date.now();

}



export function get_panel_sync_remaining_ms(panel: HTMLElement | null | undefined): number {

    if (!panel) {

        return 0;

    }

    return Math.max(0, read_sync_block_until(panel) - Date.now());

}



function block_sync(panel: HTMLElement, check_id: string | null | undefined = null): void {

    const until = Date.now() + PANEL_ANIMATION_MS + 80;

    sync_block_until.set(panel, until);

    panel.setAttribute(SYNC_BLOCK_ATTR, String(until));

    if (check_id) {

        check_animation_block_until.set(check_id, until);

    }

}



function clear_sync_block(panel: HTMLElement, check_id: string | null | undefined = null): void {

    sync_block_until.delete(panel);

    panel.removeAttribute(SYNC_BLOCK_ATTR);

    if (check_id) {

        check_animation_block_until.delete(check_id);

    }

}



function panel_is_open(panel: HTMLElement): boolean {

    return panel.classList.contains(PANEL_OPEN_CLASS) && !panel.hidden;

}



function clear_panel_animation_classes(panel: HTMLElement): void {

    panel.classList.remove('slide-down-in', 'slide-down-out');

}



/**

 * Öppnar eller stänger en .criteria-panel (t.ex. godkännandekriterier, informationsrad).

 */

export function set_panel_open(

    panel: HTMLElement | null | undefined,

    should_open: boolean,

    { animate = true, check_id = null }: { animate?: boolean; check_id?: string | null } = {}

): boolean {

    if (!panel) {

        return false;

    }

    if (is_panel_sync_blocked(panel, check_id)) {

        return false;

    }

    if (should_open === panel_is_open(panel)) {

        return false;

    }



    const use_animation = animate && !prefers_reduced_motion();



    if (!use_animation) {

        panel.hidden = !should_open;

        panel.classList.toggle(PANEL_OPEN_CLASS, should_open);

        clear_panel_animation_classes(panel);

        clear_sync_block(panel, check_id);

        return true;

    }



    block_sync(panel, check_id);



    if (should_open) {

        panel.hidden = false;

        panel.classList.add(PANEL_OPEN_CLASS);

        panel.classList.remove('slide-down-out');

        panel.classList.add('slide-down-in');

        void panel.offsetHeight;

        window.setTimeout(() => {

            panel.classList.remove('slide-down-in');

            clear_sync_block(panel, check_id);

        }, PANEL_ANIMATION_MS);

        return true;

    }



    panel.classList.remove(PANEL_OPEN_CLASS);

    panel.classList.remove('slide-down-in');

    panel.classList.add('slide-down-out');

    void panel.offsetHeight;

    window.setTimeout(() => {

        panel.hidden = true;

        panel.classList.remove('slide-down-out');

        clear_sync_block(panel, check_id);

    }, PANEL_ANIMATION_MS);

    return true;

}



/** Keyframe-slide för observationsfält (befintlig CSS). */

export function is_slide_out_in_progress(element: HTMLElement | null | undefined): boolean {

    return Boolean(element?.classList?.contains('slide-down-out'));

}



export function toggle_slide_hidden_element(

    element: HTMLElement | null | undefined,

    should_show: boolean,

    { animate = true }: { animate?: boolean } = {}

): boolean {

    if (!element) {

        return false;

    }

    if (is_slide_out_in_progress(element)) {

        return false;

    }



    const is_hidden = element.hidden;

    if (should_show && !is_hidden) {

        return false;

    }

    if (!should_show && is_hidden) {

        return false;

    }



    if (!animate || prefers_reduced_motion()) {

        element.hidden = !should_show;

        element.classList.remove('slide-down-in', 'slide-down-out');

        return true;

    }



    if (should_show) {

        element.hidden = false;

        element.classList.remove('slide-down-out');

        element.classList.add('slide-down-in');

        void element.offsetHeight;

        window.setTimeout(() => {

            element.classList.remove('slide-down-in');

        }, PANEL_ANIMATION_MS);

        return true;

    }



    element.classList.remove('slide-down-in');

    element.classList.add('slide-down-out');

    void element.offsetHeight;

    window.setTimeout(() => {

        element.hidden = true;

        element.classList.remove('slide-down-out');

    }, PANEL_ANIMATION_MS);

    return true;

}



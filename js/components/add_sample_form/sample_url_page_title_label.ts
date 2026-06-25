/**
 * @fileoverview Visuell laddningsindikator på beskrivningsetiketten vid hämtning av sidtitel.
 */

import { get_icon_svg as default_get_icon_svg } from '../../ui/icons.js';

export type SampleUrlPageTitleLabelComponentLike = {
    description_label_element: HTMLLabelElement | null;
    get_page_title_label_loading_count: () => number;
    set_page_title_label_loading_count: (count: number) => void;
    get_t_internally: () => (key: string, params?: Record<string, unknown>) => string;
    Helpers?: { get_icon_svg?: (name: string, colors?: string[], size?: number) => string };
};

const LABEL_TEXT_SELECTOR = '.sample-description-label__text';
const LABEL_SPINNER_SELECTOR = '.sample-description-label__spinner';

function resolve_get_icon_svg(Helpers: SampleUrlPageTitleLabelComponentLike['Helpers']) {
    return Helpers?.get_icon_svg ?? default_get_icon_svg;
}

function get_default_label_text(component: SampleUrlPageTitleLabelComponentLike): string {
    return component.get_t_internally()('description');
}

function get_label_text_element(label: HTMLLabelElement): HTMLElement | null {
    const text_el = label.querySelector(LABEL_TEXT_SELECTOR);
    return text_el instanceof HTMLElement ? text_el : null;
}

/**
 * Aktiverar aria-live strax före textuppdatering så skärmläsare hör ändringen.
 * Attributet sätts inte vid sidladdning — endast vid dynamiska etikettbyten.
 */
function update_label_text_with_live_region(text_el: HTMLElement, next_text: string, on_settled?: () => void): void {
    text_el.setAttribute('aria-live', 'polite');
    text_el.setAttribute('aria-atomic', 'true');
    requestAnimationFrame(() => {
        text_el.textContent = next_text;
        if (on_settled) {
            requestAnimationFrame(on_settled);
        }
    });
}

function clear_label_live_region(text_el: HTMLElement): void {
    text_el.removeAttribute('aria-live');
    text_el.removeAttribute('aria-atomic');
}

function ensure_label_spinner(label: HTMLLabelElement, Helpers: SampleUrlPageTitleLabelComponentLike['Helpers']): void {
    if (label.querySelector(LABEL_SPINNER_SELECTOR)) return;
    const spinner_wrap = document.createElement('span');
    spinner_wrap.className = 'sample-description-label__spinner';
    spinner_wrap.setAttribute('aria-hidden', 'true');
    const text_el = get_label_text_element(label);
    const svg = resolve_get_icon_svg(Helpers)('loader', ['currentColor'], 16);
    spinner_wrap.innerHTML = svg;
    if (text_el) {
        label.insertBefore(spinner_wrap, text_el);
    } else {
        label.prepend(spinner_wrap);
    }
}

function set_label_loading_ui(component: SampleUrlPageTitleLabelComponentLike, loading: boolean): void {
    const label = component.description_label_element;
    if (!label) return;

    const text_el = get_label_text_element(label);
    if (!text_el) return;

    if (loading) {
        label.classList.add('sample-description-label--loading');
        ensure_label_spinner(label, component.Helpers);
        update_label_text_with_live_region(
            text_el,
            component.get_t_internally()('sample_page_title_fetching_label')
        );
        return;
    }

    label.classList.remove('sample-description-label--loading');
    label.querySelector(LABEL_SPINNER_SELECTOR)?.remove();
    update_label_text_with_live_region(
        text_el,
        get_default_label_text(component),
        () => clear_label_live_region(text_el)
    );
}

export function begin_sample_description_page_title_loading(
    component: SampleUrlPageTitleLabelComponentLike
): void {
    const next_count = component.get_page_title_label_loading_count() + 1;
    component.set_page_title_label_loading_count(next_count);
    if (next_count === 1) {
        set_label_loading_ui(component, true);
    }
}

export function end_sample_description_page_title_loading(
    component: SampleUrlPageTitleLabelComponentLike
): void {
    const current = component.get_page_title_label_loading_count();
    if (current <= 0) return;
    const next_count = current - 1;
    component.set_page_title_label_loading_count(next_count);
    if (next_count === 0) {
        set_label_loading_ui(component, false);
    }
}

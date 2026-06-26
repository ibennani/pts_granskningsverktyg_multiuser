/**
 * @fileoverview Toggle aria-live kring dynamiska textbyten (knappar, etiketter).
 * Sätter aria-live innan text ändras och tar bort attributet när default-text återställs.
 */

/**
 * Aktiverar aria-live strax före textuppdatering så skärmläsare hör ändringen.
 * Attributet ska inte finnas vid sidladdning — endast vid dynamiska textbyten.
 */
export function update_text_with_temporary_live_region(
    text_el: HTMLElement,
    next_text: string,
    on_settled?: () => void
): void {
    text_el.setAttribute('aria-live', 'polite');
    text_el.setAttribute('aria-atomic', 'true');
    requestAnimationFrame(() => {
        text_el.textContent = next_text;
        if (on_settled) {
            requestAnimationFrame(on_settled);
        }
    });
}

/** Tar bort tillfällig live-region efter återgång till default-text. */
export function clear_temporary_live_region(text_el: HTMLElement): void {
    text_el.removeAttribute('aria-live');
    text_el.removeAttribute('aria-atomic');
}

/** Första synliga textspan i knapp (exkluderar aria-hidden ikoner). */
export function get_button_primary_label_span(button: HTMLElement): HTMLElement | null {
    const span = button.querySelector('span:not([aria-hidden="true"])');
    return span instanceof HTMLElement ? span : null;
}

/**
 * Visar tillfällig knapptext med live-region; återställer default efter timeout.
 */
export function show_temporary_button_label_feedback(
    button: HTMLElement,
    temporary_text: string,
    reset_ms: number,
    options: { copied_class_name?: string } = {}
): void {
    const text_el = get_button_primary_label_span(button);
    if (!text_el) return;

    const default_text = text_el.textContent || '';
    update_text_with_temporary_live_region(text_el, temporary_text);

    if (options.copied_class_name) {
        button.classList.add(options.copied_class_name);
    }

    window.setTimeout(() => {
        update_text_with_temporary_live_region(text_el, default_text, () => {
            clear_temporary_live_region(text_el);
        });
        if (options.copied_class_name) {
            button.classList.remove(options.copied_class_name);
        }
    }, reset_ms);
}

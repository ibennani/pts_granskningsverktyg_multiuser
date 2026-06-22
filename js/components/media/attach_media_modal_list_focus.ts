/**
 * @fileoverview Fokusmål i filistan efter borttagning i modalen Bifoga media.
 */

function focus_element_safe(element: HTMLElement | null | undefined): void {
    if (!element || !document.contains(element)) return;
    try {
        element.focus({ preventScroll: true });
    } catch {
        element.focus();
    }
}

/**
 * Hittar fokusmål efter borttagning: föregående miniatyr, annars nästa, annars lägg-till-knapp.
 */
export function resolve_focus_after_removed_item(
    list_container: HTMLElement,
    modal_container: HTMLElement,
    removed_index: number
): HTMLElement | null {
    const items = list_container.querySelectorAll<HTMLElement>('.attach-media-filename-list__item');
    if (items.length === 0) {
        const choose_btn = modal_container.querySelector<HTMLButtonElement>('.attach-media-choose-file-btn');
        const empty_item = list_container.querySelector<HTMLElement>('.attach-media-filename-list__empty');
        return choose_btn || empty_item || null;
    }

    const focus_item_index = removed_index > 0 ? removed_index - 1 : 0;
    const item = items[focus_item_index];
    if (!item) return null;

    const thumb_btn = item.querySelector<HTMLButtonElement>('.audit-image-card__media-thumb-btn');
    if (thumb_btn) return thumb_btn;

    const remove_btn = item.querySelector<HTMLButtonElement>(
        '.attach-media-filename-list__actions button'
    );
    return remove_btn || null;
}

/**
 * Flyttar fokus efter borttagning (anropas efter vyväxlingsanimation).
 */
export function focus_after_removed_item(
    list_container: HTMLElement,
    modal_container: HTMLElement,
    removed_index: number
): void {
    const target = resolve_focus_after_removed_item(list_container, modal_container, removed_index);
    requestAnimationFrame(() => {
        focus_element_safe(target);
    });
}

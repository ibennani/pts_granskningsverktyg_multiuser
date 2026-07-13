/**
 * Overlay portal – gemensam container för dropdowns, tooltips m.m. så att de
 * inte klipps av overflow på förfäder. Alla noder som renderas här hamnar
 * direkt under body och påverkas inte av #app-container eller .content-plate.
 */

const OVERLAY_ID = 'app-overlay';

/**
 * Returnerar overlay-containern. Skapar den vid första anrop om den inte finns.
 * @returns {HTMLElement}
 */
export function get_overlay_container() {
    let el = document.getElementById(OVERLAY_ID);
    if (!el) {
        el = document.createElement('div');
        el.id = OVERLAY_ID;
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
    }
    return el;
}

/**
 * Flyttar en nod in i overlay-containern (appendar den så att den visas ovanpå
 * sidinnehållet och inte klipps). Användaren ansvarar för att antingen
 * anropa remove_from_overlay när noden ska bort, eller ta bort noden manuellt.
 * @param {Node} node - Noden som ska rendera i overlay (t.ex. en panel eller tooltip).
 */
export function render_in_overlay(node) {
    if (!node) return;
    const container = get_overlay_container();
    if (node.parentNode !== container) {
        container.appendChild(node);
    }
}

/**
 * Tar bort en nod från overlay-containern. Noden förstörs inte – användaren
 * kan återanvända den eller append till annan parent.
 * @param {Node} node - Noden som ska tas bort från overlay.
 */
export function remove_from_overlay(node) {
    if (!node || !node.parentNode) return;
    if (node.parentNode.id === OVERLAY_ID) {
        node.parentNode.removeChild(node);
    }
}

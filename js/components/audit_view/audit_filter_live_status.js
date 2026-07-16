/**
 * @fileoverview Dold role=status-bekräftelse när filter i granskningslistan återställs.
 */

const CLEAR_AFTER_MS = 800;

/**
 * Meddelar skärmläsare att filtret återställts (visuellt dolt).
 * @param {HTMLElement | null | undefined} live_region
 * @param {string} message
 */
export function announce_audit_filter_reset(live_region, message) {
    if (!live_region) return;
    live_region.textContent = message;
    setTimeout(() => {
        live_region.textContent = '';
    }, CLEAR_AFTER_MS);
}

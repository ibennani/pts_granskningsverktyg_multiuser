// js/utils/incremental_list_update.js
// Hjälpfunktioner för att endast uppdatera ändrade listobjekt istället för full re-render.

/**
 * Skapar en fingerprint-sträng för att jämföra om liststruktur (items + ordning) är oförändrad.
 * @param {Array} item_keys - Array av unika nycklar för varje listobjekt
 * @returns {string}
 */
export function fingerprint_item_keys(item_keys) {
    return JSON.stringify(item_keys || []);
}

/**
 * Kontrollerar om vi kan göra inkrementell uppdatering (samma items, samma ordning).
 * @param {string} prev_fingerprint
 * @param {string} new_fingerprint
 * @returns {boolean}
 */
export function can_incremental_update(prev_fingerprint, new_fingerprint) {
    return prev_fingerprint != null && prev_fingerprint === new_fingerprint;
}

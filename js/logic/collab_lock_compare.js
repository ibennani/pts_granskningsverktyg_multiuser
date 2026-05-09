// js/logic/collab_lock_compare.js
// Gemensam jämförelse: räknas ett serverlås som "av annan användare/annan session" än den inloggade i denna vy?

/**
 * @param {{ user_name?: string|null, client_lock_id?: string|null }|null|undefined} lock_row
 * @param {string} current_user_name
 * @param {string} [my_client_lock_id] - Om angivet, jämförs även klient-ID (viktigt för att blockera olika flikar med samma användare)
 * @returns {boolean}
 */
/**
 * True om låsraden tillhör en annan **person** (annat visningsnamn än den inloggade).
 * Används för att avgöra om vi ska avbryta före try_acquire: samma användare i annan webbläsare/flik
 * ska fortfarande få försöka POST (servern tillåter övertagning för samma user_id).
 * @param {{ user_name?: string|null }|null|undefined} lock_row
 * @param {string} current_user_name
 * @returns {boolean}
 */
export function is_lock_held_by_different_logged_in_user(lock_row, current_user_name) {
    if (!lock_row) return false;
    const remote = String(lock_row.user_name ?? '').trim().toLowerCase();
    const mine = String(current_user_name ?? '').trim().toLowerCase();
    if (!remote || !mine) return false;
    return remote !== mine;
}

export function is_remote_lock_held_by_other_user(lock_row, current_user_name, my_client_lock_id) {
    if (!lock_row) return false;

    // Om vi skickar med klient-ID vet vi säkert om det är EXAKT vår flik eller någon annans
    if (my_client_lock_id && lock_row.client_lock_id) {
        if (String(lock_row.client_lock_id) === String(my_client_lock_id)) {
            return false; // Låset tillhör oss (denna tab)
        } else {
            return true; // Låset tillhör en annan klient (annan användare eller samma användare i annan tab)
        }
    }

    const remote = String(lock_row.user_name ?? '').trim();
    if (!remote) return false;
    const mine = String(current_user_name ?? '').trim();
    if (!mine) return true;
    return remote.toLowerCase() !== mine.toLowerCase();
}

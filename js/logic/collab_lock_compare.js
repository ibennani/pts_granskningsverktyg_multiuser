// js/logic/collab_lock_compare.js
// Gemensam jämförelse: räknas ett serverlås som "av annan användare/annan session" än den inloggade i denna vy?

import { is_user_uuid } from '../../shared/user/user_identity.js';

/**
 * @param {{ user_id?: string|null, user_name?: string|null, client_lock_id?: string|null }|null|undefined} lock_row
 * @param {string} current_user_name
 * @param {string} [my_client_lock_id] - Om angivet, jämförs även klient-ID (viktigt för att blockera olika flikar med samma användare)
 * @param {string|null} [current_user_id]
 * @returns {boolean}
 */
export function is_remote_lock_held_by_other_user(
    lock_row,
    current_user_name,
    my_client_lock_id,
    current_user_id = null
) {
    if (!lock_row) return false;

    // Om vi skickar med klient-ID vet vi säkert om det är EXAKT vår flik eller någon annans
    if (my_client_lock_id && lock_row.client_lock_id) {
        if (String(lock_row.client_lock_id) === String(my_client_lock_id)) {
            return false; // Låset tillhör oss (denna tab)
        }
        return true; // Låset tillhör en annan klient (annan användare eller samma användare i annan tab)
    }

    const remote_id = String(lock_row.user_id ?? '').trim();
    const mine_id = String(current_user_id ?? '').trim();
    if (remote_id && mine_id && is_user_uuid(remote_id) && is_user_uuid(mine_id)) {
        return remote_id.toLowerCase() !== mine_id.toLowerCase();
    }

    const remote = String(lock_row.user_name ?? '').trim();
    if (!remote) return false;
    const mine = String(current_user_name ?? '').trim();
    if (!mine) return true;
    return remote.toLowerCase() !== mine.toLowerCase();
}

/**
 * @param {{ user_id?: string|null, user_name?: string|null, client_lock_id?: string|null }|null|undefined} lock_row
 * @param {string} current_user_name
 * @param {string} [my_client_lock_id]
 * @param {string|null} [current_user_id]
 * @returns {boolean}
 */
export function is_lock_held_by_different_logged_in_user(
    lock_row,
    current_user_name,
    my_client_lock_id,
    current_user_id = null
) {
    return is_remote_lock_held_by_other_user(
        lock_row,
        current_user_name,
        my_client_lock_id,
        current_user_id
    );
}

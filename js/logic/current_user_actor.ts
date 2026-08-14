/**
 * @file Referens till inloggad användare för spårning (id före visningsnamn).
 */

import { get_current_user_name } from '../user/current_user.js';

const AUTH_USER_ID_KEY = 'gv_current_user_id';

function read_current_user_id_from_session(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(AUTH_USER_ID_KEY);
        return raw && String(raw).trim() ? String(raw).trim() : null;
    } catch {
        return null;
    }
}

/** Användar-id om inloggad, annars visningsnamn (legacy). */
export function get_current_user_actor_ref(): string {
    const user_id = read_current_user_id_from_session();
    if (user_id) return user_id;
    return get_current_user_name() || '';
}

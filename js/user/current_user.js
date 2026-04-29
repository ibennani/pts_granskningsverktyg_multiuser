import { get_current_user_name_window } from '../app/browser_globals.js';

/**
 * Aktuell användare i runtime.
 */

export function get_current_user_name() {
    if (typeof window === 'undefined') return '';
    return (get_current_user_name_window() ||
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gv_current_user_name'))) || '';
}


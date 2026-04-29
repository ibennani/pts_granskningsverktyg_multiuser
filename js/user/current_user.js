/**
 * Aktuell användare i runtime.
 */

export function get_current_user_name() {
    if (typeof window === 'undefined') return '';
    return (window.__GV_CURRENT_USER_NAME__ ||
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gv_current_user_name'))) || '';
}


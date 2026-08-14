import { get_current_user_name_window } from '../app/browser_globals.js';
import { app_session_storage } from '../utils/scoped_browser_storage.js';

/**
 * Aktuell användare i runtime.
 */

export function get_current_user_name() {
    if (typeof window === 'undefined') return '';
    return (get_current_user_name_window() ||
        app_session_storage.getItem('gv_current_user_name')) || '';
}


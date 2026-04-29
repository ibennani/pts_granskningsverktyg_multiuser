/**
 * @file Läs/skriv för runtime-nycklar på `window` (vy, användare, API-bas, fokus m.m.).
 * Behåller befintliga namn internt så äldre skript och tester kan sätta dem direkt.
 */

/**
 * @param {string} viewName
 * @param {string} paramsJsonString
 */
export function set_current_view_tracking(viewName, paramsJsonString) {
    if (typeof window === 'undefined') return;
    window.__gv_current_view_name = viewName;
    window.__gv_current_view_params_json = paramsJsonString;
}

/** @returns {string|undefined} */
export function get_current_view_name() {
    return typeof window !== 'undefined' ? window.__gv_current_view_name : undefined;
}

/** @returns {string|undefined} */
export function get_current_view_params_json() {
    return typeof window !== 'undefined' ? window.__gv_current_view_params_json : undefined;
}

/** @returns {string} */
export function get_api_base_url() {
    if (typeof window === 'undefined') return '/v2/api';
    const b = window.__GV_API_BASE__;
    return b ? String(b) : '/v2/api';
}

/** @returns {string|undefined} */
export function get_current_user_name_window() {
    return typeof window !== 'undefined' ? window.__GV_CURRENT_USER_NAME__ : undefined;
}

/** @param {string|undefined} name */
export function set_current_user_name_window(name) {
    if (typeof window !== 'undefined') window.__GV_CURRENT_USER_NAME__ = name;
}

export function clear_current_user_name_window() {
    if (typeof window !== 'undefined') delete window.__GV_CURRENT_USER_NAME__;
}

/** @returns {unknown} */
export function get_restore_focus_info() {
    return typeof window !== 'undefined' ? window.__gv_restore_focus_info : undefined;
}

/** @param {unknown} info */
export function set_restore_focus_info(info) {
    if (typeof window !== 'undefined') window.__gv_restore_focus_info = info;
}

export function clear_restore_focus_info() {
    if (typeof window !== 'undefined') window.__gv_restore_focus_info = null;
}

/** @returns {unknown} */
export function get_restore_position_via_hook() {
    if (typeof window === 'undefined') return null;
    const fn = window.__gv_get_restore_position;
    return typeof fn === 'function' ? fn() : null;
}

/** @param {() => unknown} fn */
export function set_restore_position_getter(fn) {
    if (typeof window !== 'undefined') {
        window.__gv_get_restore_position = fn;
    }
}

/** @returns {unknown} */
export function get_pending_checklist_focus_target() {
    return typeof window !== 'undefined' ? window.__gv_pending_checklist_focus_target : undefined;
}

/** @param {unknown} target */
export function set_pending_checklist_focus_target(target) {
    if (typeof window !== 'undefined') window.__gv_pending_checklist_focus_target = target;
}

/** @returns {boolean} */
export function is_auth_required_in_progress() {
    return typeof window !== 'undefined' && !!window.__gv_auth_required_in_progress;
}

/** @param {boolean} value */
export function set_auth_required_in_progress(value) {
    if (typeof window !== 'undefined') window.__gv_auth_required_in_progress = value;
}

/** @returns {boolean} */
export function is_same_hash_render_scheduled() {
    return typeof window !== 'undefined' && window.__gv_same_hash_render_scheduled === true;
}

/** @param {boolean} value */
export function set_same_hash_render_scheduled(value) {
    if (typeof window !== 'undefined') window.__gv_same_hash_render_scheduled = value;
}

/** @returns {boolean} */
export function is_audit_deleted_modal_shown() {
    return typeof window !== 'undefined' && !!window.__GV_AUDIT_DELETED_MODAL_SHOWN__;
}

/** @param {boolean} value */
export function set_audit_deleted_modal_shown(value) {
    if (typeof window !== 'undefined') window.__GV_AUDIT_DELETED_MODAL_SHOWN__ = value;
}

/** @returns {boolean} */
export function get_show_empty_metadata_form() {
    return typeof window !== 'undefined' && window.__GV_SHOW_EMPTY_METADATA_FORM === true;
}

/** @param {boolean} value */
export function set_show_empty_metadata_form(value) {
    if (typeof window !== 'undefined') window.__GV_SHOW_EMPTY_METADATA_FORM = value;
}

export function clear_show_empty_metadata_form() {
    if (typeof window !== 'undefined') delete window.__GV_SHOW_EMPTY_METADATA_FORM;
}

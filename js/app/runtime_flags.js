/**
 * @file Felsökningsflaggor på `window` — samma nycklar som tidigare (DevTools/konsol).
 * Använd dessa funktioner i stället för direkt `window.__GV_DEBUG_*` i applikationskod.
 */

/** @returns {boolean} */
export function is_debug_nav() {
    return typeof window !== 'undefined' && !!window.__GV_DEBUG_NAV;
}

/** @param {boolean} value */
export function set_debug_nav(value) {
    if (typeof window !== 'undefined') window.__GV_DEBUG_NAV = value;
}

/** @returns {boolean} */
export function is_debug_modal_scroll() {
    return typeof window !== 'undefined' && !!window.__GV_DEBUG_MODAL_SCROLL;
}

/** @returns {boolean} */
export function is_debug_stuck_sync() {
    return typeof window !== 'undefined' && !!window.__GV_DEBUG_STUCK_SYNC__;
}

/** @returns {boolean} */
export function is_debug_autosave_focus() {
    return typeof window !== 'undefined' && !!window.__GV_DEBUG_AUTOSAVE_FOCUS;
}

/** @returns {boolean} */
export function is_debug_problems_update() {
    return typeof window !== 'undefined' && !!window.__GV_DEBUG_PROBLEMS_UPDATE__;
}

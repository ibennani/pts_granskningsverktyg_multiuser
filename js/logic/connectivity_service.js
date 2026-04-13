// js/logic/connectivity_service.js
// Online/offline-indikering, pending-synk till server och meddelanden i global-message-area.

import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import { ensure_main_view_content_host } from './app_dom.js';

/** @type {boolean} */
let pending_audit_sync = false;
/** @type {boolean} */
let pending_rulefile_sync = false;
/** @type {boolean} */
let showing_offline_banner = false;
/** @type {function(): Object|null} */
let get_state_fn = null;
/** @type {function(Object): void} */
let dispatch_fn = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let success_clear_timer = null;

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function is_fetch_network_error(err) {
    if (!err || typeof err !== 'object') return false;
    const status = /** @type {{ status?: number }} */ (err).status;
    if (typeof status === 'number' && status > 0) {
        return false;
    }
    const e = /** @type {{ name?: string, message?: string }} */ (err);
    if (e.name === 'TypeError') return true;
    const msg = String(e.message || '');
    if (/failed to fetch|networkerror|load failed|network request failed|aborted/i.test(msg)) {
        return true;
    }
    return false;
}

export function mark_audit_sync_pending() {
    pending_audit_sync = true;
}

export function mark_rulefile_sync_pending() {
    pending_rulefile_sync = true;
}

export function clear_audit_sync_pending() {
    pending_audit_sync = false;
}

export function clear_rulefile_sync_pending() {
    pending_rulefile_sync = false;
}

export function has_pending_server_sync() {
    return pending_audit_sync || pending_rulefile_sync;
}

/**
 * Anropas när synk misslyckats p.g.a. nätverk – visar samma offline-banner om den inte redan visas.
 */
export function notify_network_unreachable_for_sync() {
    if (typeof window === 'undefined') return;
    show_offline_banner_if_needed();
}

function show_offline_banner_if_needed() {
    if (showing_offline_banner) return;
    const t = window.Translation?.t;
    const NotificationComponent = app_runtime_refs.notification_component;
    if (!t || !NotificationComponent?.show_global_message) return;
    NotificationComponent.show_global_message(t('connectivity_offline_message'), 'warning');
    showing_offline_banner = true;
}

function clear_offline_banner() {
    if (!showing_offline_banner) return;
    if (app_runtime_refs.notification_component?.clear_global_message) {
        app_runtime_refs.notification_component.clear_global_message();
    }
    showing_offline_banner = false;
}

function show_sync_complete_message() {
    if (typeof window === 'undefined') return;
    const t = window.Translation?.t;
    const NotificationComponent = app_runtime_refs.notification_component;
    if (!t || !NotificationComponent?.show_global_message) return;
    if (success_clear_timer) {
        clearTimeout(success_clear_timer);
        success_clear_timer = null;
    }
    NotificationComponent.show_global_message(t('connectivity_online_all_saved_message'), 'success');
    success_clear_timer = setTimeout(() => {
        success_clear_timer = null;
        if (app_runtime_refs.notification_component?.clear_global_message) {
            app_runtime_refs.notification_component.clear_global_message();
        }
    }, 8000);
}

async function flush_pending_syncs_from_server_module() {
    const { flush_sync_to_server, flush_sync_rulefile_to_server } = await import('./server_sync.js');
    const getState = get_state_fn;
    const dispatch = dispatch_fn;
    if (typeof getState !== 'function' || typeof dispatch !== 'function') return;
    await flush_sync_to_server(getState, dispatch);
    await flush_sync_rulefile_to_server(getState, dispatch);
}

async function handle_online_event() {
    if (typeof window === 'undefined') return;
    const had_pending_before = has_pending_server_sync();
    clear_offline_banner();

    await flush_pending_syncs_from_server_module();

    if (has_pending_server_sync()) {
        show_offline_banner_if_needed();
        return;
    }

    if (had_pending_before) {
        show_sync_complete_message();
    }
}

function handle_offline_event() {
    show_offline_banner_if_needed();
}

/**
 * @param {{ getState: function(): Object, dispatch: function(Object): void }} options
 */
export function init_connectivity_service(options) {
    const { getState, dispatch } = options || {};
    get_state_fn = typeof getState === 'function' ? getState : null;
    dispatch_fn = typeof dispatch === 'function' ? dispatch : null;

    if (typeof window === 'undefined') return;

    const main_el = document.getElementById('app-main-view-root');
    const NotificationComponent = app_runtime_refs.notification_component;
    if (main_el && NotificationComponent?.init && NotificationComponent.append_global_message_areas_to) {
        ensure_main_view_content_host(main_el);
        NotificationComponent.init().then(() => {
            NotificationComponent.append_global_message_areas_to(main_el);
            if (!navigator.onLine) {
                show_offline_banner_if_needed();
            }
        });
    } else if (!navigator.onLine) {
        show_offline_banner_if_needed();
    }

    window.addEventListener('online', () => {
        handle_online_event();
    });
    window.addEventListener('offline', () => {
        handle_offline_event();
    });
}

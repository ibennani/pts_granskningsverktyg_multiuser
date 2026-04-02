/**
 * Hash-baserad routing: tolkning av URL, navigering och hashchange-hantering.
 * @module js/logic/router
 */

import { is_current_user_admin, get_auth_token, get_current_user_preferences_with_timeout, set_current_user_admin } from '../api/client.js';
import { consoleManager } from '../utils/console_manager.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import * as ValidationLogic from '../validation_logic.js';

if (typeof window !== 'undefined' && window.__GV_DEBUG_NAV) {
    consoleManager.log('[router] Debug-navigering aktiv.');
}

const SKIP_LINK_ANCHOR_ID = 'main-content-heading';

export function parse_view_and_params_from_hash() {
    const hash = typeof window !== 'undefined' && window.location?.hash ? window.location.hash.substring(1) : '';
    const is_skip_link = hash === 'main-content-heading';
    const [view_name, ...param_pairs] = hash.split('?');
    const params = {};
    if (param_pairs.length > 0 && !is_skip_link && view_name) {
        const query_string = param_pairs.join('?');
        const url_params = new URLSearchParams(query_string);
        for (const [key, value] of url_params) { params[key] = value; }
    }
    return {
        viewName: (is_skip_link || !view_name) ? 'start' : view_name,
        params: (is_skip_link || !view_name) ? {} : params
    };
}

export function get_route_key_from_hash() {
    const hash = window.location.hash || '';
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    const [view_name] = raw.split('?');
    return view_name || 'start';
}

export function get_scope_key_from_hash({ current_view_name_rendered, current_view_params_rendered_json }) {
    const route_key = get_route_key_from_hash();
    if (current_view_name_rendered === route_key) {
        return `${route_key}:${current_view_params_rendered_json}`;
    }
    const raw = (window.location.hash || '').replace(/^#/, '');
    const [, query = ''] = raw.split('?');
    if (!query) return `${route_key}:{}`;
    const url_params = new URLSearchParams(query);
    const params_obj = {};
    Array.from(url_params.entries()).forEach(([key, value]) => { params_obj[key] = value; });
    return `${route_key}:${JSON.stringify(params_obj)}`;
}

export function get_scope_key_from_view_and_params(view, params) {
    const route_key = view || 'start';
    const safe_params = params && typeof params === 'object' ? params : {};
    return `${route_key}:${JSON.stringify(safe_params)}`;
}

export function navigate_and_set_hash(target_view_name, target_params = {}, options) {
    const {
        nav_debug,
        getState,
        get_current_view_name,
        get_current_view_component,
        updatePageTitle
    } = options;

    nav_debug('navigate_and_set_hash anropad', { target_view_name, target_params, current_hash: window.location.hash });
    if (target_view_name === 'manage_users' && !is_current_user_admin()) {
        window.location.hash = '#start';
        return;
    }
    const current_state_for_nav = typeof getState === 'function' ? getState() : null;
    const is_new_audit_metadata =
        get_current_view_name() === 'metadata' &&
        current_state_for_nav?.auditStatus === 'not_started' &&
        !!current_state_for_nav?.ruleFileContent;
    const is_start_like_view =
        target_view_name === 'start' ||
        target_view_name === 'audit' ||
        target_view_name === 'audit_audits';
    const allow_new_audit_exit = target_params && target_params.allow_new_audit_exit === '1';

    if (is_new_audit_metadata && is_start_like_view && !allow_new_audit_exit) {
        nav_debug('navigate_and_set_hash blockerad för ny granskning i metadata', {
            target_view_name,
            target_params
        });
        return;
    }

    const safe_params = { ...(target_params || {}) };
    if (allow_new_audit_exit) {
        delete safe_params.allow_new_audit_exit;
    }

    const target_hash_part = safe_params && Object.keys(safe_params).length > 0 ?
        `${target_view_name}?${new URLSearchParams(safe_params).toString()}` :
        target_view_name;
    const new_hash = `#${target_hash_part}`;
    const current_view_component_instance = get_current_view_component();
    if (window.location.hash === new_hash) {
        nav_debug('Hash oförändrad – endast render', { new_hash });
        updatePageTitle(target_view_name, target_params);
        if (current_view_component_instance && typeof current_view_component_instance.render === 'function') {
            current_view_component_instance.render();
        }
    } else {
        nav_debug('Sätter hash', { from: window.location.hash, to: new_hash });
        window.location.hash = new_hash;
        updatePageTitle(target_view_name, target_params);
    }
}

export async function handle_hash_change(options) {
    const {
        nav_debug,
        dispatch,
        StoreActionTypes,
        navigate_and_set_hash: navigate_and_set_hash_fn,
        updatePageTitle,
        render_view,
        load_focus_storage,
        get_scope_key_from_view_and_params: get_scope_key_fn
    } = options;

    if (get_auth_token()) {
        void (async () => {
            try {
                const user = await get_current_user_preferences_with_timeout();
                if (user?.name) {
                    window.__GV_CURRENT_USER_NAME__ = user.name;
                    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('gv_current_user_name', user.name);
                }
                set_current_user_admin(!!user?.is_admin);
                dispatch({ type: 'GV_USER_PREFERENCES_SYNCED' });
            } catch {
                /* ignorerar – anropet kan misslyckas utan giltig session */
            }
        })();
    }
    const hash = window.location.hash.substring(1);
    nav_debug('handle_hash_change anropad', { hash, full_url: window.location.href });
    const [view_name_from_hash, ...param_pairs] = hash.split('?');
    const is_skip_link_anchor = view_name_from_hash === SKIP_LINK_ANCHOR_ID;
    const effective_view_name = is_skip_link_anchor ? '' : view_name_from_hash;

    const params = {};
    if (param_pairs.length > 0 && !is_skip_link_anchor) {
        const query_string = param_pairs.join('?');
        const url_params = new URLSearchParams(query_string);
        for (const [key, value] of url_params) { params[key] = value; }
    }
    let target_view = 'start';
    let target_params = params;

    const load_audit_and_navigate = async (auditId) => {
        const t = window.Translation?.t || (k => k);
        try {
            const { load_audit_with_rule_file } = await import('../api/client.js');
            const full_state = await load_audit_with_rule_file(auditId);
            const validation = ValidationLogic?.validate_saved_audit_file?.(full_state, { t });
            if (full_state && validation?.isValid) {
                dispatch({ type: StoreActionTypes.LOAD_AUDIT_FROM_FILE, payload: full_state });
                const status = full_state.auditStatus || 'not_started';
                const samples = full_state.samples || [];
                let next_view = 'audit_overview';
                if (status === 'not_started' && samples.length === 0) {
                    next_view = 'sample_management';
                } else if (status === 'not_started') {
                    next_view = 'metadata';
                }
                navigate_and_set_hash_fn(next_view, {});
                return true;
            }
            if (validation && !validation.isValid && app_runtime_refs.notification_component?.show_global_message) {
                app_runtime_refs.notification_component.show_global_message(validation.message || t('error_invalid_saved_audit_file'), 'error');
            }
        } catch (err) {
            if (app_runtime_refs.notification_component?.show_global_message) {
                app_runtime_refs.notification_component.show_global_message(
                    t('server_load_audit_error', { message: err.message }) || err.message,
                    'error'
                );
            }
        }
        return false;
    };

    if (effective_view_name === 'upload') {
        if (params.auditId && (await load_audit_and_navigate(params.auditId))) return;
        navigate_and_set_hash_fn('start', {});
        return;
    }

    if (effective_view_name === 'audit_overview' && params.auditId) {
        if (await load_audit_and_navigate(params.auditId)) return;
        navigate_and_set_hash_fn('start', {});
        return;
    }

    if (effective_view_name) {
        target_view = effective_view_name;
    } else {
        target_view = 'start';
        target_params = {};
    }
    if (target_view === 'manage_users' && !is_current_user_admin()) {
        target_view = 'start';
        target_params = {};
        history.replaceState(null, '', '#start');
    }
    nav_debug('handle_hash_change -> render_view', { target_view, target_params, effective_view_name });
    if (is_skip_link_anchor || !effective_view_name) {
        const target_hash_part = target_params && Object.keys(target_params).length > 0 ?
            `${target_view}?${new URLSearchParams(target_params).toString()}` :
            target_view;
        history.replaceState(null, '', `#${target_hash_part}`);
    }
    try {
        const scope_key = get_scope_key_fn(target_view, target_params);
        if (scope_key && window.sessionStorage) {
            const focus_storage = load_focus_storage();
            const focus_info = focus_storage[scope_key];
            if (focus_info) {
                window.__gv_restore_focus_info = focus_info;
            }
        }
    } catch {
        /* ignorerar fokuslagringsfel */
    }
    updatePageTitle(target_view, target_params);
    render_view(target_view, target_params);
}

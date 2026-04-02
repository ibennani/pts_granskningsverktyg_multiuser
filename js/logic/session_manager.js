/**
 * Sessionstart, teman, byggstämpel och användarpreferenser från server.
 * @module js/logic/session_manager
 */

import { get_current_user_preferences_with_timeout } from '../api/client.js';
import { parse_view_and_params_from_hash } from './router.js';
import { format_build_info_object } from '../utils/build_time_format.js';
import { consoleManager } from '../utils/console_manager.js';
import { memoryManager } from '../utils/memory_manager.js';

export function set_initial_theme() {
    const saved_theme = localStorage.getItem('theme_preference');
    if (saved_theme && saved_theme !== 'system') {
        document.documentElement.setAttribute('data-theme', saved_theme);
    } else {
        const prefers_dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initial_theme = prefers_dark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', initial_theme);
    }
}

export function is_dev_build_environment() {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname;
    const p = window.location.port;
    return h === 'localhost' || h === '127.0.0.1' || p === '5173' || p === '4173';
}

/**
 * I dev cachar webbläsaren ofta den första modulladdningen av build-info.js.
 * Hämta om med unik URL så att window.BUILD_INFO matchar filen på disk (utan hel sidomladdning).
 */
export async function refresh_dev_build_info_from_server() {
    if (!is_dev_build_environment()) return;
    try {
        const url = new URL(`../build-info.js?t=${Date.now()}`, import.meta.url).href;
        await import(/* @vite-ignore */ url);
    } catch {
        /* ignorera om build-info saknas i vissa lägen */
    }
}

export function update_build_timestamp() {
    const buildTimestampElement = document.getElementById('build-timestamp');
    if (!buildTimestampElement) return;

    const t = window.Translation?.t || ((key, replacements) => {
        if (replacements) {
            let result = key;
            for (const [k, v] of Object.entries(replacements)) {
                result = result.replace(`{${k}}`, v);
            }
            return result;
        }
        return key;
    });

    const is_dev = is_dev_build_environment();
    const include_seconds = is_dev;

    let date_str;
    let time_str;
    if (window.BUILD_INFO?.timestamp) {
        const formatted = format_build_info_object(window.BUILD_INFO.timestamp, { include_seconds });
        date_str = formatted.date;
        time_str = formatted.time;
    } else {
        const formatted = format_build_info_object(new Date(), { include_seconds });
        date_str = formatted.date;
        time_str = formatted.time;
    }

    if (is_dev) {
        buildTimestampElement.textContent = t('build_timestamp_dev_fallback', { date: date_str, time: time_str });
    } else {
        buildTimestampElement.textContent = t('build_timestamp_built', { date: date_str, time: time_str });
    }
    buildTimestampElement.style.display = 'block';
}

export async function apply_user_preferences_from_server({ dispatch, StoreActionTypes }) {
    if (!window.__GV_CURRENT_USER_NAME__) return;
    try {
        const user = await get_current_user_preferences_with_timeout();
        if (user?.language_preference && typeof window.Translation?.set_language === 'function') {
            await window.Translation.set_language(user.language_preference);
        }
        if (user?.theme_preference === 'light' || user?.theme_preference === 'dark' || user?.theme_preference === 'alternative') {
            localStorage.setItem('theme_preference', user.theme_preference);
            document.documentElement.setAttribute('data-theme', user.theme_preference);
        } else if (user?.theme_preference === 'system' || user?.theme_preference === null || user?.theme_preference === '') {
            localStorage.removeItem('theme_preference');
            const prefers_dark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
            document.documentElement.setAttribute('data-theme', prefers_dark ? 'dark' : 'light');
        }
        const pref = user?.review_sort_preference || 'by_criteria';
        if (pref === 'by_criteria' || pref === 'by_sample') {
            const mode = pref === 'by_criteria' ? 'requirement_samples' : 'sample_requirements';
            dispatch({
                type: StoreActionTypes.SET_REQUIREMENT_AUDIT_SIDEBAR_SETTINGS,
                payload: { selectedMode: mode }
            });
        }
    } catch {
        /* ignorerar – användaren kanske inte finns i DB */
    }
}

export async function start_normal_session(deps) {
    const {
        ensure_app_layout,
        setup_tooltip_overlay,
        LayoutManager,
        init_global_components,
        init_connectivity_service,
        init_version_check_service,
        init_rulefile_view_poll_service,
        MarkdownToolbar,
        nav_debug,
        on_language_changed_event,
        handle_hash_change,
        capture_focus_info_from_element,
        get_main_view_root,
        get_app_container,
        get_current_view_name_rendered,
        get_current_view_params_rendered_json,
        update_restore_position,
        updateBackupRestorePosition,
        get_scope_key_from_view_and_params,
        load_focus_storage,
        save_focus_storage,
        top_action_bar_instance,
        bottom_action_bar_instance,
        error_boundary_instance,
        NotificationComponent,
        DraftManager,
        capture_focus_state,
        restore_focus_state,
        updatePageTitle,
        updatePageTitleFromCurrentView,
        update_side_menu,
        get_current_view_component,
        is_focus_in_editable_field,
        subscribe,
        getState,
        dispatch,
        StoreActionTypes,
        update_app_chrome_texts
    } = deps;

    ensure_app_layout();
    setup_tooltip_overlay();
    if (LayoutManager && typeof LayoutManager.init === 'function') {
        LayoutManager.init();
    }
    await init_global_components();
    // Blockerar inte första vyrendering om /users/me hänger (fetch saknar timeout i klienten).
    void apply_user_preferences_from_server({ dispatch, StoreActionTypes });
    init_connectivity_service({ getState, dispatch });
    if (window.ScoreManager?.init) { window.ScoreManager.init(subscribe, getState, dispatch, StoreActionTypes); }
    if (MarkdownToolbar?.init) { MarkdownToolbar.init(); }
    init_version_check_service();
    const rulefile_view_poll_instance = init_rulefile_view_poll_service({ getState, dispatch, StoreActionTypes });
    const language_changed_handler = on_language_changed_event;
    const hash_change_handler = handle_hash_change;
    const hash_change_wrapper = (...args) => {
        nav_debug('hashchange-event triggat', { hash: window.location.hash });
        hash_change_handler(...args);
    };
    memoryManager.addEventListener(window, 'hashchange', hash_change_wrapper);
    memoryManager.addEventListener(document, 'languageChanged', language_changed_handler);

    let focus_capture_timer = null;
    const focus_in_handler = () => {
        if (focus_capture_timer) clearTimeout(focus_capture_timer);
        focus_capture_timer = setTimeout(() => {
            focus_capture_timer = null;
            const main_view_root = get_main_view_root();
            const info = capture_focus_info_from_element(document.activeElement, main_view_root);
            if (info) {
                let parsed_params = {};
                try {
                    parsed_params = JSON.parse(get_current_view_params_rendered_json() || '{}');
                } catch {
                    parsed_params = {};
                }
                update_restore_position(get_current_view_name_rendered(), parsed_params, info);
                updateBackupRestorePosition(window.__gv_get_restore_position?.());
                try {
                    const scope_key = get_scope_key_from_view_and_params(get_current_view_name_rendered(), parsed_params);
                    if (scope_key && window.sessionStorage) {
                        const focus_storage = load_focus_storage();
                        focus_storage[scope_key] = info;
                        save_focus_storage(focus_storage);
                    }
                } catch {
                    /* ignore */
                }
            }
        }, 150);
    };
    const focus_root = get_main_view_root() || get_app_container();
    if (focus_root) {
        focus_root.addEventListener('focusin', focus_in_handler);
    }

    window.cleanupGlobalEventListeners = () => {
        if (rulefile_view_poll_instance?.disconnect) rulefile_view_poll_instance.disconnect();
        memoryManager.removeEventListener(document, 'languageChanged', language_changed_handler);
        memoryManager.removeEventListener(window, 'hashchange', hash_change_wrapper);
        const fr = get_main_view_root() || get_app_container();
        if (fr) fr.removeEventListener('focusin', focus_in_handler);

        if (error_boundary_instance && typeof error_boundary_instance.destroy === 'function') {
            try {
                error_boundary_instance.destroy();
            } catch (error) {
                consoleManager.error('[Main.js] Error cleaning up error boundary:', error);
            }
        }

        consoleManager.info('[Main.js] Global event listeners cleaned up');
    };

    subscribe((new_state, listener_meta) => {
        if (listener_meta?.skip_render) {
            if (window.__GV_DEBUG_MODAL_SCROLL) {
                consoleManager.log('[GV-ModalDebug] subscribe: skip_render – ingen render');
            }
            return;
        }
        if (window.__GV_DEBUG_MODAL_SCROLL) {
            consoleManager.log('[GV-ModalDebug] subscribe: RENDERAR top_action_bar, bottom_action_bar, current_view');
        }
        try {
            top_action_bar_instance.render();
        } catch (error) {
            consoleManager.error('[Main.js] Error in subscription top action bar render:', error);
            if (error_boundary_instance && error_boundary_instance.show_error) {
                error_boundary_instance.show_error({
                    message: `Top action bar subscription render failed: ${error.message}`,
                    stack: error.stack,
                    component: 'TopActionBar'
                });
            }
        }

        try {
            bottom_action_bar_instance.render();
        } catch (error) {
            consoleManager.error('[Main.js] Error in subscription bottom action bar render:', error);
            if (error_boundary_instance && error_boundary_instance.show_error) {
                error_boundary_instance.show_error({
                    message: `Bottom action bar subscription render failed: ${error.message}`,
                    stack: error.stack,
                    component: 'BottomActionBar'
                });
            }
        }
        {
            const { viewName: hash_view_name, params: hash_params } = parse_view_and_params_from_hash();
            const rendered_view_name = get_current_view_name_rendered();
            if (rendered_view_name && hash_view_name && rendered_view_name !== hash_view_name) {
                updatePageTitle(hash_view_name, hash_params);
                update_side_menu(hash_view_name, hash_params);
            } else {
                updatePageTitleFromCurrentView();
                try {
                    const parsed_params = JSON.parse(get_current_view_params_rendered_json() || '{}');
                    update_side_menu(get_current_view_name_rendered(), parsed_params);
                } catch (error) {
                    consoleManager.warn('[Main.js] Failed to parse current view params for side menu update:', error);
                    update_side_menu(get_current_view_name_rendered(), {});
                }
            }
        }
        const hash = window.location.hash.substring(1);
        const [view_name_from_hash,] = hash.split('?');
        const current_view_component_instance = get_current_view_component();
        if (get_current_view_name_rendered() === view_name_from_hash &&
            current_view_component_instance && typeof current_view_component_instance.render === 'function') {
            if (get_current_view_name_rendered() !== 'confirm_sample_edit') {
                if ((get_current_view_name_rendered() === 'audit' || get_current_view_name_rendered() === 'audit_audits' || get_current_view_name_rendered() === 'audit_rules') && current_view_component_instance._api_load_started && !current_view_component_instance._api_checked) {
                    return;
                }
                if (get_current_view_name_rendered() === 'rulefile_edit_requirement' || get_current_view_name_rendered() === 'rulefile_add_requirement') {
                    const skip_count = Number(window.skipRulefileRequirementRender) || 0;
                    if (skip_count > 0) {
                        window.skipRulefileRequirementRender = skip_count - 1;
                        return;
                    }
                }
                const view_root = get_main_view_root() || get_app_container();
                if (is_focus_in_editable_field(view_root)) {
                    return;
                }
                const scroll_before = {
                    windowY: window.scrollY,
                    appContainer: document.getElementById('app-container')?.scrollTop ?? 0,
                    mainViewRoot: document.getElementById('app-main-view-root')?.scrollTop ?? 0
                };
                const focus_state = capture_focus_state(view_root);
                const window_scroll = focus_state ? { x: window.scrollX, y: window.scrollY } : null;
                try {
                    const render_promise = current_view_component_instance.render();
                    if (DraftManager?.restoreIntoDom) {
                        DraftManager.restoreIntoDom(get_main_view_root() || get_app_container());
                    }
                    const restore_scroll = () => {
                        requestAnimationFrame(() => {
                            if (focus_state && view_root) {
                                restore_focus_state({
                                    focus_root: view_root,
                                    focus_state,
                                    window_scroll
                                });
                            }
                            window.scrollTo(0, scroll_before.windowY);
                            document.documentElement.scrollTop = scroll_before.windowY;
                            document.body.scrollTop = scroll_before.windowY;
                            const ac = document.getElementById('app-container');
                            const mvr = document.getElementById('app-main-view-root');
                            if (ac) ac.scrollTop = scroll_before.appContainer;
                            if (mvr) mvr.scrollTop = scroll_before.mainViewRoot;
                        });
                    };
                    if (render_promise && typeof render_promise.then === 'function') {
                        render_promise.then(restore_scroll).catch(() => restore_scroll());
                    } else {
                        restore_scroll();
                    }
                } catch (error) {
                    consoleManager.error('[Main.js] Error in subscription current view render:', error);
                    if (error_boundary_instance && error_boundary_instance.show_error) {
                        error_boundary_instance.show_error({
                            message: `Current view render failed: ${error.message}`,
                            stack: error.stack,
                            component: get_current_view_name_rendered() || 'Unknown'
                        });
                    }
                }
            }
        }
    });
    if (NotificationComponent?.clear_global_message) { NotificationComponent.clear_global_message(); }

    {
        const hash = (window.location.hash || '').replace(/^#/, '');
        const view_from_hash = hash.split('?')[0];
        if (view_from_hash === 'login') {
            window.location.hash = '#start';
        } else {
            handle_hash_change();
        }
    }
    update_app_chrome_texts();
}

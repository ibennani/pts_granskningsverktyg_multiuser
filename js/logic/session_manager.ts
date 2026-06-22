/**
 * Sessionstart, teman, byggstämpel och användarpreferenser från server.
 * @module js/logic/session_manager
 */
/// <reference types="vite/client" />

import { get_current_user_preferences_with_timeout } from '../api/client.js';
import { parse_build_info_from_text } from './version_check_service.js';
import { parse_view_and_params_from_hash } from './router.js';
import { format_build_info_object } from '../utils/build_time_format.js';
import {
    read_vite_dev_client_timestamp_date,
    resolve_dev_build_display_moment,
} from '../utils/vite_dev_client_timestamp.js';
import { consoleManager } from '../utils/console_manager.js';
import { memoryManager } from '../utils/memory_manager.js';
import { get_current_user_name } from '../utils/helpers.js';
import { get_current_user_name_window, get_restore_position_via_hook } from '../app/browser_globals.js';
import { is_debug_modal_scroll } from '../app/runtime_flags.js';
import { init_same_user_tab_field_sync_listener } from './same_user_tab_field_sync.js';

/** Bygg-info som läses in dynamiskt i webbläsaren. */
interface BuildInfoPayload {
    timestamp?: string | number | Date;
}

declare global {
    interface Window {
        BUILD_INFO?: BuildInfoPayload;
        Translation?: {
            t: (key: string, replacements?: Record<string, string>) => string;
            set_language?: (lang: string) => Promise<void>;
        };
        __GV_CURRENT_USER_NAME__?: string;
        ScoreManager?: { init?: (...args: unknown[]) => void };
        skipRulefileRequirementRender?: number;
        __GV_DEBUG_MODAL_SCROLL?: boolean;
        __gv_get_restore_position?: () => unknown;
        cleanupGlobalEventListeners?: () => void;
    }
}

export {};

/** Fel-/retry-gränssnitt för felrad i sessionstart. */
type ErrorBoundaryLike = {
    show_error?: (payload: { message?: string; stack?: string; component?: string }) => void;
    destroy?: () => void;
};

/** Aktuell vykomponent i subscription-render. */
type ViewComponentLike = {
    render: () => void | Promise<void>;
    _api_load_started?: boolean;
    _api_checked?: boolean;
};

/** Alla beroenden till start_normal_session från main. */
export interface StartNormalSessionDeps {
    ensure_app_layout: () => void;
    setup_tooltip_overlay: () => void;
    LayoutManager?: { init?: () => void };
    init_global_components: () => Promise<void>;
    init_connectivity_service: (opts: { getState: () => unknown; dispatch: (a: unknown) => void }) => void;
    init_version_check_service: () => void;
    init_rulefile_view_poll_service: (opts: unknown) => { disconnect?: () => void } | void;
    init_audit_view_poll_service: (opts: unknown) => unknown;
    MarkdownToolbar?: { init?: () => void };
    nav_debug: (msg: string, data?: unknown) => void;
    on_language_changed_event: (e: Event) => void;
    handle_hash_change: (...args: unknown[]) => void;
    capture_focus_info_from_element: (el: Element | null, root: Element | null) => unknown;
    get_main_view_root: () => Element | null;
    get_app_container: () => Element | null;
    get_current_view_name_rendered: () => string;
    get_current_view_params_rendered_json: () => string;
    update_restore_position: (view: string, params: unknown, info: unknown) => void;
    updateBackupRestorePosition: (pos: unknown) => void;
    get_scope_key_from_view_and_params: (view: string, params: unknown) => string | null | undefined;
    load_focus_storage: () => Record<string, unknown>;
    save_focus_storage: (s: Record<string, unknown>) => void;
    top_action_bar_instance: { render: () => void };
    bottom_action_bar_instance: { render: () => void };
    error_boundary_instance: ErrorBoundaryLike;
    NotificationComponent: { clear_global_message?: () => void };
    DraftManager?: { restoreIntoDom?: (el: Element | null | undefined) => void };
    capture_focus_state: (root: Element | null) => unknown;
    restore_focus_state: (args: unknown) => void;
    updatePageTitle: (view: string | undefined, params: unknown, ctx: unknown) => void;
    updatePageTitleFromCurrentView: () => void;
    update_side_menu: (view: string, params: unknown) => void;
    get_current_view_component: () => ViewComponentLike | null | undefined;
    is_focus_in_editable_field: (root: Element | null | undefined) => boolean;
    subscribe: (
        cb: (
            new_state: unknown,
            listener_meta?: { skip_render?: boolean; force_same_user_tab_render?: boolean }
        ) => void
    ) => void;
    getState: () => unknown;
    dispatch: (a: unknown) => void;
    StoreActionTypes: { SET_REQUIREMENT_AUDIT_SIDEBAR_SETTINGS: string; [k: string]: string };
    update_app_chrome_texts: () => void;
}

type ApplyUserPreferencesDeps = {
    dispatch: (a: unknown) => void;
    StoreActionTypes: { SET_REQUIREMENT_AUDIT_SIDEBAR_SETTINGS: string };
};

export function set_initial_theme(): void {
    const saved_theme = localStorage.getItem('theme_preference');
    if (saved_theme && saved_theme !== 'system') {
        document.documentElement.setAttribute('data-theme', saved_theme);
    } else {
        const prefers_dark =
            window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initial_theme = prefers_dark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', initial_theme);
    }
}

export function is_dev_build_environment(): boolean {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname;
    const p = window.location.port;
    return h === 'localhost' || h === '127.0.0.1' || p === '5173' || p === '4173';
}

/**
 * I dev cachar webbläsaren ofta den första modulladdningen av build-info.js.
 * Hämta om med unik URL så att window.BUILD_INFO matchar filen på disk (utan hel sidomladdning).
 * Måste använda samma bas som index.html (BASE_URL + build-info.js), inte sökväg relativt denna fil —
 * annars pekar ../build-info.js fel (js/build-info.js) och importen misslyckas tyst.
 */
export async function refresh_dev_build_info_from_server(): Promise<void> {
    if (!is_dev_build_environment()) return;
    try {
        const base = import.meta.env.BASE_URL || '/';
        const path = `${base}build-info.js?t=${Date.now()}`;
        await import(/* @vite-ignore */ path);
    } catch {
        /* ignorera om build-info saknas i vissa lägen */
    }
}

/**
 * I produktion: hämta build-info med no-store så att byggstämpeln inte fastnar på gammal modul
 * (t.ex. HTTP-cache / äldre SW-beteende) trots att index bytts ut.
 */
export async function refresh_production_build_info_from_server(): Promise<void> {
    if (is_dev_build_environment()) return;
    try {
        const script_url = new URL('build-info.js', window.location.href);
        script_url.searchParams.set('_cb', String(Date.now()));
        const res = await fetch(script_url.href, {
            cache: 'no-store',
            credentials: 'same-origin',
        });
        if (!res.ok) return;
        const text = await res.text();
        const parsed = parse_build_info_from_text(text);
        if (parsed && parsed.timestamp) {
            window.BUILD_INFO = parsed;
        }
    } catch {
        /* ignoreras */
    }
}

export function update_build_timestamp(): void {
    const buildTimestampElement = document.getElementById('build-timestamp');
    if (!buildTimestampElement) return;

    const t =
        window.Translation?.t ||
        ((key: string, replacements?: Record<string, string>) => {
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

    let date_str: string;
    let time_str: string;
    if (is_dev) {
        const vite_m = read_vite_dev_client_timestamp_date();
        const ts = window.BUILD_INFO?.timestamp;
        const build_iso =
            ts == null
                ? undefined
                : typeof ts === 'string'
                  ? ts
                  : ts instanceof Date
                    ? ts.toISOString()
                    : String(ts);
        const moment = resolve_dev_build_display_moment(build_iso, vite_m);
        const formatted = format_build_info_object(moment, { include_seconds });
        date_str = formatted.date;
        time_str = formatted.time;
    } else if (window.BUILD_INFO?.timestamp) {
        const formatted = format_build_info_object(window.BUILD_INFO.timestamp, { include_seconds });
        date_str = formatted.date;
        time_str = formatted.time;
    } else {
        const formatted = format_build_info_object(new Date(), { include_seconds });
        date_str = formatted.date;
        time_str = formatted.time;
    }

    if (is_dev) {
        buildTimestampElement.textContent = t('build_timestamp_dev_fallback', {
            date: date_str,
            time: time_str,
        });
    } else {
        buildTimestampElement.textContent = t('build_timestamp_built', { date: date_str, time: time_str });
    }
    buildTimestampElement.style.display = 'block';
}

export async function apply_user_preferences_from_server({
    dispatch,
    StoreActionTypes
}: ApplyUserPreferencesDeps): Promise<void> {
    if (!get_current_user_name_window()) return;
    try {
        const user = await get_current_user_preferences_with_timeout();
        if (user?.language_preference && typeof window.Translation?.set_language === 'function') {
            await window.Translation.set_language(user.language_preference);
        }
        if (
            user?.theme_preference === 'light' ||
            user?.theme_preference === 'dark' ||
            user?.theme_preference === 'alternative'
        ) {
            localStorage.setItem('theme_preference', user.theme_preference);
            document.documentElement.setAttribute('data-theme', user.theme_preference);
        } else if (
            user?.theme_preference === 'system' ||
            user?.theme_preference === null ||
            user?.theme_preference === ''
        ) {
            localStorage.removeItem('theme_preference');
            const prefers_dark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
            document.documentElement.setAttribute('data-theme', prefers_dark ? 'dark' : 'light');
        }
        const pref = user?.review_sort_preference || 'by_criteria';
        if (pref === 'by_criteria' || pref === 'by_sample') {
            const mode = pref === 'by_criteria' ? 'requirement_samples' : 'sample_requirements';
            dispatch({
                type: StoreActionTypes.SET_REQUIREMENT_AUDIT_SIDEBAR_SETTINGS,
                payload: { selectedMode: mode },
            });
        }
    } catch {
        /* ignorerar – användaren kanske inte finns i DB */
    }
}

export async function start_normal_session(deps: StartNormalSessionDeps): Promise<void> {
    const {
        ensure_app_layout,
        setup_tooltip_overlay,
        LayoutManager,
        init_global_components,
        init_connectivity_service,
        init_version_check_service,
        init_rulefile_view_poll_service,
        init_audit_view_poll_service,
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
        updatePageTitle: _updatePageTitle,
        updatePageTitleFromCurrentView,
        update_side_menu,
        get_current_view_component,
        is_focus_in_editable_field,
        subscribe,
        getState,
        dispatch,
        StoreActionTypes,
        update_app_chrome_texts,
    } = deps;
    void _updatePageTitle;

    ensure_app_layout();
    setup_tooltip_overlay();
    if (LayoutManager && typeof LayoutManager.init === 'function') {
        LayoutManager.init();
    }
    await init_global_components();
    // Blockerar inte första vyrendering om /users/me hänger (fetch saknar timeout i klienten).
    void apply_user_preferences_from_server({ dispatch, StoreActionTypes });
    init_connectivity_service({ getState, dispatch });
    if (window.ScoreManager?.init) {
        window.ScoreManager.init(subscribe, getState, dispatch, StoreActionTypes);
    }
    if (MarkdownToolbar?.init) {
        MarkdownToolbar.init();
    }
    init_version_check_service();
    const rulefile_view_poll_instance = init_rulefile_view_poll_service({ getState, dispatch, StoreActionTypes });
    init_audit_view_poll_service({ getState, dispatch, StoreActionTypes });
    const same_user_tab_field_sync_disconnect = init_same_user_tab_field_sync_listener({
        getState,
        dispatch,
        StoreActionTypes,
        get_current_user_name,
    });
    const language_changed_handler = on_language_changed_event;
    const hash_change_handler = handle_hash_change;
    const hash_change_wrapper = (...args: unknown[]) => {
        nav_debug('hashchange-event triggat', { hash: window.location.hash });
        hash_change_handler(...args);
    };
    memoryManager.addEventListener(window, 'hashchange', hash_change_wrapper);
    memoryManager.addEventListener(document, 'languageChanged', language_changed_handler);

    let focus_capture_timer: ReturnType<typeof setTimeout> | null = null;
    const focus_in_handler = () => {
        if (focus_capture_timer) clearTimeout(focus_capture_timer);
        focus_capture_timer = setTimeout(() => {
            focus_capture_timer = null;
            const main_view_root = get_main_view_root();
            const info = capture_focus_info_from_element(document.activeElement, main_view_root);
            if (info) {
                let parsed_params: unknown = {};
                try {
                    parsed_params = JSON.parse(get_current_view_params_rendered_json() || '{}');
                } catch {
                    parsed_params = {};
                }
                update_restore_position(get_current_view_name_rendered(), parsed_params, info);
                updateBackupRestorePosition(get_restore_position_via_hook());
                try {
                    const scope_key = get_scope_key_from_view_and_params(
                        get_current_view_name_rendered(),
                        parsed_params
                    );
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
        if (typeof same_user_tab_field_sync_disconnect === 'function') {
            try {
                same_user_tab_field_sync_disconnect();
            } catch {
                /* ignoreras */
            }
        }
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

    subscribe((_new_state, listener_meta) => {
        if (listener_meta?.skip_render) {
            if (is_debug_modal_scroll()) {
                consoleManager.log('[GV-ModalDebug] subscribe: skip_render – ingen render');
            }
            return;
        }
        if (is_debug_modal_scroll()) {
            consoleManager.log(
                '[GV-ModalDebug] subscribe: RENDERAR top_action_bar, bottom_action_bar, current_view'
            );
        }
        try {
            top_action_bar_instance.render();
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            consoleManager.error('[Main.js] Error in subscription top action bar render:', err);
            if (error_boundary_instance && error_boundary_instance.show_error) {
                error_boundary_instance.show_error({
                    message: `Top action bar subscription render failed: ${err.message}`,
                    stack: err.stack,
                    component: 'TopActionBar',
                });
            }
        }

        try {
            bottom_action_bar_instance.render();
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            consoleManager.error('[Main.js] Error in subscription bottom action bar render:', err);
            if (error_boundary_instance && error_boundary_instance.show_error) {
                error_boundary_instance.show_error({
                    message: `Bottom action bar subscription render failed: ${err.message}`,
                    stack: err.stack,
                    component: 'BottomActionBar',
                });
            }
        }
        {
            // Sidtitel och meny följer faktiskt renderad vy: hash kan skilja sig (t.ex. publicerad
            // regelfil mappar rulefile_edit_requirement → rulefile_view_requirement i view_render).
            updatePageTitleFromCurrentView();
            try {
                const parsed_params = JSON.parse(get_current_view_params_rendered_json() || '{}');
                update_side_menu(get_current_view_name_rendered(), parsed_params);
            } catch (error) {
                consoleManager.warn(
                    '[Main.js] Failed to parse current view params for side menu update:',
                    error
                );
                update_side_menu(get_current_view_name_rendered(), {});
            }
        }
        const { viewName: canonical_view_from_hash } = parse_view_and_params_from_hash();
        const current_view_component_instance = get_current_view_component();
        if (
            get_current_view_name_rendered() === canonical_view_from_hash &&
            current_view_component_instance &&
            typeof current_view_component_instance.render === 'function'
        ) {
            if (listener_meta?.force_same_user_tab_render) {
                try {
                    current_view_component_instance.render();
                } catch (error) {
                    consoleManager.error(
                        '[Main.js] Error in subscription same-user tab sync render:',
                        error
                    );
                }
                return;
            }
            if (get_current_view_name_rendered() !== 'confirm_sample_edit') {
                if (
                    (get_current_view_name_rendered() === 'audit' ||
                        get_current_view_name_rendered() === 'audit_audits' ||
                        get_current_view_name_rendered() === 'audit_rules') &&
                    current_view_component_instance._api_load_started &&
                    !current_view_component_instance._api_checked
                ) {
                    return;
                }
                if (
                    get_current_view_name_rendered() === 'rulefile_edit_requirement' ||
                    get_current_view_name_rendered() === 'rulefile_add_requirement'
                ) {
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
                    mainViewRoot: document.getElementById('app-main-view-root')?.scrollTop ?? 0,
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
                                    window_scroll,
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
                        void render_promise.then(restore_scroll).catch(() => restore_scroll());
                    } else {
                        restore_scroll();
                    }
                } catch (error) {
                    const err = error instanceof Error ? error : new Error(String(error));
                    consoleManager.error('[Main.js] Error in subscription current view render:', err);
                    if (error_boundary_instance && error_boundary_instance.show_error) {
                        error_boundary_instance.show_error({
                            message: `Current view render failed: ${err.message}`,
                            stack: err.stack,
                            component: get_current_view_name_rendered() || 'Unknown',
                        });
                    }
                }
            }
        }
    });
    if (NotificationComponent?.clear_global_message) {
        NotificationComponent.clear_global_message();
    }

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

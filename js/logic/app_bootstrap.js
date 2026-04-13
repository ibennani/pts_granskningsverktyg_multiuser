/**
 * App-start: tema, översättning, auth, synk mellan flikar, boot-merge, inloggning.
 */
import { apply_session_boot_merge_from_backup } from './session_boot_merge.js';
import { consoleManager } from '../utils/console_manager.js';
import { memoryManager } from '../utils/memory_manager.js';
import { install_vite_dev_client_timestamp_listeners } from '../utils/vite_dev_client_timestamp.js';

/**
 * Kör initiering efter att övriga beroenden satts upp i main.
 * @param {object} deps
 */
export async function init_app(deps) {
    const {
        set_initial_theme,
        is_dev_build_environment,
        refresh_dev_build_info_from_server,
        update_build_timestamp,
        APP_STATE_KEY,
        initState,
        init_draft_manager,
        setup_skip_link_click_handler,
        update_landmarks_and_skip_link,
        get_auth_token,
        get_current_user_preferences,
        set_current_user_admin,
        StoreActionTypes,
        loadStateFromLocalStorageBackup,
        ensure_app_layout,
        layout_refs,
        init_global_components,
        notificationComponent,
        render_view,
        start_normal_session,
        memoryManagerRef
    } = deps;

    const side_menu_root = () => layout_refs.side_menu_root;

    const AUTH_REQUIRED_EVENT = 'gv-auth-required';
    const AUTH_REQUIRED_MESSAGE_KEY = 'gv_auth_required_message';

    set_initial_theme();
    if (is_dev_build_environment()) {
        install_vite_dev_client_timestamp_listeners(update_build_timestamp);
    }
    const mm = memoryManagerRef || memoryManager;
    mm.setTimeout(() => {
        (async () => {
            await refresh_dev_build_info_from_server();
            update_build_timestamp();
        })();
    }, 100);
    if (is_dev_build_environment()) {
        const DEV_BUILDINFO_REFRESH_INTERVAL_MS = 1500;
        let buildinfo_refresh_in_flight = false;

        mm.setInterval(async () => {
            if (document.visibilityState !== 'visible') return;
            if (buildinfo_refresh_in_flight) return;
            buildinfo_refresh_in_flight = true;
            try {
                await refresh_dev_build_info_from_server();
                update_build_timestamp();
            } finally {
                buildinfo_refresh_in_flight = false;
            }
        }, DEV_BUILDINFO_REFRESH_INTERVAL_MS);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            (async () => {
                await refresh_dev_build_info_from_server();
                update_build_timestamp();
            })();
        });
    }
    await window.Translation.ensure_initial_load();
    setup_skip_link_click_handler();
    update_landmarks_and_skip_link();
    document.addEventListener('languageChanged', update_landmarks_and_skip_link);

    const had_session_storage = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(APP_STATE_KEY) !== null;
    initState();
    init_draft_manager();

    const on_auth_required = async () => {
        if (window.__gv_auth_required_in_progress) return;
        window.__gv_auth_required_in_progress = true;
        try {
            if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(AUTH_REQUIRED_MESSAGE_KEY, '1');
        } catch (_) {
            // ignoreras medvetet
        }
        try {
            if (typeof window.cleanupGlobalEventListeners === 'function') {
                window.cleanupGlobalEventListeners();
            }
        } catch (_) {
            // ignoreras medvetet
        }

        ensure_app_layout();
        await init_global_components();
        if (side_menu_root()) {
            side_menu_root().innerHTML = '';
            side_menu_root().classList.add('hidden');
        }
        try {
            const t = window.Translation?.t ?? ((k) => k);
            notificationComponent?.show_global_message?.(t('auth_session_expired'), 'warning');
        } catch (_) {
            // ignoreras medvetet
        }

        await render_view('login', {
            on_login: () => {
                if (side_menu_root()) side_menu_root().classList.remove('hidden');
                start_normal_session().catch((err) =>
                    consoleManager.error('Error starting session after auth-required:', err)
                );
            }
        });
    };
    mm.addEventListener(window, AUTH_REQUIRED_EVENT, on_auth_required);

    let visibility_was_hidden = document.hidden;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            visibility_was_hidden = true;
            return;
        }
        if (!visibility_was_hidden) return;
        visibility_was_hidden = false;
        const state = deps.getState();
        if (!state?.auditId || state.auditStatus === 'rulefile_editing') return;
        if (!get_auth_token()) return;
        (async () => {
            try {
                const { load_audit_with_rule_file } = await import('../api/client.js');
                const full_state = await load_audit_with_rule_file(state.auditId);
                if (full_state?.samples) {
                    deps.dispatch({
                        type: StoreActionTypes.REPLACE_STATE_FROM_REMOTE,
                        payload: { ...full_state, saveFileVersion: full_state.saveFileVersion || '2.1.0' }
                    });
                }
            } catch (e) {
                if (e?.status === 401) return;
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[Main.js] Synk vid flikbyte:', e);
            }
        })();
    });

    if (typeof BroadcastChannel !== 'undefined') {
        const audit_updates_channel = new BroadcastChannel('granskningsverktyget-audit-updates');
        audit_updates_channel.onmessage = (event) => {
            const msg = event?.data;
            if (msg?.type !== 'audit-updated' || !msg.auditId) return;
            const state = deps.getState();
            if (!state?.auditId || state.auditId !== msg.auditId || state.auditStatus === 'rulefile_editing') return;
            if (!get_auth_token()) return;
            (async () => {
                try {
                    const { load_audit_with_rule_file } = await import('../api/client.js');
                    const full_state = await load_audit_with_rule_file(msg.auditId);
                    if (full_state?.samples) {
                        deps.dispatch({
                            type: StoreActionTypes.REPLACE_STATE_FROM_REMOTE,
                            payload: { ...full_state, saveFileVersion: full_state.saveFileVersion || '2.1.0' }
                        });
                    }
                } catch (e) {
                    if (e?.status === 401) return;
                    if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[Main.js] Synk från annan flik:', e);
                }
            })();
        };
    }

    deps.dispatch({ type: StoreActionTypes.CLEAR_STAGED_SAMPLE_CHANGES });

    let boot_local_backup = null;
    if (!had_session_storage) {
        boot_local_backup = loadStateFromLocalStorageBackup();
        if (boot_local_backup) {
            consoleManager.log('[Main.js] Cold start: localStorage-backup hittad; jämförs med servern vid start.');
        }
    }

    const boot_merge_common_opts = () => ({
        dispatch: deps.dispatch,
        getState: deps.getState,
        StoreActionTypes: deps.StoreActionTypes,
        ValidationLogic: deps.ValidationLogic,
        router: deps.navigate_and_set_hash,
        NotificationComponent: deps.notificationComponent,
        t: typeof window.Translation?.t === 'function' ? window.Translation.t.bind(window.Translation) : ((k) => k),
        navigate_and_set_hash: deps.navigate_and_set_hash,
        handle_hash_change: deps.handle_hash_change
    });

    const is_logged_in = () => {
        if (typeof window === 'undefined') return true;
        const has_token = !!get_auth_token();
        if (!has_token) {
            try {
                if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('gv_current_user_name');
            } catch (_) {
                // ignoreras medvetet
            }
            try {
                delete window.__GV_CURRENT_USER_NAME__;
            } catch (_) {
                // ignoreras medvetet
            }
        }
        return has_token;
    };

    if (!is_logged_in()) {
        ensure_app_layout();
        await init_global_components();
        if (side_menu_root()) {
            side_menu_root().innerHTML = '';
            side_menu_root().classList.add('hidden');
        }
        try {
            const should_show = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(AUTH_REQUIRED_MESSAGE_KEY) === '1';
            if (should_show) {
                sessionStorage.removeItem(AUTH_REQUIRED_MESSAGE_KEY);
                const t = window.Translation?.t ?? ((k) => k);
                notificationComponent?.show_global_message?.(t('auth_session_expired'), 'warning');
            }
        } catch (_) {
            // ignoreras medvetet
        }
        await render_view('login', {
            on_login: async () => {
                if (side_menu_root()) side_menu_root().classList.remove('hidden');
                try {
                    if (boot_local_backup) {
                        await apply_session_boot_merge_from_backup({
                            backup_entry: boot_local_backup,
                            ...boot_merge_common_opts()
                        });
                        boot_local_backup = null;
                    }
                } catch (merge_err) {
                    consoleManager.error('[Main.js] Boot-merge efter inloggning misslyckades:', merge_err);
                }
                start_normal_session().catch((err) =>
                    consoleManager.error('Error starting session:', err)
                );
            }
        });
        return;
    }

    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gv_current_user_name')) {
        window.__GV_CURRENT_USER_NAME__ = sessionStorage.getItem('gv_current_user_name');
    }
    const has_token = get_auth_token();
    if (has_token) {
        get_current_user_preferences().then((user) => {
            if (user?.name) {
                window.__GV_CURRENT_USER_NAME__ = user.name;
                if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('gv_current_user_name', user.name);
            }
            set_current_user_admin(!!user?.is_admin);
        }).catch(() => {});
    }

    document.addEventListener('visibilitychange', function sync_user_when_visible() {
        if (document.visibilityState !== 'visible' || !get_auth_token()) return;
        get_current_user_preferences().then((user) => {
            if (user?.name) {
                window.__GV_CURRENT_USER_NAME__ = user.name;
                if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('gv_current_user_name', user.name);
            }
            set_current_user_admin(!!user?.is_admin);
            deps.dispatch({ type: 'GV_USER_PREFERENCES_SYNCED' });
        }).catch(() => {});
    });

    try {
        if (boot_local_backup) {
            await apply_session_boot_merge_from_backup({
                backup_entry: boot_local_backup,
                ...boot_merge_common_opts()
            });
        }
    } catch (merge_err) {
        consoleManager.error('[Main.js] Boot-merge vid start misslyckades:', merge_err);
    }

    consoleManager.log('[Main.js] Startar session.');
    await start_normal_session();
}

/**
 * Kör init_app när DOM är redo.
 * @param {function} init_fn - async () => init_app(deps)
 */
export function run_when_dom_ready(init_fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init_fn().catch((err) => consoleManager.error('Error during app initialization (from DOMContentLoaded):', err));
        });
    } else {
        init_fn().catch((err) => consoleManager.error('Error during app initialization (direct call):', err));
    }
}

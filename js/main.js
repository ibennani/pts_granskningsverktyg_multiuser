// js/main.js

import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import * as Helpers from './utils/helpers.js';
import * as TranslationLogic from './translation_logic.js';
import { NotificationComponent } from './components/NotificationComponent.js';
import * as AuditLogic from './audit_logic.js';
import './export_logic.js';
import * as SaveAuditLogic from './logic/save_audit_logic.ts';
import * as ValidationLogic from './validation_logic.js';
import * as RulefileUpdaterLogic from './logic/rulefile_updater_logic.js';
import * as ScoreCalculator from './logic/ScoreCalculator.js';
import { AutosaveService, capture_focus_state, restore_focus_state } from './logic/autosave_service.js';
import { init_version_check_service } from './logic/version_check_service.js';
import { init_rulefile_view_poll_service } from './logic/rulefile_view_poll_service.js';
import { init_audit_view_poll_service } from './logic/audit_view_poll_service.js';
import { init_connectivity_service } from './logic/connectivity_service.js';
import {
    capture_focus_info_from_element,
    load_focus_storage,
    save_focus_storage,
    update_restore_position
} from './logic/focus_manager.js';
import {
    navigate_and_set_hash as navigate_and_set_hash_impl,
    handle_hash_change as handle_hash_change_impl,
    get_scope_key_from_view_and_params
} from './logic/router.js';
import {
    updatePageTitle as updatePageTitle_impl,
    updatePageTitleFromCurrentView as updatePageTitleFromCurrentView_impl
} from './logic/page_title_manager.js';
import {
    set_initial_theme,
    is_dev_build_environment,
    refresh_dev_build_info_from_server,
    refresh_production_build_info_from_server,
    update_build_timestamp,
    start_normal_session as start_normal_session_impl
} from './logic/session_manager.js';
import { MarkdownToolbar } from './features/markdown_toolbar.js';
import './utils/dependency_manager.js';
import './utils/console_manager.js';
import './utils/memory_manager.js';
import { consoleManager } from './utils/console_manager.js';
import { memoryManager } from './utils/memory_manager.js';
import { app_runtime_refs } from './utils/app_runtime_refs.js';
import { register_translation_module } from './utils/translation_access.js';
import { LayoutManager } from './utils/layout_manager.js';
import { setup_tooltip_overlay } from './utils/overlay_portal.js';

import { GlobalActionBarComponent } from './components/GlobalActionBarComponent.js';
import { ModalComponent } from './components/ModalComponent.js';
import { SideMenuComponent } from './components/SideMenuComponent.js';
import { ErrorBoundaryComponent } from './components/ErrorBoundaryComponent.js';
import { DraftManager } from './draft_manager.js';
import { get_auth_token, clear_auth_token, get_current_user_preferences, set_current_user_admin } from './api/client.js';
import { getState, dispatch, subscribe, initState, StoreActionTypes, loadStateFromLocalStorageBackup, updateBackupRestorePosition, APP_STATE_KEY } from './state.js';

import { resolve_app_dom, ensure_app_layout as ensure_app_layout_dom } from './logic/app_dom.js';
import {
    get_t_fallback,
    update_side_menu as update_side_menu_chrome,
    update_app_chrome_texts as update_app_chrome_texts_impl,
    init_global_components as init_global_components_impl
} from './logic/app_chrome.js';
import { init_draft_manager as init_draft_manager_impl } from './logic/draft_bootstrap.js';
import {
    ensure_skip_link_target,
    setup_skip_link_click_handler,
    update_landmarks_and_skip_link as update_landmarks_and_skip_link_impl
} from './logic/a11y_shell.js';
import { render_view as render_view_impl } from './logic/view_render.js';
import { init_app as init_app_impl, run_when_dom_ready } from './logic/app_bootstrap.js';
import { set_debug_nav, is_debug_nav } from './app/runtime_flags.js';

const notificationComponent = new NotificationComponent();
const modalComponent = new ModalComponent();
const sideMenuComponent = new SideMenuComponent();
const errorBoundaryComponent = new ErrorBoundaryComponent();

app_runtime_refs.notification_component = notificationComponent;
app_runtime_refs.modal_component = modalComponent;
register_translation_module(TranslationLogic);
if (typeof window !== 'undefined') {
    // AVSIKTLIGA globala tilldelningar — krävs av appens boot-sekvens.
    // window.Translation och window.Helpers används som fallback i många
    // moduler som laddas innan dependency injection är initialiserad.
    // Ta INTE bort dessa utan att först verifiera manuellt i webbläsaren.
    window.Translation = TranslationLogic;
    window.Helpers = Helpers;
}

(function () {
    'use strict';

    if (typeof window !== 'undefined' && window.location.search.includes('debug=nav')) {
        set_debug_nav(true);
        consoleManager.log('[GV-NAV] Debug aktiverad via URL (?debug=nav). Klicka Granskningar från Start och titta i konsolen.');
    }

    const nav_debug = (msg, data) => {
        if (is_debug_nav()) {
            consoleManager.log(`[GV-NAV] ${msg}`, data !== undefined ? data : '');
        }
    };

    const dom = resolve_app_dom();
    const {
        app_container,
        top_action_bar_container,
        bottom_action_bar_container
    } = dom;

    const layout_refs = {
        app_container,
        side_menu_root: null,
        main_view_root: null,
        right_sidebar_root: null
    };

    function ensure_app_layout() {
        ensure_app_layout_dom(layout_refs, { update_landmarks_and_skip_link });
    }

    const render_ctx = {
        current_view_name_rendered: null,
        current_view_params_rendered_json: '{}',
        current_view_component_instance: null
    };

    let error_boundary_instance = null;
    const error_boundary_holder = {
        get instance() {
            return error_boundary_instance;
        },
        set instance(v) {
            error_boundary_instance = v;
        }
    };

    const draft_listener_state = {
        draft_listeners_initialized: false,
        draft_is_composing: false
    };

    const top_action_bar_instance = new GlobalActionBarComponent();
    const bottom_action_bar_instance = new GlobalActionBarComponent();
    const side_menu_component_instance = sideMenuComponent;

    function update_landmarks_and_skip_link(view_name, params) {
        return update_landmarks_and_skip_link_impl(view_name, params);
    }

    function updatePageTitle(view_name, params) {
        return updatePageTitle_impl(view_name, params, { getState, Translation: TranslationLogic });
    }

    function updatePageTitleFromCurrentView() {
        return updatePageTitleFromCurrentView_impl({
            getState,
            Translation: TranslationLogic,
            get_current_view_name: () => render_ctx.current_view_name_rendered,
            get_current_view_params_json: () => render_ctx.current_view_params_rendered_json
        });
    }

    function update_app_chrome_texts() {
        return update_app_chrome_texts_impl({
            top_action_bar_instance,
            bottom_action_bar_instance,
            error_boundary_holder
        });
    }

    function update_side_menu(view_name, params) {
        return update_side_menu_chrome(view_name, params, {
            side_menu_component_instance,
            side_menu_root: layout_refs.side_menu_root,
            getState
        });
    }

    async function init_global_components() {
        await init_global_components_impl({
            getState,
            dispatch,
            StoreActionTypes,
            subscribe,
            clear_auth_token,
            notificationComponent,
            modalComponent,
            side_menu_root: layout_refs.side_menu_root,
            top_action_bar_container,
            bottom_action_bar_container,
            main_view_root: layout_refs.main_view_root,
            app_container,
            side_menu_component_instance,
            top_action_bar_instance,
            bottom_action_bar_instance,
            errorBoundaryComponent,
            error_boundary_holder,
            navigate_and_set_hash,
            AuditLogic,
            ValidationLogic,
            AutosaveService,
            render_ctx
        });
        error_boundary_instance = error_boundary_holder.instance;
    }

    function navigate_and_set_hash(target_view_name, target_params = {}) {
        return navigate_and_set_hash_impl(target_view_name, target_params, {
            nav_debug,
            getState,
            get_current_view_name: () => render_ctx.current_view_name_rendered,
            get_current_view_component: () => render_ctx.current_view_component_instance,
            updatePageTitle
        });
    }

    function is_focus_in_editable_field(view_root) {
        if (!view_root) return false;
        const active = document.activeElement;
        if (!active || !view_root.contains(active)) return false;
        const tag = active.tagName ? active.tagName.toLowerCase() : '';
        return tag === 'input' || tag === 'textarea' || tag === 'select';
    }

    const render_view_deps = () => ({
        nav_debug,
        getState,
        get_t_fallback,
        ensure_app_layout,
        update_side_menu,
        main_view_root: layout_refs.main_view_root,
        app_container,
        bottom_action_bar_container,
        top_action_bar_instance,
        bottom_action_bar_instance,
        update_landmarks_and_skip_link,
        ensure_skip_link_target,
        is_focus_in_editable_field,
        render_ctx,
        error_boundary_holder,
        right_sidebar_root: layout_refs.right_sidebar_root,
        notificationComponent,
        navigate_and_set_hash,
        subscribe,
        dispatch,
        StoreActionTypes,
        AuditLogic,
        AutosaveService,
        ValidationLogic,
        updatePageTitle,
        start_normal_session,
        updateBackupRestorePosition
    });

    async function render_view(view_name_to_render, params_to_render = {}) {
        return render_view_impl(view_name_to_render, params_to_render, render_view_deps());
    }

    async function handle_hash_change() {
        return handle_hash_change_impl({
            nav_debug,
            dispatch,
            StoreActionTypes,
            navigate_and_set_hash,
            updatePageTitle,
            render_view,
            load_focus_storage,
            get_scope_key_from_view_and_params,
            getState
        });
    }

    function on_language_changed_event() {
        update_app_chrome_texts();
        updatePageTitleFromCurrentView();
        try {
            const parsed_params = JSON.parse(render_ctx.current_view_params_rendered_json || '{}');
            update_side_menu(render_ctx.current_view_name_rendered, parsed_params);
        } catch (error) {
            consoleManager.warn('[Main.js] Failed to parse current view params for side menu update:', error);
            update_side_menu(render_ctx.current_view_name_rendered, {});
        }
        if (render_ctx.current_view_component_instance && typeof render_ctx.current_view_component_instance.render === 'function') {
            render_ctx.current_view_component_instance.render();
        }
    }

    async function start_normal_session(options = {}) {
        return start_normal_session_impl({
            ...options,
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
            get_main_view_root: () => layout_refs.main_view_root,
            get_app_container: () => app_container,
            get_current_view_name_rendered: () => render_ctx.current_view_name_rendered,
            get_current_view_params_rendered_json: () => render_ctx.current_view_params_rendered_json,
            update_restore_position,
            updateBackupRestorePosition,
            get_scope_key_from_view_and_params,
            load_focus_storage,
            save_focus_storage,
            top_action_bar_instance,
            bottom_action_bar_instance,
            error_boundary_instance,
            NotificationComponent: notificationComponent,
            DraftManager,
            capture_focus_state,
            restore_focus_state,
            updatePageTitle,
            updatePageTitleFromCurrentView,
            update_side_menu,
            get_current_view_component: () => render_ctx.current_view_component_instance,
            is_focus_in_editable_field,
            subscribe,
            getState,
            dispatch,
            StoreActionTypes,
            update_app_chrome_texts
        });
    }

    function init_draft_manager() {
        init_draft_manager_impl({
            notificationComponent,
            render_ctx,
            main_view_root_provider: () => layout_refs.main_view_root,
            app_container_provider: () => app_container,
            listener_state: draft_listener_state
        });
    }

    async function init_app() {
        return init_app_impl({
            set_initial_theme,
            is_dev_build_environment,
            refresh_dev_build_info_from_server,
            refresh_production_build_info_from_server,
            update_build_timestamp,
            APP_STATE_KEY,
            initState,
            init_draft_manager,
            setup_skip_link_click_handler,
            update_landmarks_and_skip_link,
            get_auth_token,
            get_current_user_preferences,
            set_current_user_admin,
            dispatch,
            StoreActionTypes,
            loadStateFromLocalStorageBackup,
            ensure_app_layout,
            layout_refs,
            init_global_components,
            notificationComponent,
            render_view,
            start_normal_session,
            memoryManagerRef: memoryManager,
            getState,
            ValidationLogic,
            navigate_and_set_hash,
            handle_hash_change
        });
    }

    run_when_dom_ready(async () => {
        await init_app();
        const { init_token_refresh_service } = await import('./logic/token_refresh_service.js');
        init_token_refresh_service();
    });
})();

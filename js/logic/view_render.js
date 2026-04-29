/**
 * Vyrendering: init/destroy/render av aktuell vykomponent.
 */
import { flush_sync_to_server } from './server_sync.js';
import { DraftManager } from '../draft_manager.js';
import * as Helpers from '../utils/helpers.js';
import * as SaveAuditLogic from '../logic/save_audit_logic.ts';
import { get_registered_translation_module } from '../utils/translation_access.js';
import { public_api as ExportLogicApi } from '../export_logic.js';
import {
    apply_post_render_focus_instruction,
    update_restore_position
} from './focus_manager.js';
import { dependencyManager } from '../utils/dependency_manager.js';
import { consoleManager } from '../utils/console_manager.js';
import { ensure_main_view_content_host, clear_main_view_content_except_global_notifications } from './app_dom.js';
import { get_component_class, rulefileSectionsViewComponent, requirementListComponent } from './view_components_index.js';
import { resolve_view_request } from '../view/resolve_view_request.js';
import { resolve_skip_target, resolve_view_dom_host } from '../view/view_dom_host.js';
import {
    clear_view_root_for_next_view,
    destroy_previous_view_component,
    flush_before_view_switch,
    init_and_render_view_component,
    is_same_view_quick_render,
    render_quick_view
} from '../view/view_lifecycle.js';
import { render_view_not_found, handle_view_lifecycle_error } from '../view/view_error_handler.js';
import { set_current_view_tracking, get_restore_position_via_hook } from '../app/browser_globals.js';

/**
 * Renderar en vy utifrån namn och parametrar.
 * @param {string} view_name_to_render
 * @param {object} params_to_render
 * @param {object} deps - Alla beroenden från main (DOM, state, hjälpfunktioner).
 */
export async function render_view(view_name_to_render, params_to_render = {}, deps) {
    const {
        nav_debug,
        getState,
        get_t_fallback,
        ensure_app_layout,
        update_side_menu,
        main_view_root,
        app_container,
        bottom_action_bar_container,
        top_action_bar_instance,
        bottom_action_bar_instance,
        update_landmarks_and_skip_link,
        ensure_skip_link_target,
        is_focus_in_editable_field,
        render_ctx,
        error_boundary_holder,
        right_sidebar_root,
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
    } = deps;

    const resolved = resolve_view_request({ view_name_to_render, params_to_render, deps });
    let view_name_mut = resolved.view_name;
    let params_mut = resolved.params;

    nav_debug('render_view startar', { view_name_to_render: view_name_mut, params_to_render: params_mut });
    const t = get_t_fallback();
    const local_helpers_escape_html = (typeof Helpers.escape_html === 'function')
        ? Helpers.escape_html
        : (s) => s;

    let view_root;
    // Rot för vy-init: #app-main-view-content i <main> när layout finns, annars samma som view_root.
    let view_init_root;
    const resolved_dom = resolve_view_dom_host({ view_name: view_name_mut, deps });
    view_root = resolved_dom.view_root;
    view_init_root = resolved_dom.view_init_root;

    update_side_menu(view_name_mut, params_mut);

    const resolved_main_view_root = resolved_dom.resolved_main_view_root;

    const prev_view = render_ctx.current_view_name_rendered;
    const prev_params_json = render_ctx.current_view_params_rendered_json;
    render_ctx.current_view_name_rendered = view_name_mut;
    render_ctx.current_view_params_rendered_json = JSON.stringify(params_mut);
    try {
        set_current_view_tracking(
            render_ctx.current_view_name_rendered,
            render_ctx.current_view_params_rendered_json
        );
    } catch (_) {
        // ignoreras medvetet
    }

    const current_view_component_instance = render_ctx.current_view_component_instance;
    const is_quick = is_same_view_quick_render({
        prev_view,
        view_name: view_name_mut,
        prev_params_json,
        params: params_mut,
        current_view_component_instance
    });

    if (is_quick) {
        await render_quick_view({
            view_root,
            current_view_component_instance,
            top_action_bar_instance,
            bottom_action_bar_container,
            bottom_action_bar_instance,
            update_landmarks_and_skip_link,
            is_focus_in_editable_field,
            notificationComponent,
            ensure_skip_link_target,
            resolve_skip_target
        });
        return;
    }
    top_action_bar_instance.render();
    bottom_action_bar_container.style.display = '';
    bottom_action_bar_instance.render();
    update_landmarks_and_skip_link();

    const prev_params = prev_params_json ? (() => { try { return JSON.parse(prev_params_json); } catch (_) { return {}; } })() : {};
    const is_rulefile_sections_edit_toggle = view_name_mut === 'rulefile_sections' &&
        prev_view === 'rulefile_sections' &&
        prev_params.section === (params_mut?.section || 'general') &&
        (prev_params.edit === 'true') !== (params_mut?.edit === 'true') &&
        current_view_component_instance === rulefileSectionsViewComponent &&
        typeof current_view_component_instance.render === 'function';

    if (is_rulefile_sections_edit_toggle) {
        current_view_component_instance.deps.params = params_mut;
        const renderPromise = current_view_component_instance.render();
        if (renderPromise && typeof renderPromise.then === 'function') {
            await renderPromise;
        }
        const skip_target_rf = resolve_skip_target({ view_root }) || view_root;
        ensure_skip_link_target(skip_target_rf);
        if (DraftManager?.restoreIntoDom) DraftManager.restoreIntoDom(skip_target_rf);
        update_restore_position(view_name_mut, params_mut, null);
        updateBackupRestorePosition(get_restore_position_via_hook());
        apply_post_render_focus_instruction({ view_name: view_name_mut, view_root: skip_target_rf });
        return;
    }

    await flush_before_view_switch({ flush_sync_to_server, getState, dispatch, consoleManager });

    destroy_previous_view_component({
        current_view_component_instance,
        notificationComponent,
        requirementListComponent,
        view_name_to_render: view_name_mut,
        error_boundary_holder,
        render_ctx,
        consoleManager
    });

    const cleared_host = clear_view_root_for_next_view({
        view_root,
        ensure_main_view_content_host,
        clear_main_view_content_except_global_notifications
    });
    if (cleared_host) view_init_root = cleared_host;
    render_ctx.current_view_component_instance = null;

    const ComponentClass = get_component_class(view_name_mut);
    if (!ComponentClass) {
        render_view_not_found({
            view_name: view_name_mut,
            t,
            local_helpers_escape_html,
            view_init_root,
            ensure_skip_link_target,
            consoleManager
        });
        return;
    }

    try {
        if (error_boundary_holder.instance && error_boundary_holder.instance.clear_error) {
            error_boundary_holder.instance.clear_error();
        }

        await init_and_render_view_component({
            ComponentClass,
            view_init_root,
            view_name: view_name_mut,
            params: params_mut,
            deps,
            render_ctx,
            dependencyManager,
            get_registered_translation_module,
            Helpers,
            SaveAuditLogic,
            ExportLogicApi,
            right_sidebar_root,
            flush_sync_to_server
        });
        if (render_ctx.current_view_name_rendered === view_name_mut) {
            updatePageTitle(view_name_mut, params_mut);
        }
        ensure_skip_link_target(view_init_root);
        if (DraftManager?.restoreIntoDom) {
            DraftManager.restoreIntoDom(view_init_root);
        }
        update_restore_position(view_name_mut, params_mut, null);
        updateBackupRestorePosition(get_restore_position_via_hook());

        apply_post_render_focus_instruction({
            view_name: view_name_mut,
            view_root: view_init_root
        });

        if (typeof update_landmarks_and_skip_link === 'function') {
            update_landmarks_and_skip_link(view_name_mut, params_mut);
        }

        if (notificationComponent?.append_global_message_areas_to) {
            notificationComponent.append_global_message_areas_to(null);
        }

    } catch (error) {
        handle_view_lifecycle_error({
            error,
            view_name: view_name_mut,
            params: params_mut,
            deps,
            error_boundary_holder,
            view_init_root,
            t,
            local_helpers_escape_html,
            ensure_skip_link_target,
            consoleManager,
            render_view
        });
    }
}

/**
 * Vyrendering: init/destroy/render av aktuell vykomponent.
 */
import { flush_sync_to_server } from './server_sync.js';
import { DraftManager } from '../draft_manager.js';
import {
    apply_post_render_focus_instruction,
    update_restore_position
} from './focus_manager.js';
import { dependencyManager } from '../utils/dependency_manager.js';
import { consoleManager } from '../utils/console_manager.js';
import { get_component_class, rulefileSectionsViewComponent, requirementListComponent } from './view_components_index.js';

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

    let view_name_mut = view_name_to_render;
    let params_mut = { ...params_to_render };

    nav_debug('render_view startar', { view_name_to_render: view_name_mut, params_to_render: params_mut });
    if (view_name_mut === 'edit_rulefile_main') {
        view_name_mut = 'rulefile_sections';
        params_mut = { ...params_mut, section: 'general' };
    }
    const t = get_t_fallback();
    const local_helpers_escape_html = (typeof window.Helpers !== 'undefined' && typeof window.Helpers.escape_html === 'function')
        ? window.Helpers.escape_html
        : (s) => s;

    try {
        const state_for_view = typeof getState === 'function' ? getState() : null;
        const is_published_rulefile = state_for_view?.ruleFileIsPublished === true;
        if (is_published_rulefile &&
            (view_name_mut === 'rulefile_edit_requirement' || view_name_mut === 'rulefile_add_requirement')) {
            if (view_name_mut === 'rulefile_edit_requirement' && params_mut?.id) {
                view_name_mut = 'rulefile_view_requirement';
            } else {
                view_name_mut = 'rulefile_requirements';
                params_mut = {};
            }
        }
    } catch (e) {
        consoleManager.warn('[Main.js] Kunde inte kontrollera ruleFileIsPublished vid vybyte:', e?.message || e);
    }

    if (view_name_mut === 'login' && typeof (params_mut?.on_login) !== 'function') {
        params_mut = {
            ...params_mut,
            on_login: () => {
                start_normal_session().catch((err) =>
                    consoleManager.error('Error starting session after login:', err)
                );
            }
        };
    }

    if (view_name_mut !== 'login') {
        ensure_app_layout();
    }

    let view_root;
    if (view_name_mut === 'login') {
        document.body.classList.add('view-login');
        ensure_app_layout();
        view_root = main_view_root || app_container;
    } else {
        document.body.classList.remove('view-login');
        view_root = main_view_root || app_container;
    }

    update_side_menu(view_name_mut, params_mut);

    if (main_view_root) {
        if (view_name_mut === 'start') {
            main_view_root.classList.add('start-view-active');
        } else {
            main_view_root.classList.remove('start-view-active');
        }
    }

    const prev_view = render_ctx.current_view_name_rendered;
    const prev_params_json = render_ctx.current_view_params_rendered_json;
    render_ctx.current_view_name_rendered = view_name_mut;
    render_ctx.current_view_params_rendered_json = JSON.stringify(params_mut);
    try {
        window.__gv_current_view_name = render_ctx.current_view_name_rendered;
    } catch (_) {
        // ignoreras medvetet
    }

    const current_view_component_instance = render_ctx.current_view_component_instance;
    const is_same_view_quick_render = prev_view === view_name_mut &&
        prev_params_json === JSON.stringify(params_mut) &&
        current_view_component_instance && typeof current_view_component_instance.render === 'function';

    if (is_same_view_quick_render) {
        top_action_bar_instance.render();
        bottom_action_bar_container.style.display = '';
        bottom_action_bar_instance.render();
        update_landmarks_and_skip_link();
        if (!is_focus_in_editable_field(view_root)) {
            current_view_component_instance.render();
        }
        ensure_skip_link_target(view_root);
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
        ensure_skip_link_target(view_root);
        if (DraftManager?.restoreIntoDom) DraftManager.restoreIntoDom(view_root);
        update_restore_position(view_name_mut, params_mut, null);
        updateBackupRestorePosition(window.__gv_get_restore_position?.());
        apply_post_render_focus_instruction({ view_name: view_name_mut, view_root });
        return;
    }

    try {
        await flush_sync_to_server(getState, dispatch);
    } catch (flushErr) {
        consoleManager.warn('[Main.js] flush_sync_to_server:', flushErr?.message || flushErr);
    }

    if (current_view_component_instance && typeof current_view_component_instance.destroy === 'function') {
        notificationComponent?.clear_global_message?.();
        if (current_view_component_instance === requirementListComponent && view_name_mut === 'rulefile_requirements') {
            try {
                current_view_component_instance.destroy();
            } catch (err) {
                consoleManager.warn('[Main.js] Warning destroying RequirementListComponent before switching to rulefile view:', err);
                if (error_boundary_holder.instance && error_boundary_holder.instance.show_error) {
                    error_boundary_holder.instance.show_error({
                        message: `Component destruction failed: ${err.message}`,
                        stack: err.stack,
                        component: 'RequirementListComponent'
                    });
                }
            }
        } else {
            try {
                current_view_component_instance.destroy();
            } catch (err) {
                consoleManager.error('[Main.js] Error destroying component:', err);
                if (error_boundary_holder.instance && error_boundary_holder.instance.show_error) {
                    error_boundary_holder.instance.show_error({
                        message: `Component destruction failed: ${err.message}`,
                        stack: err.stack,
                        component: render_ctx.current_view_name_rendered || 'Unknown'
                    });
                }
            }
        }
    }
    if (view_root) {
        view_root.innerHTML = '';
    }
    render_ctx.current_view_component_instance = null;

    const ComponentClass = get_component_class(view_name_mut);
    if (!ComponentClass) {
        consoleManager.error(`[Main.js] View "${view_name_mut}" not found in render_view switch.`);
        const error_h1 = document.createElement('h1');
        error_h1.textContent = t('error_loading_view_details');
        const error_p = document.createElement('p');
        error_p.textContent = t('error_view_not_found', { viewName: local_helpers_escape_html(view_name_mut) });
        if (view_root) {
            view_root.appendChild(error_h1);
            view_root.appendChild(error_p);
            ensure_skip_link_target(view_root);
        }
        return;
    }

    try {
        if (error_boundary_holder.instance && error_boundary_holder.instance.clear_error) {
            error_boundary_holder.instance.clear_error();
        }

        await dependencyManager.waitForDependencies();

        render_ctx.current_view_component_instance = ComponentClass;

        if (!render_ctx.current_view_component_instance || typeof render_ctx.current_view_component_instance.init !== 'function' || typeof render_ctx.current_view_component_instance.render !== 'function') {
            throw new Error('Component is invalid or missing required methods.');
        }

        await render_ctx.current_view_component_instance.init({
            root: view_root,
            deps: {
                router: navigate_and_set_hash,
                params: params_mut,
                view_name: view_name_mut,
                getState,
                dispatch,
                StoreActionTypes,
                subscribe,
                flush_sync_to_server,
                Translation: window.Translation,
                Helpers: window.Helpers,
                NotificationComponent: notificationComponent,
                SaveAuditLogic: window.SaveAuditLogic,
                AuditLogic: AuditLogic,
                ExportLogic: window.ExportLogic,
                ValidationLogic: ValidationLogic,
                AutosaveService: AutosaveService,
                rightSidebarRoot: right_sidebar_root
            }
        });

        const render_promise = render_ctx.current_view_component_instance.render();
        if (render_promise && typeof render_promise.then === 'function') {
            await render_promise;
        }
        if (render_ctx.current_view_name_rendered === view_name_mut) {
            updatePageTitle(view_name_mut, params_mut);
        }
        ensure_skip_link_target(view_root);
        if (DraftManager?.restoreIntoDom) {
            DraftManager.restoreIntoDom(view_root);
        }
        update_restore_position(view_name_mut, params_mut, null);
        updateBackupRestorePosition(window.__gv_get_restore_position?.());

        apply_post_render_focus_instruction({
            view_name: view_name_mut,
            view_root
        });

        if (typeof update_landmarks_and_skip_link === 'function') {
            update_landmarks_and_skip_link(view_name_mut, params_mut);
        }

    } catch (error) {
        consoleManager.error(`[Main.js] CATCH BLOCK: Error during view ${view_name_mut} lifecycle:`, error);

        if (error_boundary_holder.instance && error_boundary_holder.instance.show_error) {
            const retry_callback = () => {
                consoleManager.log(`[Main.js] Retrying view ${view_name_mut}`);
                render_view(view_name_mut, params_mut, deps);
            };

            error_boundary_holder.instance.show_error({
                message: error.message,
                stack: error.stack,
                component: view_name_mut
            }, retry_callback);
        } else {
            const view_name_escaped_for_error = local_helpers_escape_html(view_name_mut);
            if (view_root) {
                const error_h1 = document.createElement('h1');
                error_h1.textContent = t('error_loading_view_details');
                const error_p = document.createElement('p');
                error_p.textContent = t('error_loading_view', { viewName: view_name_escaped_for_error, errorMessage: error.message });
                view_root.appendChild(error_h1);
                view_root.appendChild(error_p);
                ensure_skip_link_target(view_root);
            }
        }
    }
}

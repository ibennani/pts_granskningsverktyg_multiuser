export function is_same_view_quick_render({ prev_view, view_name, prev_params_json, params, current_view_component_instance }) {
    // login: params innehåller on_login (funktion) som JSON.stringify utelämnar → falsk träff mot '{}' och snabbrender utan init.
    return prev_view === view_name &&
        view_name !== 'login' &&
        prev_params_json === JSON.stringify(params) &&
        current_view_component_instance && typeof current_view_component_instance.render === 'function';
}

export async function render_quick_view({
    view_root,
    view_name,
    current_view_component_instance,
    top_action_bar_instance,
    bottom_action_bar_container,
    bottom_action_bar_instance,
    update_landmarks_and_skip_link,
    is_focus_in_editable_field,
    notificationComponent,
    ensure_skip_link_target,
    resolve_skip_target,
}) {
    top_action_bar_instance.render();
    bottom_action_bar_container.style.display = '';
    bottom_action_bar_instance.render();
    update_landmarks_and_skip_link();

    if (!is_focus_in_editable_field(view_root)) {
        current_view_component_instance.render();
    }
    if (notificationComponent?.append_global_message_areas_to) {
        notificationComponent.append_global_message_areas_to(null);
    }
    if (view_name !== 'audit_overview') {
        const { sync_version_reload_banner_in_host } = await import('../logic/version_reload_banner_mount.js');
        sync_version_reload_banner_in_host(view_root);
    }
    const skip_target = resolve_skip_target({ view_root }) || view_root;
    ensure_skip_link_target(skip_target);
}

export async function flush_before_view_switch({ flush_sync_to_server, getState, dispatch, consoleManager }) {
    try {
        await flush_sync_to_server(getState, dispatch);
    } catch (flushErr) {
        consoleManager.warn('[Main.js] flush_sync_to_server:', flushErr?.message || flushErr);
    }
}

/**
 * Kärnparametrar för kravvy (utan sidomeny-inställningar i hash).
 * @param {Record<string, string>|null|undefined} params
 * @returns {{ sampleId?: string, requirementId?: string }}
 */
export function requirement_audit_core_route_params(params) {
    const p = params && typeof params === 'object' ? params : {};
    const out = {};
    if (p.sampleId !== undefined && p.sampleId !== null && p.sampleId !== '') {
        out.sampleId = String(p.sampleId);
    }
    if (p.requirementId !== undefined && p.requirementId !== null && p.requirementId !== '') {
        out.requirementId = String(p.requirementId);
    }
    return out;
}

/**
 * Vybyte inom kravgranskning när endast granskningsdel eller krav ändras.
 */
export function is_requirement_audit_core_param_change({
    prev_view,
    view_name,
    prev_params,
    params,
    current_view_component_instance,
    requirement_audit_component
}) {
    if (view_name !== 'requirement_audit' || prev_view !== 'requirement_audit') return false;
    if (!current_view_component_instance || current_view_component_instance !== requirement_audit_component) {
        return false;
    }
    if (typeof current_view_component_instance.render !== 'function') return false;

    const prev_core = requirement_audit_core_route_params(prev_params);
    const next_core = requirement_audit_core_route_params(params);
    if (!next_core.sampleId || !next_core.requirementId) return false;

    return (
        prev_core.sampleId !== next_core.sampleId ||
        prev_core.requirementId !== next_core.requirementId
    );
}

export async function destroy_previous_view_component({
    current_view_component_instance,
    notificationComponent,
    requirementListComponent,
    view_name_to_render,
    error_boundary_holder,
    render_ctx,
    consoleManager
}) {
    if (!current_view_component_instance || typeof current_view_component_instance.destroy !== 'function') return;

    notificationComponent?.clear_global_message?.();
    if (current_view_component_instance === requirementListComponent && view_name_to_render === 'rulefile_requirements') {
        try {
            await current_view_component_instance.destroy();
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
        return;
    }

    try {
        const destroy_result = current_view_component_instance.destroy();
        if (destroy_result && typeof destroy_result.then === 'function') {
            await destroy_result;
        }
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

export function clear_view_root_for_next_view({ view_root, ensure_main_view_content_host, clear_main_view_content_except_global_notifications }) {
    if (!view_root) return null;
    if (view_root.id === 'app-main-view-root') {
        const host = ensure_main_view_content_host(view_root);
        if (host) {
            clear_main_view_content_except_global_notifications(host);
            return host;
        }
        view_root.innerHTML = '';
        return null;
    }
    view_root.innerHTML = '';
    return null;
}

export async function init_and_render_view_component({
    ComponentClass,
    view_init_root,
    view_name,
    params,
    deps,
    render_ctx,
    dependencyManager,
    get_registered_translation_module,
    Helpers,
    SaveAuditLogic,
    ExportLogicApi,
    right_sidebar_root,
    flush_sync_to_server
}) {
    await dependencyManager.waitForDependencies();

    render_ctx.current_view_component_instance = ComponentClass;

    if (!render_ctx.current_view_component_instance ||
        typeof render_ctx.current_view_component_instance.init !== 'function' ||
        typeof render_ctx.current_view_component_instance.render !== 'function') {
        throw new Error('Component is invalid or missing required methods.');
    }

    const {
        navigate_and_set_hash,
        getState,
        dispatch,
        StoreActionTypes,
        subscribe,
        notificationComponent,
        AuditLogic,
        ValidationLogic,
        AutosaveService
    } = deps;

    await render_ctx.current_view_component_instance.init({
        root: view_init_root,
        deps: {
            router: navigate_and_set_hash,
            params,
            view_name,
            getState,
            dispatch,
            StoreActionTypes,
            subscribe,
            flush_sync_to_server,
            Translation: get_registered_translation_module(),
            Helpers,
            NotificationComponent: notificationComponent,
            SaveAuditLogic,
            AuditLogic,
            ExportLogic: ExportLogicApi,
            ValidationLogic,
            AutosaveService,
            rightSidebarRoot: right_sidebar_root
        }
    });

    const render_promise = render_ctx.current_view_component_instance.render();
    if (render_promise && typeof render_promise.then === 'function') {
        await render_promise;
    }
}


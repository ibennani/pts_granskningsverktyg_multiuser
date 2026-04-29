export function render_view_not_found({ view_name, t, local_helpers_escape_html, view_init_root, ensure_skip_link_target, consoleManager }) {
    consoleManager.error(`[Main.js] View "${view_name}" not found in render_view switch.`);
    const error_h1 = document.createElement('h1');
    error_h1.textContent = t('error_loading_view_details');
    const error_p = document.createElement('p');
    error_p.textContent = t('error_view_not_found', { viewName: local_helpers_escape_html(view_name) });
    if (view_init_root) {
        view_init_root.appendChild(error_h1);
        view_init_root.appendChild(error_p);
        ensure_skip_link_target(view_init_root);
    }
}

export function handle_view_lifecycle_error({
    error,
    view_name,
    params,
    deps,
    error_boundary_holder,
    view_init_root,
    t,
    local_helpers_escape_html,
    ensure_skip_link_target,
    consoleManager,
    render_view
}) {
    consoleManager.error(`[Main.js] CATCH BLOCK: Error during view ${view_name} lifecycle:`, error);

    if (error_boundary_holder.instance && error_boundary_holder.instance.show_error) {
        const retry_callback = () => {
            consoleManager.log(`[Main.js] Retrying view ${view_name}`);
            render_view(view_name, params, deps);
        };

        error_boundary_holder.instance.show_error({
            message: error.message,
            stack: error.stack,
            component: view_name
        }, retry_callback);
        return;
    }

    const view_name_escaped_for_error = local_helpers_escape_html(view_name);
    if (view_init_root) {
        const error_h1 = document.createElement('h1');
        error_h1.textContent = t('error_loading_view_details');
        const error_p = document.createElement('p');
        error_p.textContent = t('error_loading_view', { viewName: view_name_escaped_for_error, errorMessage: error.message });
        view_init_root.appendChild(error_h1);
        view_init_root.appendChild(error_p);
        ensure_skip_link_target(view_init_root);
    }
}


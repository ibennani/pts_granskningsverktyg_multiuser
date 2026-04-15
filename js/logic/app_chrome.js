/**
 * Globalt skal: sidomeny, action bars, modal, felgräns och gemensamma deps.
 */
import * as Helpers from '../utils/helpers.js';
import * as SaveAuditLogic from '../logic/save_audit_logic.ts';
import { get_registered_translation_module, get_translation_t } from '../utils/translation_access.js';
import { consoleManager } from '../utils/console_manager.js';
import { dependencyManager } from '../utils/dependency_manager.js';

export function get_t_fallback() {
    return get_translation_t();
}

/**
 * @param {string} view_name
 * @param {object} [params]
 * @param {object} deps
 */
export function update_side_menu(view_name, params = {}, deps) {
    const { side_menu_component_instance, side_menu_root, getState } = deps;
    if (!side_menu_component_instance || typeof side_menu_component_instance.render !== 'function') return;

    if (view_name === 'login') {
        if (side_menu_root) {
            side_menu_root.innerHTML = '';
            side_menu_root.classList.add('hidden');
        }
        return;
    }

    const state_for_menu = typeof getState === 'function' ? getState() : null;
    const is_initial_setup_view =
        (
            view_name === 'metadata' ||
            view_name === 'edit_metadata' ||
            view_name === 'sample_management' ||
            view_name === 'sample_form' ||
            view_name === 'confirm_sample_edit'
        ) &&
        state_for_menu?.auditStatus === 'not_started';
    if (is_initial_setup_view) {
        if (side_menu_root) {
            side_menu_root.innerHTML = '';
            side_menu_root.classList.add('hidden');
        }
        return;
    }

    if (side_menu_root) {
        side_menu_root.classList.remove('hidden');
    }

    if (typeof side_menu_component_instance.set_current_view === 'function') {
        side_menu_component_instance.set_current_view(view_name, params);
    }
    side_menu_component_instance.render();
}

/**
 * @param {object} deps
 */
export function update_app_chrome_texts(deps) {
    const { top_action_bar_instance, bottom_action_bar_instance, error_boundary_holder } = deps;
    const Translation = get_registered_translation_module();
    if (!Translation || typeof Translation.t !== 'function') {
        consoleManager.warn('[Main.js] update_app_chrome_texts: Translation.t is not available.');
        return;
    }
    try {
        if (top_action_bar_instance && typeof top_action_bar_instance.render === 'function') {
            top_action_bar_instance.render();
        }
    } catch (error) {
        consoleManager.error('[Main.js] Error rendering top action bar:', error);
        if (error_boundary_holder.instance && error_boundary_holder.instance.show_error) {
            error_boundary_holder.instance.show_error({
                message: `Top action bar render failed: ${error.message}`,
                stack: error.stack,
                component: 'TopActionBar'
            });
        }
    }

    try {
        if (bottom_action_bar_instance && typeof bottom_action_bar_instance.render === 'function') {
            bottom_action_bar_instance.render();
        }
    } catch (error) {
        consoleManager.error('[Main.js] Error rendering bottom action bar:', error);
        if (error_boundary_holder.instance && error_boundary_holder.instance.show_error) {
            error_boundary_holder.instance.show_error({
                message: `Bottom action bar render failed: ${error.message}`,
                stack: error.stack,
                component: 'BottomActionBar'
            });
        }
    }
}

/**
 * @param {object} deps
 */
export async function init_global_components(deps) {
    const {
        getState,
        dispatch,
        StoreActionTypes,
        subscribe,
        clear_auth_token,
        notificationComponent,
        modalComponent,
        side_menu_root,
        top_action_bar_container,
        bottom_action_bar_container,
        main_view_root,
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
    } = deps;

    await dependencyManager.initialize();

    const Translation = get_registered_translation_module();
    if (!Translation || !Helpers || !notificationComponent || !SaveAuditLogic) {
        consoleManager.error('[Main.js] init_global_components: Core dependencies not available!');
        return;
    }
    const common_deps = {
        getState: getState,
        dispatch: dispatch,
        StoreActionTypes: StoreActionTypes,
        Translation,
        Helpers: Helpers,
        NotificationComponent: notificationComponent,
        ModalComponent: modalComponent,
        SaveAuditLogic: SaveAuditLogic,
        AuditLogic: AuditLogic,
        ValidationLogic: ValidationLogic,
        AutosaveService: AutosaveService,
        get_current_view_name: () => render_ctx.current_view_name_rendered
    };

    try {
        if (side_menu_root) {
            await side_menu_component_instance.init({
                root: side_menu_root,
                deps: {
                    ...common_deps,
                    router: navigate_and_set_hash,
                    subscribe,
                    clear_auth_token
                }
            });
        }
    } catch (error) {
        consoleManager.error('[Main.js] Failed to initialize side menu:', error);
    }
    try {
        await top_action_bar_instance.init({ root: top_action_bar_container, deps: common_deps });
    } catch (error) {
        consoleManager.error('[Main.js] Failed to initialize top action bar:', error);
        if (error_boundary_holder.instance && error_boundary_holder.instance.show_error) {
            error_boundary_holder.instance.show_error({
                message: `Top action bar initialization failed: ${error.message}`,
                stack: error.stack,
                component: 'TopActionBar'
            });
        }
    }

    try {
        await bottom_action_bar_instance.init({ root: bottom_action_bar_container, deps: common_deps });
    } catch (error) {
        consoleManager.error('[Main.js] Failed to initialize bottom action bar:', error);
        if (error_boundary_holder.instance && error_boundary_holder.instance.show_error) {
            error_boundary_holder.instance.show_error({
                message: `Bottom action bar initialization failed: ${error.message}`,
                stack: error.stack,
                component: 'BottomActionBar'
            });
        }
    }

    try {
        error_boundary_holder.instance = errorBoundaryComponent;
        await error_boundary_holder.instance.init({ root: main_view_root || app_container, deps: common_deps });
    } catch (error) {
        consoleManager.error('[Main.js] Failed to initialize error boundary:', error);
    }

    const modal_root = document.getElementById('modal-root');
    if (modal_root) {
        try {
            await modalComponent.init({ root: modal_root, deps: common_deps });
        } catch (error) {
            consoleManager.error('[Main.js] Failed to initialize modal:', error);
        }
    }
}

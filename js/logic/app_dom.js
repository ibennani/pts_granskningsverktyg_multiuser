/**
 * DOM-upplösning för app-shell och layout (app-layout, huvudvy, sidomeny).
 */
import { consoleManager } from '../utils/console_manager.js';

/**
 * Hämtar eller skapar kärncontainrar (wrapper, app, action bars).
 * @returns {{ app_wrapper: HTMLElement, app_container: HTMLElement, top_action_bar_container: HTMLElement, bottom_action_bar_container: HTMLElement }}
 */
export function resolve_app_dom() {
    let app_wrapper = document.getElementById('app-wrapper');
    let app_container = document.getElementById('app-container');
    let top_action_bar_container = document.getElementById('global-action-bar-top');
    let bottom_action_bar_container = document.getElementById('global-action-bar-bottom');

    if (!app_wrapper) {
        consoleManager.error('[Main.js] CRITICAL: App wrapper not found in DOM! Creating fallback wrapper.');
        app_wrapper = document.createElement('div');
        app_wrapper.id = 'app-wrapper';

        if (document.body) {
            document.body.appendChild(app_wrapper);
        } else {
            document.documentElement.appendChild(app_wrapper);
        }
    }

    if (!app_container) {
        consoleManager.error('[Main.js] CRITICAL: App container not found in DOM! Creating fallback container.');
        app_container = document.createElement('div');
        app_container.id = 'app-container';
        app_container.style.cssText = 'min-height: 100vh; padding: 20px;';

        if (app_wrapper) {
            app_wrapper.appendChild(app_container);
        } else if (document.body) {
            document.body.appendChild(app_container);
        } else {
            document.documentElement.appendChild(app_container);
        }
    }

    if (!top_action_bar_container) {
        consoleManager.warn('[Main.js] Top action bar container not found. Creating fallback container.');
        top_action_bar_container = document.createElement('div');
        top_action_bar_container.id = 'global-action-bar-top';
        top_action_bar_container.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #f8f9fa; border-bottom: 1px solid #dee2e6;';

        if (app_wrapper) {
            app_wrapper.insertBefore(top_action_bar_container, app_wrapper.firstChild);
        } else if (document.body) {
            document.body.insertBefore(top_action_bar_container, document.body.firstChild);
        } else {
            app_container.insertBefore(top_action_bar_container, app_container.firstChild);
        }
    }

    if (!bottom_action_bar_container) {
        consoleManager.warn('[Main.js] Bottom action bar container not found. Creating fallback container.');
        bottom_action_bar_container = document.createElement('div');
        bottom_action_bar_container.id = 'global-action-bar-bottom';
        bottom_action_bar_container.style.cssText = 'position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000; background: #f8f9fa; border-top: 1px solid #dee2e6;';

        if (app_wrapper) {
            app_wrapper.appendChild(bottom_action_bar_container);
        } else if (document.body) {
            document.body.appendChild(bottom_action_bar_container);
        } else {
            app_container.appendChild(bottom_action_bar_container);
        }
    }

    if (!document.getElementById('app-container') || !document.getElementById('global-action-bar-top') || !document.getElementById('global-action-bar-bottom')) {
        consoleManager.warn('[Main.js] Some core containers were missing and fallback versions were created. Check HTML structure.');
    }

    return {
        app_wrapper,
        app_container,
        top_action_bar_container,
        bottom_action_bar_container
    };
}

/**
 * Bygger app-layout (sidomeny, main, högerspalt) om den saknas.
 * @param {object} refs - app_container, side_menu_root, main_view_root, right_sidebar_root (nycklar uppdateras)
 * @param {object} [opts]
 * @param {function} [opts.update_landmarks_and_skip_link]
 */
export function ensure_app_layout(refs, opts = {}) {
    const { app_container } = refs;
    const { update_landmarks_and_skip_link } = opts;
    if (!app_container) return;
    const existing_right_sidebar_root = document.getElementById('app-right-sidebar-root');
    if (document.getElementById('app-layout') && document.getElementById('app-main-view-root') && document.getElementById('app-side-menu-root') && existing_right_sidebar_root) {
        refs.side_menu_root = document.getElementById('app-side-menu-root');
        refs.main_view_root = document.getElementById('app-main-view-root');
        refs.right_sidebar_root = existing_right_sidebar_root;
        return;
    }

    app_container.innerHTML = '';

    const layout = document.createElement('div');
    layout.id = 'app-layout';
    layout.className = 'app-layout';

    refs.side_menu_root = document.createElement('div');
    refs.side_menu_root.id = 'app-side-menu-root';
    refs.side_menu_root.className = 'app-side-menu-root';

    refs.main_view_root = document.createElement('main');
    refs.main_view_root.id = 'app-main-view-root';
    refs.main_view_root.className = 'app-main-view-root main-wrapper';
    refs.main_view_root.setAttribute('tabindex', '-1');

    const right_sidebar = document.createElement('aside');
    right_sidebar.id = 'app-right-sidebar-root';
    right_sidebar.className = 'app-right-sidebar-root';
    refs.right_sidebar_root = right_sidebar;

    layout.appendChild(refs.side_menu_root);
    layout.appendChild(refs.main_view_root);
    layout.appendChild(right_sidebar);
    app_container.appendChild(layout);
    if (typeof update_landmarks_and_skip_link === 'function') {
        update_landmarks_and_skip_link();
    }
}

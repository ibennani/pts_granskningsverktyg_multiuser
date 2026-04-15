/**
 * DOM-upplösning för app-shell och layout (app-layout, huvudvy, sidomeny).
 */
import { consoleManager } from '../utils/console_manager.js';

const APP_MAIN_VIEW_CONTENT_ID = 'app-main-view-content';
const APP_MAIN_SHELL_ID = 'app-main-shell-root';
/**
 * När hypotetisk mittenkolumn i trespaltsläge understiger detta värde: växla till enspaltsläge med knappar.
 * Vid utväxling används en högre tröskel (LEAVE) så att samma viewport inte växlar fram och tillbaka
 * när #app-layout byter bredd (scrollbar, DOM-placering).
 */
const MIDDLE_COLUMN_COMPACT_ENTER_PX = 500;
const MIDDLE_COLUMN_COMPACT_LEAVE_PX = 530;
const APP_LAYOUT_COMPACT_CLASS = 'app-layout--compact';
const APP_MOBILE_NAV_ID = 'app-main-shell-nav';
const APP_MOBILE_MENU_TOGGLE_ID = 'app-mobile-menu-toggle';
const APP_MOBILE_FILTER_TOGGLE_ID = 'app-mobile-filter-toggle';
const APP_LAYOUT_FILTER_OPEN_CLASS = 'app-layout--filter-open';

function dispatch_close_compact_side_menu() {
    try {
        document.dispatchEvent(new CustomEvent('gv:close_side_menu'));
    } catch (e) {
        void e;
    }
}

function toggle_compact_filter_panel(layout) {
    const will_open = !layout.classList.contains(APP_LAYOUT_FILTER_OPEN_CLASS);
    if (will_open) {
        dispatch_close_compact_side_menu();
    }
    layout.classList.toggle(APP_LAYOUT_FILTER_OPEN_CLASS);
    
    const filter_btn = document.getElementById(APP_MOBILE_FILTER_TOGGLE_ID);
    if (filter_btn) {
        filter_btn.setAttribute('aria-expanded', will_open ? 'true' : 'false');
    }
}

const mobile_controls_controller = {
    layout: null,
    main_shell: null,
    right_sidebar: null,
    resize_observer: null,
    right_sidebar_observer: null,
    window_resize_handler: null
};

/**
 * Läser flex-gap för #app-layout (för beräkning av hypotetisk mittenbredd).
 * @param {HTMLElement} layout_el
 * @returns {number}
 */
function get_layout_gap_px(layout_el) {
    if (typeof getComputedStyle !== 'function') return 8;
    const s = getComputedStyle(layout_el);
    const raw = (s.gap || s.columnGap || '0').trim();
    const first = raw.split(/\s+/)[0] || '0';
    const n = parseFloat(first);
    if (!Number.isFinite(n)) return 8;
    if (first.endsWith('rem')) {
        const root_fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        return n * root_fs;
    }
    return n;
}

const LAYOUT_BREAKPOINT_NARROW_ENTER_PX = 850;
const LAYOUT_BREAKPOINT_NARROW_LEAVE_PX = 880;
const LAYOUT_BREAKPOINT_MEDIUM_ENTER_PX = 1200;
const LAYOUT_BREAKPOINT_MEDIUM_LEAVE_PX = 1230;

function get_layout_state(layout_el) {
    const w = window.innerWidth;
    const right = document.getElementById('app-right-sidebar-root');
    const has_right = Boolean(right && right.childElementCount > 0);

    const is_narrow = layout_el.classList.contains('app-layout--narrow');
    const is_medium = layout_el.classList.contains('app-layout--medium');

    const narrow_threshold = is_narrow ? LAYOUT_BREAKPOINT_NARROW_LEAVE_PX : LAYOUT_BREAKPOINT_NARROW_ENTER_PX;
    if (w < narrow_threshold) return 'narrow';

    // Om vi inte har någon högerspalt spelar medium-läget ingen roll (bara en nav-rad utan knappar skulle visas), 
    // så vi stannar i wide-läge om vi är bredare än narrow_threshold.
    if (!has_right) return 'wide';

    const medium_threshold = is_medium ? LAYOUT_BREAKPOINT_MEDIUM_LEAVE_PX : LAYOUT_BREAKPOINT_MEDIUM_ENTER_PX;
    if (w < medium_threshold) return 'medium';

    return 'wide';
}

function disconnect_mobile_layout_observers() {
    if (mobile_controls_controller.resize_observer) {
        try {
            mobile_controls_controller.resize_observer.disconnect();
        } catch (e) {
            void e;
        }
        mobile_controls_controller.resize_observer = null;
    }
    if (mobile_controls_controller.right_sidebar_observer) {
        try {
            mobile_controls_controller.right_sidebar_observer.disconnect();
        } catch (e) {
            void e;
        }
        mobile_controls_controller.right_sidebar_observer = null;
    }
    if (typeof window !== 'undefined' && mobile_controls_controller.window_resize_handler) {
        window.removeEventListener('resize', mobile_controls_controller.window_resize_handler);
        mobile_controls_controller.window_resize_handler = null;
    }
}

function sync_app_layout_compact_state() {
    const layout = mobile_controls_controller.layout || document.getElementById('app-layout');
    const main_shell = mobile_controls_controller.main_shell || document.getElementById(APP_MAIN_SHELL_ID);
    const right_sidebar = mobile_controls_controller.right_sidebar || document.getElementById('app-right-sidebar-root');
    if (!layout || !main_shell) return;

    const state = get_layout_state(layout);
    
    const was_narrow = layout.classList.contains('app-layout--narrow');
    const was_medium = layout.classList.contains('app-layout--medium');
    const current_state = was_narrow ? 'narrow' : (was_medium ? 'medium' : 'wide');

    if (state !== current_state) {
        layout.classList.remove('app-layout--compact', 'app-layout--narrow', 'app-layout--medium');
        if (state !== 'wide') {
            layout.classList.add(`app-layout--${state}`);
        }
        // Behåll compact för bakåtkompatibilitet
        if (state === 'narrow') {
            layout.classList.add('app-layout--compact');
        }

        try {
            document.dispatchEvent(new CustomEvent('gv:layout_compact_changed', { detail: { compact: state === 'narrow', state } }));
        } catch (e) {
            void e;
        }
    }

    ensure_mobile_controls_nav_dom(state, layout, main_shell, right_sidebar);
    sync_compact_dom_placement(state);
}

/**
 * I kompakt läge: sidomeny och högerspalt ligger i app-main-shell-root direkt under knappraden,
 * före main — samma kolumnbredd som huvudinnehållet. Vid bred layout: återställ syskon under #app-layout.
 * @param {boolean} compact
 */
function sync_compact_dom_placement(state) {
    const layout = document.getElementById('app-layout');
    const side = document.getElementById('app-side-menu-root');
    const main_shell = document.getElementById(APP_MAIN_SHELL_ID);
    const right = document.getElementById('app-right-sidebar-wrapper') || document.getElementById('app-right-sidebar-root');
    const main = document.getElementById('app-main-view-root');
    if (!layout || !side || !main_shell || !right || !main) return;

    const nav = document.getElementById(APP_MOBILE_NAV_ID);

    if (state === 'narrow') {
        // Wanted order in main_shell: nav, side, right, main
        if (nav && nav.parentNode !== main_shell) main_shell.insertBefore(nav, main_shell.firstChild);
        else if (nav && main_shell.firstChild !== nav) main_shell.insertBefore(nav, main_shell.firstChild);

        if (side.parentNode !== main_shell || side.nextElementSibling !== right) {
            main_shell.insertBefore(side, right);
        }
        if (right.parentNode !== main_shell || right.nextElementSibling !== main) {
            main_shell.insertBefore(right, main);
        }
        // side must be before right, right before main. Let's enforce relative positions:
        if (right.nextElementSibling !== main) main_shell.insertBefore(right, main);
        if (side.nextElementSibling !== right) main_shell.insertBefore(side, right);
        
    } else if (state === 'medium') {
        // Wanted: side in layout (before main_shell), right in main_shell (before main)
        if (side.parentNode !== layout || side.nextElementSibling !== main_shell) {
            layout.insertBefore(side, main_shell);
        }
        
        if (nav && nav.parentNode !== main_shell) main_shell.insertBefore(nav, main_shell.firstChild);
        else if (nav && main_shell.firstChild !== nav) main_shell.insertBefore(nav, main_shell.firstChild);

        if (right.parentNode !== main_shell || right.nextElementSibling !== main) {
            main_shell.insertBefore(right, main);
        }
    } else { // wide
        // Wanted: side in layout (before main_shell), right in layout (after main_shell)
        if (side.parentNode !== layout || side.nextElementSibling !== main_shell) {
            layout.insertBefore(side, main_shell);
        }
        if (right.parentNode !== layout || right.previousElementSibling !== main_shell) {
            layout.insertBefore(right, main_shell.nextSibling);
        }
    }
}

function is_layout_narrow_or_medium() {
    const layout = document.getElementById('app-layout');
    return Boolean(layout?.classList.contains('app-layout--narrow') || layout?.classList.contains('app-layout--medium'));
}

function remove_mobile_controls_nav_from_dom() {
    const nav = document.getElementById(APP_MOBILE_NAV_ID);
    if (nav && nav.parentNode) {
        nav.remove();
    }
}

function ensure_mobile_controls_nav_dom(state, layout, main_shell, right_sidebar) {
    if (!layout || !main_shell) return;

    if (state === 'wide') {
        layout.classList.remove(APP_LAYOUT_FILTER_OPEN_CLASS);
        remove_mobile_controls_nav_from_dom();
        return;
    }

    let nav = document.getElementById(APP_MOBILE_NAV_ID);
    if (!nav) {
        nav = document.createElement('nav');
        nav.id = APP_MOBILE_NAV_ID;
        nav.className = 'app-main-shell-nav';

        const menu_button = document.createElement('button');
        menu_button.id = APP_MOBILE_MENU_TOGGLE_ID;
        menu_button.type = 'button';
        menu_button.setAttribute('aria-expanded', 'false');
        menu_button.className = 'button button-default app-shell-toggle app-shell-toggle--menu';
        menu_button.addEventListener('click', () => {
            try {
                document.dispatchEvent(new CustomEvent('gv:toggle_side_menu'));
            } catch (e) {}
        });
        const menu_icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        menu_icon.setAttribute('viewBox', '0 0 24 24');
        menu_icon.setAttribute('aria-hidden', 'true');
        menu_icon.setAttribute('focusable', 'false');
        const menu_path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        menu_path.setAttribute('d', 'M4 6.5h16v2H4v-2zm0 4.5h16v2H4v-2zm0 4.5h16v2H4v-2z');
        menu_icon.appendChild(menu_path);
        const menu_text = document.createElement('span');
        menu_text.className = 'app-shell-toggle__text';
        menu_text.textContent = 'Meny';
        menu_button.appendChild(menu_icon);
        menu_button.appendChild(menu_text);

        const filter_button = document.createElement('button');
        filter_button.id = APP_MOBILE_FILTER_TOGGLE_ID;
        filter_button.type = 'button';
        filter_button.className = 'button button-default app-shell-toggle app-shell-toggle--filter';
        filter_button.addEventListener('click', () => {
            toggle_compact_filter_panel(layout);
        });
        const filter_icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        filter_icon.setAttribute('viewBox', '0 0 24 24');
        filter_icon.setAttribute('aria-hidden', 'true');
        filter_icon.setAttribute('focusable', 'false');
        const filter_path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        filter_path.setAttribute('d', 'M4 6h16v2H4V6zm3 5h10v2H7v-2zm3 5h4v2h-4v-2z');
        filter_icon.appendChild(filter_path);
        const filter_text = document.createElement('span');
        filter_text.className = 'app-shell-toggle__text';
        filter_text.textContent = 'Filter';
        filter_button.appendChild(filter_icon);
        filter_button.appendChild(filter_text);

        nav.appendChild(menu_button);
        nav.appendChild(filter_button);
    }

    // Visa/dölj filterknappen beroende på om filterkolumnen har innehåll.
    let filter_button = nav.querySelector(`#${CSS.escape(APP_MOBILE_FILTER_TOGGLE_ID)}`);
    const has_sidebar_content = Boolean(right_sidebar && right_sidebar.childElementCount > 0);
    if (has_sidebar_content) {
        if (!filter_button) {
            filter_button = document.createElement('button');
            filter_button.id = APP_MOBILE_FILTER_TOGGLE_ID;
            filter_button.type = 'button';
            filter_button.setAttribute('aria-expanded', layout.classList.contains(APP_LAYOUT_FILTER_OPEN_CLASS) ? 'true' : 'false');
            filter_button.className = 'button button-default app-shell-toggle app-shell-toggle--filter';
            filter_button.addEventListener('click', () => {
                toggle_compact_filter_panel(layout);
            });
            const filter_icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            filter_icon.setAttribute('viewBox', '0 0 24 24');
            filter_icon.setAttribute('aria-hidden', 'true');
            filter_icon.setAttribute('focusable', 'false');
            const filter_path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            filter_path.setAttribute('d', 'M4 6h16v2H4V6zm3 5h10v2H7v-2zm3 5h4v2h-4v-2z');
            filter_icon.appendChild(filter_path);
            const filter_text = document.createElement('span');
            filter_text.className = 'app-shell-toggle__text';
            filter_text.textContent = 'Filter';
            filter_button.appendChild(filter_icon);
            filter_button.appendChild(filter_text);
            nav.appendChild(filter_button);
        } else if (filter_button.parentNode !== nav) {
            nav.appendChild(filter_button);
        }
    } else if (filter_button) {
        layout.classList.remove(APP_LAYOUT_FILTER_OPEN_CLASS);
        filter_button.remove();
    }

    // Placera <nav> i app-main-shell-root på samma nivå som <main> (syskon).
    if (nav.parentNode !== main_shell) {
        main_shell.insertBefore(nav, main_shell.firstChild);
    }
}

function ensure_mobile_controls_controller_targets({ layout, main_shell, right_sidebar }) {
    disconnect_mobile_layout_observers();

    mobile_controls_controller.layout = layout || null;
    mobile_controls_controller.main_shell = main_shell || null;
    mobile_controls_controller.right_sidebar = right_sidebar || null;

    if (layout && typeof ResizeObserver !== 'undefined') {
        try {
            mobile_controls_controller.resize_observer = new ResizeObserver(() => {
                sync_app_layout_compact_state();
            });
            mobile_controls_controller.resize_observer.observe(layout);
        } catch (e) {
            mobile_controls_controller.resize_observer = null;
        }
    } else if (typeof window !== 'undefined') {
        const rh = () => sync_app_layout_compact_state();
        mobile_controls_controller.window_resize_handler = rh;
        window.addEventListener('resize', rh);
    }

    if (right_sidebar && typeof MutationObserver !== 'undefined') {
        try {
            mobile_controls_controller.right_sidebar_observer = new MutationObserver(() => {
                sync_app_layout_compact_state();
            });
            mobile_controls_controller.right_sidebar_observer.observe(right_sidebar, { childList: true, subtree: false });
        } catch (e) {
            mobile_controls_controller.right_sidebar_observer = null;
        }
    }

    sync_app_layout_compact_state();
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => sync_app_layout_compact_state());
    }
}

/** Ordning för globala notiser överst i värden (kritisk först, sedan vanlig). */
export const GLOBAL_MESSAGE_AREA_IDS_IN_ORDER = ['global-critical-message-area', 'global-message-area'];

/**
 * Rensar vyinnehåll i #app-main-view-content men lämnar kvar globala notiser (båda typerna).
 * @param {HTMLElement|null} host_el – #app-main-view-content
 */
export function clear_main_view_content_except_global_notifications(host_el) {
    if (!host_el) {
        return;
    }
    const preserve = new Set(GLOBAL_MESSAGE_AREA_IDS_IN_ORDER);
    for (const child of Array.from(host_el.children)) {
        if (child.id && preserve.has(child.id)) {
            continue;
        }
        child.remove();
    }
}

/**
 * Säkerställer att #app-main-view-content finns i main: all vy-HTML hamnar där.
 * Globala notiser ligger som första barn i värden (ovanför h1) så att innerHTML på värden
 * inte rensar dem när vyer byts.
 *
 * @param {HTMLElement|null} main_el – elementet #app-main-view-root
 * @returns {HTMLElement|null}
 */
export function ensure_main_view_content_host(main_el) {
    if (!main_el || main_el.id !== 'app-main-view-root') {
        return null;
    }
    let host = main_el.querySelector(`#${APP_MAIN_VIEW_CONTENT_ID}`);
    if (host) {
        for (const mid of [...GLOBAL_MESSAGE_AREA_IDS_IN_ORDER].reverse()) {
            const el = document.getElementById(mid);
            if (el && el.parentNode === main_el) {
                host.insertBefore(el, host.firstChild);
            }
        }
        return host;
    }
    host = document.createElement('div');
    host.id = APP_MAIN_VIEW_CONTENT_ID;
    host.className = 'app-main-view-content';
    const skip_ids = new Set([...GLOBAL_MESSAGE_AREA_IDS_IN_ORDER, APP_MAIN_VIEW_CONTENT_ID]);
    for (const mid of GLOBAL_MESSAGE_AREA_IDS_IN_ORDER) {
        const el = main_el.querySelector(`#${mid}`);
        if (el && el.parentNode === main_el) {
            host.appendChild(el);
        }
    }
    for (const child of Array.from(main_el.children)) {
        if (child.id && skip_ids.has(child.id)) {
            continue;
        }
        host.appendChild(child);
    }
    main_el.appendChild(host);
    return host;
}

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
    const existing_layout = document.getElementById('app-layout');
    const existing_right_sidebar_root = document.getElementById('app-right-sidebar-root');
    const existing_main_shell = document.getElementById(APP_MAIN_SHELL_ID);
    if (existing_layout && document.getElementById('app-main-view-root') && document.getElementById('app-side-menu-root') && existing_right_sidebar_root && existing_main_shell) {
        refs.side_menu_root = document.getElementById('app-side-menu-root');
        refs.main_view_root = document.getElementById('app-main-view-root');
        ensure_main_view_content_host(refs.main_view_root);
        refs.right_sidebar_root = existing_right_sidebar_root;
        ensure_mobile_controls_controller_targets({
            layout: existing_layout,
            main_shell: existing_main_shell,
            right_sidebar: existing_right_sidebar_root
        });
        return;
    }

    app_container.innerHTML = '';

    const layout = document.createElement('div');
    layout.id = 'app-layout';
    layout.className = 'app-layout';

    refs.side_menu_root = document.createElement('div');
    refs.side_menu_root.id = 'app-side-menu-root';
    refs.side_menu_root.className = 'app-side-menu-root';

    const main_shell = document.createElement('div');
    main_shell.id = APP_MAIN_SHELL_ID;
    main_shell.className = 'app-main-shell-root';

    refs.main_view_root = document.createElement('main');
    refs.main_view_root.id = 'app-main-view-root';
    refs.main_view_root.className = 'app-main-view-root main-wrapper';
    refs.main_view_root.setAttribute('tabindex', '-1');

    const main_view_content = document.createElement('div');
    main_view_content.id = APP_MAIN_VIEW_CONTENT_ID;
    main_view_content.className = 'app-main-view-content';
    refs.main_view_root.appendChild(main_view_content);

    const right_sidebar_wrapper = document.createElement('div');
    right_sidebar_wrapper.id = 'app-right-sidebar-wrapper';
    right_sidebar_wrapper.className = 'app-right-sidebar-wrapper';

    const right_sidebar_inner = document.createElement('div');
    right_sidebar_inner.className = 'app-right-sidebar-inner';

    const right_sidebar = document.createElement('aside');
    right_sidebar.id = 'app-right-sidebar-root';
    right_sidebar.className = 'app-right-sidebar-root';
    refs.right_sidebar_root = right_sidebar;

    right_sidebar_inner.appendChild(right_sidebar);
    right_sidebar_wrapper.appendChild(right_sidebar_inner);

    layout.appendChild(refs.side_menu_root);
    main_shell.appendChild(refs.main_view_root);
    layout.appendChild(main_shell);
    layout.appendChild(right_sidebar_wrapper);
    app_container.appendChild(layout);
    if (typeof update_landmarks_and_skip_link === 'function') {
        update_landmarks_and_skip_link();
    }

    ensure_mobile_controls_controller_targets({
        layout,
        main_shell,
        right_sidebar
    });
}

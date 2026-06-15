import { ensure_main_view_content_host } from '../logic/app_dom.js';

export function resolve_view_dom_host({ view_name, deps }) {
    const { ensure_app_layout, main_view_root, app_container } = deps || {};

    if (view_name !== 'login') {
        ensure_app_layout();
    }

    if (view_name === 'login') {
        document.body.classList.add('view-login');
        ensure_app_layout();
    } else {
        document.body.classList.remove('view-login');
    }

    if (view_name === 'ai_chat') {
        document.body.classList.add('view-ai-chat');
    } else {
        document.body.classList.remove('view-ai-chat');
    }

    // Efter ensure_app_layout uppdateras layout_refs i main — deps.main_view_root kan fortfarande vara
    // ögonblicksbilden från render_view_deps() före layout. Läs från DOM så vi inte sätter view_root till
    // #app-container och tömmer hela appen (tom sida).
    const resolved_main_view_root =
        (typeof document !== 'undefined' && document.getElementById('app-main-view-root')) || main_view_root;
    const resolved_app_container =
        (typeof document !== 'undefined' && document.getElementById('app-container')) || app_container;

    const view_root = resolved_main_view_root || resolved_app_container;

    /** Rot för vy-init: #app-main-view-content i <main> när layout finns, annars samma som view_root. */
    const view_init_root = view_root;

    if (resolved_main_view_root) {
        if (view_name === 'start') {
            resolved_main_view_root.classList.add('start-view-active');
        } else {
            resolved_main_view_root.classList.remove('start-view-active');
        }
        if (view_name === 'ai_chat') {
            resolved_main_view_root.classList.add('ai-chat-view-active');
        } else {
            resolved_main_view_root.classList.remove('ai-chat-view-active');
        }
    }

    const app_layout_el =
        typeof document !== 'undefined' ? document.querySelector('.app-layout') : null;
    if (app_layout_el) {
        if (view_name === 'ai_chat') {
            app_layout_el.classList.add('app-layout--ai-chat');
        } else {
            app_layout_el.classList.remove('app-layout--ai-chat');
        }
    }

    return { view_root, view_init_root, resolved_main_view_root, resolved_app_container };
}

export function resolve_skip_target({ view_root }) {
    if (!view_root) return null;
    return (view_root?.id === 'app-main-view-root' ? ensure_main_view_content_host(view_root) : null) || view_root;
}


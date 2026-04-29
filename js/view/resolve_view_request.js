import { consoleManager } from '../utils/console_manager.js';

export function resolve_view_request({ view_name_to_render, params_to_render, deps }) {
    const { getState, start_normal_session } = deps || {};

    let view_name_mut = view_name_to_render;
    let params_mut = { ...(params_to_render || {}) };

    if (view_name_mut === 'edit_rulefile_main') {
        view_name_mut = 'rulefile_sections';
        params_mut = { ...params_mut, section: 'general' };
    }

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

    return { view_name: view_name_mut, params: params_mut };
}


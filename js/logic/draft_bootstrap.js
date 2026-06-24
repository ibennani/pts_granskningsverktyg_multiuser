/**
 * Initiering av DraftManager och globala lyssnare för utkast.
 */
import { DraftManager } from '../draft_manager.js';
import { get_route_key_from_hash, get_scope_key_from_hash } from './router.js';
import { consoleManager } from '../utils/console_manager.js';

/**
 * @param {object} deps
 * @param {import('../draft_manager.js').DraftManager} deps.DraftManagerRef - samma som window.DraftManager
 * @param {object} deps.notificationComponent
 * @param {object} deps.render_ctx - current_view_name_rendered, current_view_params_rendered_json
 * @param {function} deps.main_view_root_provider
 * @param {function} deps.app_container_provider
 * @param {object} deps.listener_state - { draft_listeners_initialized: boolean, draft_is_composing: boolean } (muteras)
 */
export function init_draft_manager(deps) {
    const {
        notificationComponent,
        render_ctx,
        main_view_root_provider,
        app_container_provider,
        listener_state
    } = deps;

    DraftManager.init({
        getRouteKey: get_route_key_from_hash,
        getScopeKey: () => get_scope_key_from_hash({
            current_view_name_rendered: render_ctx.current_view_name_rendered,
            current_view_params_rendered_json: render_ctx.current_view_params_rendered_json
        }),
        rootProvider: () => main_view_root_provider() || app_container_provider(),
        restorePolicy: { max_auto_restore_age_ms: 2 * 60 * 60 * 1000 },
        onConflict: () => {
            if (notificationComponent?.show_global_message) {
                notificationComponent.show_global_message((window.Translation?.t && window.Translation.t('draft_updated_other_tab')) || 'Utkast uppdaterades i annan flik.', 'info');
            } else {
                consoleManager.warn('[Main.js] Draft conflict detected.');
            }
        }
    });

    if (listener_state.draft_listeners_initialized) return;
    listener_state.draft_listeners_initialized = true;

    function should_capture_draft_target(target) {
        if (!target) return false;
        if (target.closest && target.closest('[data-draft-ignore="true"]')) return false;
        if (target.getAttribute && target.getAttribute('data-draft-ignore') === 'true') return false;
        if (target.getAttribute && target.getAttribute('data-draft-sensitive') === 'true') return false;
        if (target.type === 'password' || target.type === 'file') return false;
        if (target.isContentEditable) return true;
        const tag = target.tagName ? target.tagName.toLowerCase() : '';
        return tag === 'input' || tag === 'textarea' || tag === 'select';
    }

    function handle_draft_event(event) {
        if (!DraftManager?.captureFieldChange) return;
        if (!event || !event.target) return;
        if (listener_state.draft_is_composing && event.type === 'input') return;
        const target = event.target;
        if (!should_capture_draft_target(target)) return;
        DraftManager.captureFieldChange(target);
    }

    document.addEventListener('input', handle_draft_event, true);
    document.addEventListener('change', handle_draft_event, true);
    document.addEventListener('compositionstart', () => {
        listener_state.draft_is_composing = true;
    }, true);
    document.addEventListener('compositionend', (event) => {
        listener_state.draft_is_composing = false;
        handle_draft_event(event);
    }, true);

    window.addEventListener('pagehide', () => DraftManager.flushNow('pagehide'));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) DraftManager.flushNow('visibilitychange');
    });
    window.addEventListener('beforeunload', () => DraftManager.flushNow('beforeunload'));
    window.addEventListener('storage', (event) => DraftManager.handleStorageEvent(event));
}

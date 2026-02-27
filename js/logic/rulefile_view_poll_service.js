// js/logic/rulefile_view_poll_service.js
// Pollar regelfilversion när användaren redigerar en regelfil. Uppdaterar state om annan enhet ändrat.
//
// Kräver ruleSetId i state (sätts vid redigering från audit-vyn). Vid redigering från lokal fil
// (Upload) finns ingen ruleSetId och polling körs inte.

import { get_rule_version, get_rule } from '../api/client.js';

const POLL_INTERVAL_MS = 3000;
const RULEFILE_VIEWS = new Set([
    'edit_rulefile_main',
    'rulefile_requirements',
    'rulefile_view_requirement',
    'rulefile_edit_requirement',
    'rulefile_add_requirement',
    'rulefile_metadata_edit',
    'rulefile_sections',
    'rulefile_sections_edit_general',
    'rulefile_sections_edit_page_types',
    'confirm_delete'
]);

function is_rulefile_view() {
    const view = typeof window !== 'undefined' && window.__gv_current_view_name;
    return view && RULEFILE_VIEWS.has(view);
}

export function init_rulefile_view_poll_service({ getState, dispatch, StoreActionTypes }) {
    if (typeof window === 'undefined') return null;

    let poll_timer = null;

    function stop_polling() {
        if (poll_timer) {
            clearTimeout(poll_timer);
            poll_timer = null;
        }
    }

    async function poll_once() {
        const state = getState();
        const rule_set_id = state?.ruleSetId;
        const is_rulefile_editing = state?.auditStatus === 'rulefile_editing';

        if (!is_rulefile_view() || !rule_set_id || !is_rulefile_editing) {
            poll_timer = setTimeout(poll_once, POLL_INTERVAL_MS);
            return;
        }

        try {
            const { version } = await get_rule_version(rule_set_id);
            const local_version = state?.ruleFileServerVersion ?? 0;
            if (version != null && version > local_version) {
                const rule_row = await get_rule(rule_set_id);
                let content = rule_row?.content;
                if (typeof content === 'string') {
                    try {
                        content = JSON.parse(content);
                    } catch {
                        content = null;
                    }
                }
                if (content && typeof content === 'object') {
                    dispatch({
                        type: StoreActionTypes.REPLACE_RULEFILE_FROM_REMOTE,
                        payload: {
                            ruleFileContent: content,
                            version: version
                        }
                    });
                    if (window.NotificationComponent?.show_global_message && window.Translation?.t) {
                        const msg = window.Translation.t('realtime_sync_rulefile_updated') || 'Regelfilen har uppdaterats av en annan enhet';
                        window.NotificationComponent.show_global_message(msg, 'info');
                    }
                }
            }
        } catch {
            /* tyst vid poll-fel */
        }

        poll_timer = setTimeout(poll_once, POLL_INTERVAL_MS);
    }

    function start() {
        stop_polling();
        poll_timer = setTimeout(poll_once, POLL_INTERVAL_MS);
    }

    start();

    return {
        disconnect() {
            stop_polling();
        }
    };
}

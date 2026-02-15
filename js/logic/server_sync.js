// js/logic/server_sync.js
// Debounced sync av state till server när auditId finns.

import { update_audit } from '../api/client.js';

let debounce_timer = null;
const DEBOUNCE_MS = 500;

function state_to_patch(state) {
    return {
        metadata: state.auditMetadata || {},
        status: state.auditStatus || 'not_started',
        samples: state.samples || []
    };
}

export function schedule_sync_to_server(state) {
    if (!state || !state.auditId) return;
    if (typeof window === 'undefined' || !window.__GV_CURRENT_USER_NAME__) return;

    if (debounce_timer) clearTimeout(debounce_timer);
    debounce_timer = setTimeout(async () => {
        debounce_timer = null;
        try {
            await update_audit(state.auditId, state_to_patch(state));
        } catch (err) {
            if (window.NotificationComponent?.show_global_message && window.Translation?.t) {
                window.NotificationComponent.show_global_message(
                    window.Translation.t('server_sync_error', { message: err.message }) || `Kunde inte spara till servern: ${err.message}`,
                    'error'
                );
            }
        }
    }, DEBOUNCE_MS);
}

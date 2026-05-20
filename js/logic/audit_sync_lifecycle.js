/**
 * Flush av granskningssynk vid pagehide / dold flik (samma mönster som DraftManager).
 */

import { flush_sync_to_server } from './server_sync.js';

let lifecycle_listeners_initialized = false;

/**
 * @param {{ getState: function(): object, dispatch: function(object): void }} options
 */
export function init_audit_sync_lifecycle(options) {
    const { getState, dispatch } = options || {};
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (lifecycle_listeners_initialized) return;
    if (typeof getState !== 'function' || typeof dispatch !== 'function') return;

    lifecycle_listeners_initialized = true;

    function flush_audit_sync_now(_reason) {
        void flush_sync_to_server(getState, dispatch).catch(() => {
            /* nätverksfel hanteras i audit_sync_service / connectivity_service */
        });
    }

    window.addEventListener('pagehide', () => flush_audit_sync_now('pagehide'));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flush_audit_sync_now('visibilitychange');
        }
    });
}

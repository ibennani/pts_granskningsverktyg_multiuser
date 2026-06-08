/**
 * Flush av granskningssynk vid pagehide / dold flik.
 * Synkron lokal sparning körs före keepalive-PATCH vid stängd flik.
 */

import { flush_sync_to_server } from './server_sync.js';
import { run_unload_persist_hooks } from './unload_persist_registry.js';
import { send_audit_sync_keepalive } from '../sync/audit_sync_unload.js';

let lifecycle_listeners_initialized = false;
let unload_keepalive_sent = false;

/**
 * @param {{ getState: function(): object, dispatch: function(object): void }} options
 */
export function init_audit_sync_lifecycle(options) {
    const { getState, dispatch } = options || {};
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (lifecycle_listeners_initialized) return;
    if (typeof getState !== 'function' || typeof dispatch !== 'function') return;

    lifecycle_listeners_initialized = true;

    window.addEventListener('pageshow', () => {
        unload_keepalive_sent = false;
    });

    function flush_on_tab_hidden() {
        run_unload_persist_hooks('visibilitychange');
        void flush_sync_to_server(getState, dispatch).catch(() => {
            /* nätverksfel hanteras i audit_sync_service / connectivity_service */
        });
    }

    function flush_on_page_unload(reason) {
        run_unload_persist_hooks(reason);
        if (!unload_keepalive_sent) {
            unload_keepalive_sent = true;
            send_audit_sync_keepalive(getState());
        }
        void flush_sync_to_server(getState, dispatch).catch(() => {
            /* backup om keepalive inte räcker */
        });
    }

    window.addEventListener('pagehide', () => flush_on_page_unload('pagehide'));
    window.addEventListener('beforeunload', () => flush_on_page_unload('beforeunload'));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flush_on_tab_hidden();
        }
    });
}

/** Endast för enhetstester. */
export function reset_audit_sync_lifecycle_for_testing() {
    lifecycle_listeners_initialized = false;
    unload_keepalive_sent = false;
}

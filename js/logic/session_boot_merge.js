// js/logic/session_boot_merge.js
// Vid cold start (ingen sessionStorage) men localStorage-backup: jämför med servern, högst version vinner.

import { load_audit_with_rule_file } from '../api/client.js';
import { sync_to_server_now } from './server_sync.js';
import { navigate_to_default_audit_view } from './audit_open_logic.js';

/**
 * Applicerar backup mot servern utan dialog. Kräver inloggning för serverhämtning när auditId finns.
 *
 * @param {Object} options
 * @param {{ state?: Object, restorePosition?: Object }|null} options.backup_entry
 * @param {function} options.dispatch
 * @param {function} options.getState
 * @param {Object} options.StoreActionTypes
 * @param {Object} [options.ValidationLogic]
 * @param {function(string, Object): void} options.router
 * @param {Object} [options.NotificationComponent]
 * @param {function(string, Object=): string} [options.t]
 * @param {function(string, Object=): void} [options.navigate_and_set_hash]
 * @param {function} [options.handle_hash_change]
 * @returns {Promise<{ applied: boolean }>}
 */
export async function apply_session_boot_merge_from_backup(options) {
    const {
        backup_entry,
        dispatch,
        getState,
        StoreActionTypes,
        ValidationLogic,
        router,
        NotificationComponent,
        t,
        navigate_and_set_hash,
        handle_hash_change
    } = options || {};

    if (!backup_entry || !dispatch || !getState || !StoreActionTypes || !router) {
        return { applied: false };
    }

    const local_state = backup_entry.state || backup_entry;
    const restore_position = backup_entry.restorePosition ?? null;
    const t_fn = typeof t === 'function' ? t : ((key) => key);

    function navigate_after_merge() {
        if (restore_position?.view && typeof navigate_and_set_hash === 'function') {
            try {
                window.__gv_restore_focus_info = restore_position.focusInfo || null;
                navigate_and_set_hash(restore_position.view, restore_position.params || {});
                if (typeof handle_hash_change === 'function') {
                    handle_hash_change();
                }
            } catch (_) {
                navigate_to_default_audit_view(getState(), router);
                if (typeof handle_hash_change === 'function') {
                    handle_hash_change();
                }
            }
        } else {
            navigate_to_default_audit_view(getState(), router);
            if (typeof handle_hash_change === 'function') {
                handle_hash_change();
            }
        }
    }

    if (!local_state.auditId) {
        await dispatch({
            type: StoreActionTypes.LOAD_AUDIT_FROM_FILE,
            payload: local_state
        });
        navigate_after_merge();
        return { applied: true };
    }

    try {
        const remote = await load_audit_with_rule_file(local_state.auditId);
        const validation = ValidationLogic?.validate_saved_audit_file?.(remote, { t: t_fn });

        if (!remote || !validation?.isValid) {
            if (NotificationComponent?.show_global_message) {
                NotificationComponent.show_global_message(
                    validation?.message || t_fn('error_invalid_saved_audit_file'),
                    'warning'
                );
            }
            await dispatch({
                type: StoreActionTypes.LOAD_AUDIT_FROM_FILE,
                payload: local_state
            });
            navigate_after_merge();
            return { applied: true };
        }

        const rv = Number(remote.version ?? 0);
        const lv = Number(local_state.version ?? 0);

        if (rv >= lv) {
            await dispatch({
                type: StoreActionTypes.REPLACE_STATE_FROM_REMOTE,
                payload: { ...remote, saveFileVersion: remote.saveFileVersion || '2.1.0' }
            });
        } else {
            await dispatch({
                type: StoreActionTypes.LOAD_AUDIT_FROM_FILE,
                payload: local_state
            });
            await sync_to_server_now(getState, dispatch);
        }
        navigate_after_merge();
        return { applied: true };
    } catch (err) {
        if (NotificationComponent?.show_global_message) {
            NotificationComponent.show_global_message(
                t_fn('boot_merge_fetch_failed_warning', { message: err?.message || '' }),
                'warning'
            );
        }
        await dispatch({
            type: StoreActionTypes.LOAD_AUDIT_FROM_FILE,
            payload: local_state
        });
        navigate_after_merge();
        return { applied: true };
    }
}

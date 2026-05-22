/**
 * @file Handlare för granskningsmetadata i audit-reducern.
 */

import { get_current_iso_datetime_utc } from './audit_reducer_time.js';
import {
    should_touch_last_local_change_at,
    with_last_local_change_at
} from '../logic/audit_sync_tracking.js';

export function reduce_update_metadata(current_state: any, action: any) {
    const payload = { ...(action.payload || {}) };
    const skip_internal_sync = action.payload?.skip_server_sync === true;
    delete payload.skip_server_sync;
    if (current_state.auditStatus === 'archived') {
        const keys = Object.keys(payload);
        if (keys.length !== 1 || keys[0] !== 'audit_edit_log') return current_state;
    }
    const merged = {
        ...current_state,
        auditMetadata: { ...current_state.auditMetadata, ...payload }
    };
    const may_bump_non_obs = !skip_internal_sync
        && current_state.auditStatus !== 'locked'
        && current_state.auditStatus !== 'archived';
    if (may_bump_non_obs) {
        const now_iso = get_current_iso_datetime_utc();
        merged.auditLastNonObservationActivityAt = now_iso;
        if (should_touch_last_local_change_at(current_state.auditStatus, { skip_internal_sync })) {
            return with_last_local_change_at(merged, now_iso);
        }
    }
    return merged;
}

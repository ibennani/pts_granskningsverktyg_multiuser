/**
 * @file Handlare för granskningsmetadata i audit-reducern.
 */

import { get_current_iso_datetime_utc } from './audit_reducer_time.js';
import {
    should_touch_last_local_change_at,
    with_last_local_change_at
} from '../logic/audit_sync_tracking.js';
import { with_last_in_progress_activity_in_metadata } from '../logic/audit_list_last_updated.js';

export function reduce_update_metadata(current_state: any, action: any) {
    const payload = { ...(action.payload || {}) };
    const skip_internal_sync = action.payload?.skip_server_sync === true;
    const clear_fresh_new_audit_metadata = action.payload?.clear_fresh_new_audit_metadata === true;
    delete payload.skip_server_sync;
    delete payload.skip_render;
    delete payload.same_user_tab_broadcast;
    delete payload.clear_fresh_new_audit_metadata;

    let start_time_update: string | null | undefined;
    if (Object.prototype.hasOwnProperty.call(payload, 'startTime')) {
        const raw_start = payload.startTime;
        delete payload.startTime;
        if (raw_start === null || raw_start === undefined || raw_start === '') {
            start_time_update = null;
        } else {
            start_time_update = String(raw_start);
        }
    }

    if (current_state.auditStatus === 'archived') {
        const keys = Object.keys(payload);
        if (start_time_update !== undefined) return current_state;
        if (keys.length !== 1 || keys[0] !== 'audit_edit_log') return current_state;
    }

    let audit_metadata = { ...current_state.auditMetadata, ...payload };
    if (start_time_update !== undefined) {
        if (start_time_update === null) {
            const { startTime: _removed, ...rest } = audit_metadata;
            audit_metadata = rest;
        } else {
            audit_metadata = { ...audit_metadata, startTime: start_time_update };
        }
    }

    const merged = {
        ...current_state,
        auditMetadata: audit_metadata,
        ...(start_time_update !== undefined ? { startTime: start_time_update } : {}),
        ...(clear_fresh_new_audit_metadata ? { freshNewAuditMetadata: false } : {})
    };
    const may_bump_non_obs = !skip_internal_sync
        && current_state.auditStatus !== 'locked'
        && current_state.auditStatus !== 'archived';
    if (may_bump_non_obs) {
        const now_iso = get_current_iso_datetime_utc();
        merged.auditLastNonObservationActivityAt = now_iso;
        merged.auditMetadata = with_last_in_progress_activity_in_metadata(merged.auditMetadata, now_iso);
        if (should_touch_last_local_change_at(current_state.auditStatus, { skip_internal_sync })) {
            return with_last_local_change_at(merged, now_iso);
        }
    }
    return merged;
}

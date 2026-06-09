/**
 * @file Handlare för granskningsstatus (låst, pågår, arkiverad m.m.) i audit-reducern.
 */

import * as AuditLogic from '../audit_logic.js';
import { get_current_iso_datetime_utc } from './audit_reducer_time.js';
import {
    should_touch_last_local_change_at,
    with_last_local_change_at
} from '../logic/audit_sync_tracking.js';
import {
    AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY,
    without_last_in_progress_activity_in_metadata
} from '../logic/audit_list_last_updated.js';

export function reduce_set_audit_status(current_state: any, action: any) {
    const newStatus = action.payload.status;
    let state_before_status_change = current_state;
    let frozen_last_updated = current_state.auditLastUpdatedAtFrozen ?? null;
    if (newStatus === 'locked' && current_state.auditStatus === 'in_progress') {
        if (current_state.deficiencyCounter === 1) {
            state_before_status_change = AuditLogic.assignSortedDeficiencyIdsOnLock(current_state);
        }
        state_before_status_change = AuditLogic.recalculateAuditTimes(state_before_status_change);
        if (!state_before_status_change.endTime) {
            state_before_status_change = { ...state_before_status_change, endTime: get_current_iso_datetime_utc() };
        }
        frozen_last_updated = AuditLogic.compute_audit_last_updated_live_timestamp(state_before_status_change);
    } else if (newStatus === 'in_progress' && current_state.auditStatus === 'locked') {
        state_before_status_change = AuditLogic.removeAllDeficiencyIds(current_state);
        state_before_status_change = { ...AuditLogic.recalculateAuditTimes(state_before_status_change), endTime: null };
        frozen_last_updated = null;
    } else if (newStatus === 'in_progress' && current_state.auditStatus === 'not_started') {
        state_before_status_change = AuditLogic.removeAllDeficiencyIds(current_state);
        state_before_status_change = AuditLogic.recalculateAuditTimes(state_before_status_change);
    } else if (newStatus === 'archived' && current_state.auditStatus === 'locked') {
        state_before_status_change = current_state;
        if (!frozen_last_updated) {
            frozen_last_updated = AuditLogic.compute_audit_last_updated_live_timestamp(state_before_status_change);
        }
    } else if (newStatus === 'locked' && current_state.auditStatus === 'archived') {
        state_before_status_change = current_state;
    }
    let audit_metadata = { ...(state_before_status_change.auditMetadata || {}) };
    if (
        frozen_last_updated
        && (
            (newStatus === 'locked' && current_state.auditStatus === 'in_progress')
            || (newStatus === 'archived' && current_state.auditStatus === 'locked')
        )
    ) {
        audit_metadata = {
            ...audit_metadata,
            [AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY]: frozen_last_updated
        };
    } else if (
        newStatus === 'in_progress'
        && (current_state.auditStatus === 'locked' || current_state.auditStatus === 'archived')
    ) {
        audit_metadata = without_last_in_progress_activity_in_metadata(audit_metadata);
    }
    const merged = {
        ...state_before_status_change,
        auditStatus: newStatus,
        auditMetadata: audit_metadata,
        auditLastUpdatedAtFrozen: frozen_last_updated
    };
    if (newStatus !== current_state.auditStatus && should_touch_last_local_change_at(current_state.auditStatus)) {
        return with_last_local_change_at(merged, get_current_iso_datetime_utc());
    }
    return merged;
}

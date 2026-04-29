// @ts-nocheck
/**
 * @file Handlare för granskningsstatus (låst, pågår, arkiverad m.m.) i audit-reducern.
 */

import * as AuditLogic from '../audit_logic.js';
import { get_current_iso_datetime_utc } from './audit_reducer_time.js';

export function reduce_set_audit_status(current_state, action) {
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
    } else if (newStatus === 'locked' && current_state.auditStatus === 'archived') {
        state_before_status_change = current_state;
    }
    return {
        ...state_before_status_change,
        auditStatus: newStatus,
        auditLastUpdatedAtFrozen: frozen_last_updated
    };
}

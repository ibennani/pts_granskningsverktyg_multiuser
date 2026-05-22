/**
 * @file Handlare för stickprov, utkast och väntande ändringar i audit-reducern.
 */

import * as AuditLogic from '../audit_logic.js';
import { get_current_iso_datetime_utc } from './audit_reducer_time.js';
import {
    should_touch_last_local_change_at,
    with_last_local_change_at
} from '../logic/audit_sync_tracking.js';

export function reduce_stage_sample_changes(current_state: any, action: any) {
    return { ...current_state, pendingSampleChanges: action.payload };
}

export function reduce_clear_staged_sample_changes(current_state: any) {
    return { ...current_state, pendingSampleChanges: null };
}

export function reduce_set_sample_edit_draft(current_state: any, action: any) {
    return { ...current_state, sampleEditDraft: action.payload };
}

export function reduce_clear_sample_edit_draft(current_state: any) {
    return { ...current_state, sampleEditDraft: null };
}

export function reduce_add_sample(current_state: any, action: any) {
    if (current_state.auditStatus === 'archived') return current_state;
    const new_sample_with_defaults = { sampleCategory: '', sampleType: '', ...action.payload };
    const out = {
        ...current_state,
        samples: [...current_state.samples, new_sample_with_defaults]
    };
    if (current_state.auditStatus !== 'locked') {
        const now_iso = get_current_iso_datetime_utc();
        out.auditLastNonObservationActivityAt = now_iso;
        if (should_touch_last_local_change_at(current_state.auditStatus)) {
            return with_last_local_change_at(out, now_iso);
        }
    }
    return out;
}

export function reduce_update_sample(current_state: any, action: any) {
    if (current_state.auditStatus === 'archived') return current_state;
    const base = {
        ...current_state,
        samples: current_state.samples.map((s: any) => s.id === action.payload.sampleId ? { ...s, ...action.payload.updatedSampleData } : s)
    };
    if (current_state.auditStatus !== 'locked') {
        const now_iso = get_current_iso_datetime_utc();
        base.auditLastNonObservationActivityAt = now_iso;
        if (should_touch_last_local_change_at(current_state.auditStatus)) {
            return with_last_local_change_at(base, now_iso);
        }
    }
    return base;
}

export function reduce_delete_sample(current_state: any, action: any) {
    if (current_state.auditStatus === 'archived') return current_state;
    const new_state = {
        ...current_state,
        samples: current_state.samples.filter((s: any) => s.id !== action.payload.sampleId)
    };
    if (current_state.auditStatus !== 'locked') {
        const now_iso = get_current_iso_datetime_utc();
        new_state.auditLastNonObservationActivityAt = now_iso;
        const with_ids = AuditLogic.updateIncrementalDeficiencyIds(new_state);
        if (should_touch_last_local_change_at(current_state.auditStatus)) {
            return with_last_local_change_at(with_ids, now_iso);
        }
        return with_ids;
    }
    return AuditLogic.updateIncrementalDeficiencyIds(new_state);
}

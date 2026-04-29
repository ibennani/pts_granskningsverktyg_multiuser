// @ts-nocheck
/**
 * @file Handlare för stickprov, utkast och väntande ändringar i audit-reducern.
 */

import * as AuditLogic from '../audit_logic.js';
import { get_current_iso_datetime_utc } from './audit_reducer_time.js';

export function reduce_stage_sample_changes(current_state, action) {
    return { ...current_state, pendingSampleChanges: action.payload };
}

export function reduce_clear_staged_sample_changes(current_state) {
    return { ...current_state, pendingSampleChanges: null };
}

export function reduce_set_sample_edit_draft(current_state, action) {
    return { ...current_state, sampleEditDraft: action.payload };
}

export function reduce_clear_sample_edit_draft(current_state) {
    return { ...current_state, sampleEditDraft: null };
}

export function reduce_add_sample(current_state, action) {
    if (current_state.auditStatus === 'archived') return current_state;
    const new_sample_with_defaults = { sampleCategory: '', sampleType: '', ...action.payload };
    const out = {
        ...current_state,
        samples: [...current_state.samples, new_sample_with_defaults]
    };
    if (current_state.auditStatus !== 'locked') {
        out.auditLastNonObservationActivityAt = get_current_iso_datetime_utc();
    }
    return out;
}

export function reduce_update_sample(current_state, action) {
    if (current_state.auditStatus === 'archived') return current_state;
    const base = {
        ...current_state,
        samples: current_state.samples.map(s => s.id === action.payload.sampleId ? { ...s, ...action.payload.updatedSampleData } : s)
    };
    if (current_state.auditStatus !== 'locked') {
        base.auditLastNonObservationActivityAt = get_current_iso_datetime_utc();
    }
    return base;
}

export function reduce_delete_sample(current_state, action) {
    if (current_state.auditStatus === 'archived') return current_state;
    const new_state = {
        ...current_state,
        samples: current_state.samples.filter(s => s.id !== action.payload.sampleId)
    };
    if (current_state.auditStatus !== 'locked') {
        new_state.auditLastNonObservationActivityAt = get_current_iso_datetime_utc();
    }
    return AuditLogic.updateIncrementalDeficiencyIds(new_state);
}

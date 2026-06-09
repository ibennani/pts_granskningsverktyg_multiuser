/**
 * @file Handlare för stickprov, utkast och väntande ändringar i audit-reducern.
 */

import * as AuditLogic from '../audit_logic.js';
import { get_current_iso_datetime_utc } from './audit_reducer_time.js';
import {
    should_touch_last_local_change_at,
    with_last_local_change_at
} from '../logic/audit_sync_tracking.js';

function sample_ids_match(left: unknown, right: unknown): boolean {
    return String(left ?? '') === String(right ?? '');
}

function apply_deficiency_ids_safe(state: Record<string, unknown>): Record<string, unknown> {
    try {
        return (AuditLogic.updateIncrementalDeficiencyIds(state) ?? state) as Record<string, unknown>;
    } catch {
        return state;
    }
}

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
    const target_id = action.payload?.sampleId;
    const base = {
        ...current_state,
        samples: current_state.samples.map((s: any) =>
            sample_ids_match(s.id, target_id) ? { ...s, ...action.payload.updatedSampleData } : s
        )
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
    const target_id = action.payload?.sampleId;
    if (target_id == null || target_id === '') return current_state;

    const next_samples = current_state.samples.filter((s: any) => !sample_ids_match(s.id, target_id));
    if (next_samples.length === current_state.samples.length) {
        return current_state;
    }

    const new_state = {
        ...current_state,
        samples: next_samples
    };
    const now_iso = get_current_iso_datetime_utc();
    if (current_state.auditStatus !== 'locked') {
        new_state.auditLastNonObservationActivityAt = now_iso;
    }
    const with_ids = apply_deficiency_ids_safe(new_state);
    if (current_state.auditStatus !== 'locked' && should_touch_last_local_change_at(current_state.auditStatus)) {
        return with_last_local_change_at(with_ids, now_iso);
    }
    return with_ids;
}

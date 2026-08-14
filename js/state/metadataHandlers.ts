/**
 * @file Handlare för granskningsmetadata i audit-reducern.
 */

import { get_current_iso_datetime_utc } from './audit_reducer_time.js';
import {
    should_touch_last_local_change_at,
    with_last_local_change_at
} from '../logic/audit_sync_tracking.js';
import { with_last_in_progress_activity_in_metadata } from '../logic/audit_list_last_updated.js';
import {
    clamp_audit_activity_to_end_date,
    total_clamp_count
} from '../logic/audit_clamp_activity_to_end_date.js';
import { has_audit_type_id } from '../../shared/audit/audit_type_metadata.js';

function resolve_effective_start_iso(state: { startTime?: string | null; auditMetadata?: { startTime?: string } }): string | null {
    const from_meta = state.auditMetadata?.startTime;
    if (typeof from_meta === 'string' && from_meta.trim()) {
        return from_meta.trim();
    }
    if (typeof state.startTime === 'string' && state.startTime.trim()) {
        return state.startTime.trim();
    }
    return null;
}

function end_date_is_before_start(end_iso: string, start_iso: string | null): boolean {
    if (!start_iso) return false;
    return end_iso.slice(0, 10) < start_iso.slice(0, 10);
}

export function reduce_update_metadata(current_state: any, action: any) {
    const payload = { ...(action.payload || {}) };
    const skip_internal_sync = action.payload?.skip_server_sync === true;
    const clear_fresh_new_audit_metadata = action.payload?.clear_fresh_new_audit_metadata === true;
    const preserve_fresh_new_audit_metadata = action.payload?.preserve_fresh_new_audit_metadata === true;
    delete payload.skip_server_sync;
    delete payload.skip_render;
    delete payload.same_user_tab_broadcast;
    delete payload.clear_fresh_new_audit_metadata;
    delete payload.preserve_fresh_new_audit_metadata;
    delete payload.samples_modified;

    let responsible_user_id_update: string | null | undefined;
    if (Object.prototype.hasOwnProperty.call(payload, 'responsibleUserId')) {
        const raw_id = payload.responsibleUserId;
        delete payload.responsibleUserId;
        if (raw_id === null || raw_id === undefined || raw_id === '') {
            responsible_user_id_update = null;
        } else {
            responsible_user_id_update = String(raw_id);
        }
    }

    if (
        current_state.auditStatus === 'archived'
        || has_audit_type_id(current_state.auditMetadata)
    ) {
        delete payload.auditTypeId;
        delete payload.auditTypeLabel;
    }

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

    let end_time_update: string | null | undefined;
    if (Object.prototype.hasOwnProperty.call(payload, 'endTime')) {
        const raw_end = payload.endTime;
        delete payload.endTime;
        if (raw_end === null || raw_end === undefined || raw_end === '') {
            end_time_update = null;
        } else {
            end_time_update = String(raw_end);
        }
    }

    if (current_state.auditStatus === 'archived') {
        const keys = Object.keys(payload);
        if (start_time_update !== undefined || end_time_update !== undefined) return current_state;
        if (keys.length !== 1 || keys[0] !== 'audit_edit_log') return current_state;
    }

    if (end_time_update !== undefined && current_state.auditStatus !== 'locked') {
        end_time_update = undefined;
    }

    if (end_time_update !== undefined && end_time_update !== null) {
        const start_iso = resolve_effective_start_iso(current_state);
        if (end_date_is_before_start(end_time_update, start_iso)) {
            return current_state;
        }
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

    if (end_time_update !== undefined) {
        if (end_time_update === null) {
            const { endTime: _removed_end, ...rest } = audit_metadata;
            audit_metadata = rest;
        } else {
            audit_metadata = { ...audit_metadata, endTime: end_time_update };
        }
    }

    let merged = {
        ...current_state,
        auditMetadata: audit_metadata,
        ...(start_time_update !== undefined ? { startTime: start_time_update } : {}),
        ...(end_time_update !== undefined ? { endTime: end_time_update } : {}),
        ...(responsible_user_id_update !== undefined ? { responsibleUserId: responsible_user_id_update } : {}),
        ...(
            clear_fresh_new_audit_metadata
            || (current_state.freshNewAuditMetadata === true && !preserve_fresh_new_audit_metadata)
                ? { freshNewAuditMetadata: false }
                : {}
        )
    };

    if (end_time_update !== undefined && end_time_update !== null && current_state.auditStatus === 'locked') {
        const clamp_result = clamp_audit_activity_to_end_date(merged, end_time_update);
        merged = clamp_result.state;
        merged.auditMetadata = {
            ...merged.auditMetadata,
            endTime: end_time_update
        };
        merged.endTime = end_time_update;
        if (total_clamp_count(clamp_result.adjusted_counts) > 0) {
            action.payload = { ...(action.payload || {}), samples_modified: true };
        }
    }

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

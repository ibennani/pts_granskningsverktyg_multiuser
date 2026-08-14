/**
 * @file Handlare för per-användare resume-position i granskningsmetadata.
 */

import {
    build_resume_metadata_patch,
    normalize_resume_user_key
} from '../logic/audit_user_requirement_resume.js';
import { with_last_in_progress_activity_in_metadata } from '../logic/audit_list_last_updated.js';
import { get_current_iso_datetime_utc } from './audit_reducer_time.js';

export function reduce_update_user_requirement_resume(current_state: Record<string, unknown>, action: { payload?: Record<string, unknown> }) {
    if (current_state.auditStatus !== 'in_progress') {
        return current_state;
    }

    const payload = action.payload || {};
    const user_ref = String(payload.userId || payload.userName || '').trim();
    const sample_id = String(payload.sampleId || '').trim();
    const requirement_id = String(payload.requirementId || '').trim();
    const focus_info = payload.focusInfo;

    if (!normalize_resume_user_key(user_ref) || !sample_id || !requirement_id) {
        return current_state;
    }
    if (!focus_info || typeof focus_info !== 'object' || Array.isArray(focus_info)) {
        return current_state;
    }

    const updated_at_iso = typeof payload.updatedAtIso === 'string' ? payload.updatedAtIso : get_current_iso_datetime_utc();
    const audit_metadata = build_resume_metadata_patch(
        current_state.auditMetadata as Record<string, unknown> | undefined,
        user_ref,
        sample_id,
        requirement_id,
        focus_info as Record<string, unknown>,
        updated_at_iso,
        String(payload.displayUserName || payload.userName || '').trim()
    );

    const now_iso = get_current_iso_datetime_utc();
    return {
        ...current_state,
        auditMetadata: with_last_in_progress_activity_in_metadata(audit_metadata, now_iso)
    };
}

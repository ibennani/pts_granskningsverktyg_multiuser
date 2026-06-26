/**
 * @fileoverview Justerar bedömningstidsstämplar som ligger efter manuellt slutdatum.
 */

import { get_end_of_stockholm_calendar_day_iso } from '../../shared/datetime/filename_datetime.js';
import {
    traverse_all_check_results,
    traverse_all_pass_criteria,
    traverse_all_requirement_results
} from '../utils/traverse_audit_data.js';
import type { AuditStateShape } from './audit_logic_types.js';
import { AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY } from './audit_list_last_updated.js';

export type EndDateClampCounts = {
    click_count: number;
    requirement_count: number;
    frozen_count: number;
};

export type EndDateClampResult = {
    state: AuditStateShape;
    adjusted_counts: EndDateClampCounts;
};

function empty_counts(): EndDateClampCounts {
    return { click_count: 0, requirement_count: 0, frozen_count: 0 };
}

export function get_end_of_stockholm_calendar_day_iso_from_date(iso_date: string): string {
    return get_end_of_stockholm_calendar_day_iso(iso_date);
}

export function is_timestamp_after_end_date(timestamp: string, end_date_iso: string): boolean {
    if (!timestamp || typeof timestamp !== 'string') {
        return false;
    }
    const boundary = get_end_of_stockholm_calendar_day_iso(end_date_iso);
    return timestamp > boundary;
}

function resolve_clamp_target_iso(end_date_iso: string): string {
    return get_end_of_stockholm_calendar_day_iso(end_date_iso);
}

export function count_timestamps_after_end_date(
    state: AuditStateShape | null | undefined,
    end_date_iso: string
): EndDateClampCounts {
    const counts = empty_counts();
    if (!state || !end_date_iso) {
        return counts;
    }

    traverse_all_check_results(state, ({ check_result }) => {
        const ts = check_result.timestamp;
        if (typeof ts === 'string' && is_timestamp_after_end_date(ts, end_date_iso)) {
            counts.click_count += 1;
        }
    });

    traverse_all_pass_criteria(state, ({ pc_result }) => {
        const ts = pc_result.timestamp;
        if (typeof ts === 'string' && is_timestamp_after_end_date(ts, end_date_iso)) {
            counts.click_count += 1;
        }
    });

    traverse_all_requirement_results(state, ({ req_result }) => {
        const ts = req_result.lastStatusUpdate;
        if (typeof ts === 'string' && is_timestamp_after_end_date(ts, end_date_iso)) {
            counts.requirement_count += 1;
        }
    });

    const metadata = (state.auditMetadata ?? {}) as Record<string, unknown>;
    const frozen_meta = metadata[AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY];
    if (typeof frozen_meta === 'string' && is_timestamp_after_end_date(frozen_meta, end_date_iso)) {
        counts.frozen_count += 1;
    }
    if (
        typeof state.auditLastUpdatedAtFrozen === 'string'
        && is_timestamp_after_end_date(state.auditLastUpdatedAtFrozen, end_date_iso)
    ) {
        counts.frozen_count += 1;
    }

    return counts;
}

export function clamp_audit_activity_to_end_date(
    state: AuditStateShape,
    end_date_iso: string
): EndDateClampResult {
    const adjusted_counts = empty_counts();
    if (!end_date_iso) {
        return { state, adjusted_counts };
    }

    const next = JSON.parse(JSON.stringify(state)) as AuditStateShape;
    const clamp_iso = resolve_clamp_target_iso(end_date_iso);

    traverse_all_check_results(next, ({ check_result }) => {
        const ts = check_result.timestamp;
        if (typeof ts === 'string' && is_timestamp_after_end_date(ts, end_date_iso)) {
            check_result.timestamp = clamp_iso;
            adjusted_counts.click_count += 1;
        }
    });

    traverse_all_pass_criteria(next, ({ pc_result }) => {
        const ts = pc_result.timestamp;
        if (typeof ts === 'string' && is_timestamp_after_end_date(ts, end_date_iso)) {
            pc_result.timestamp = clamp_iso;
            adjusted_counts.click_count += 1;
        }
    });

    traverse_all_requirement_results(next, ({ req_result }) => {
        const ts = req_result.lastStatusUpdate;
        if (typeof ts === 'string' && is_timestamp_after_end_date(ts, end_date_iso)) {
            req_result.lastStatusUpdate = clamp_iso;
            adjusted_counts.requirement_count += 1;
        }
    });

    const metadata = { ...(next.auditMetadata ?? {}) } as Record<string, unknown>;
    let metadata_changed = false;
    const frozen_meta = metadata[AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY];
    if (typeof frozen_meta === 'string' && is_timestamp_after_end_date(frozen_meta, end_date_iso)) {
        metadata[AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY] = clamp_iso;
        adjusted_counts.frozen_count += 1;
        metadata_changed = true;
    }
    if (
        typeof next.auditLastUpdatedAtFrozen === 'string'
        && is_timestamp_after_end_date(next.auditLastUpdatedAtFrozen, end_date_iso)
    ) {
        next.auditLastUpdatedAtFrozen = clamp_iso;
        adjusted_counts.frozen_count += 1;
    }
    if (metadata_changed) {
        next.auditMetadata = metadata;
    }

    return { state: next, adjusted_counts };
}

export function total_clamp_count(counts: EndDateClampCounts): number {
    return counts.click_count + counts.requirement_count + counts.frozen_count;
}

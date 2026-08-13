/**
 * @fileoverview Innehållstyper för återkommande granskningsdelar via sidrapportsanalys.
 */
import { fetch_snapshot_analysis_summary } from '../api/audit_snapshot_api.js';
import { get_default_content_type_ids } from '../../shared/rulefile/content_type_defaults.js';
import {
    extract_detected_content_type_ids_from_summary,
    merge_bulk_import_content_type_ids,
} from './bulk_import_content_types.js';

function intersect_id_lists(lists: string[][]): string[] {
    if (lists.length === 0) return [];
    let intersection = [...lists[0]];
    for (let i = 1; i < lists.length; i += 1) {
        const set = new Set(lists[i]);
        intersection = intersection.filter((id) => set.has(id));
    }
    return intersection;
}

/**
 * Samma metod som URL-granskningsdelar: analysis-summary per evidens-sidrapporter,
 * sedan sammanslagning med förvalda innehållstyper från regelfilen.
 */
export async function resolve_recurring_sample_content_type_ids(
    audit_id: string,
    metadata: unknown,
    capture_ids: string[] | undefined
): Promise<string[]> {
    const selected_ids = get_default_content_type_ids(metadata);
    const capture_list = (capture_ids ?? []).map((id) => String(id).trim()).filter(Boolean);
    if (capture_list.length === 0) {
        return selected_ids;
    }

    const merged_per_capture: string[][] = [];
    for (const capture_id of capture_list) {
        const summary = await fetch_snapshot_analysis_summary(audit_id, capture_id);
        const detected = extract_detected_content_type_ids_from_summary(summary);
        merged_per_capture.push(merge_bulk_import_content_type_ids(selected_ids, detected));
    }

    const intersection = intersect_id_lists(merged_per_capture);
    if (intersection.length > 0) {
        return intersection;
    }

    return merged_per_capture[0] ?? selected_ids;
}

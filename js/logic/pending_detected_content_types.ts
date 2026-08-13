/**
 * @fileoverview Pending innehållstyper under pågående granskning (add-only).
 */

export type SampleWithContentTypes = {
    id?: string;
    selectedContentTypes?: string[];
    requirementResults?: Record<string, unknown>;
};

export function sample_has_reviewed_requirements(sample: SampleWithContentTypes): boolean {
    const results = sample.requirementResults;
    if (!results || typeof results !== 'object') return false;
    return Object.values(results).some((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const status = String((entry as { status?: string }).status || '');
        return status && status !== 'not_audited';
    });
}

export function compute_new_detected_content_type_ids(
    existing_selected: string[] | undefined,
    detected_ids: string[]
): string[] {
    const existing = new Set((existing_selected || []).map((id) => String(id)));
    return detected_ids
        .map((id) => String(id))
        .filter((id) => id && !existing.has(id));
}

export function should_queue_pending_detected_content_types(
    audit_status: string | undefined,
    sample: SampleWithContentTypes,
    detected_ids: string[]
): boolean {
    if (audit_status !== 'in_progress') return false;
    if (!sample_has_reviewed_requirements(sample)) return false;
    return compute_new_detected_content_type_ids(sample.selectedContentTypes, detected_ids).length > 0;
}

export function merge_pending_detected_content_types(
    current_pending: string[] | undefined,
    new_ids: string[]
): string[] {
    const merged = new Set((current_pending || []).map((id) => String(id)));
    for (const id of new_ids) {
        if (id) merged.add(String(id));
    }
    return [...merged];
}

export function apply_accepted_pending_content_types(
    selected: string[] | undefined,
    pending: string[] | undefined,
    accepted_ids: string[]
): { selectedContentTypes: string[]; pendingDetectedContentTypes: string[] } {
    const accepted = new Set(accepted_ids.map((id) => String(id)));
    const next_selected = new Set((selected || []).map((id) => String(id)));
    for (const id of accepted) {
        if (id) next_selected.add(id);
    }
    const next_pending = (pending || []).filter((id) => !accepted.has(String(id)));
    return {
        selectedContentTypes: [...next_selected],
        pendingDetectedContentTypes: next_pending,
    };
}

export function dismiss_pending_detected_content_types(
    pending: string[] | undefined,
    dismissed_ids: string[]
): string[] {
    const dismissed = new Set(dismissed_ids.map((id) => String(id)));
    return (pending || []).filter((id) => !dismissed.has(String(id)));
}

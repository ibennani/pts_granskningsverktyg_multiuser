/**
 * @fileoverview Synkar förberedda granskningar (not_started utan auditId) till servern
 * innan användaren navigerar till granskningslistan.
 */

import { sync_to_server_now } from '../sync/audit_sync_service.js';

type AuditMetadataLike = {
    actorName?: string;
    auditorName?: string;
};

type PreparedAuditStateLike = {
    auditId?: string | null;
    auditStatus?: string;
    ruleFileContent?: unknown;
    auditMetadata?: AuditMetadataLike;
};

type DispatchFn = (action: { type: string; payload?: Record<string, unknown> }) => void;

const LIST_VIEW_NAMES = new Set(['start', 'audit', 'audit_audits']);

function field_has_value(value: unknown): boolean {
    return value !== null && value !== undefined && String(value).trim() !== '';
}

/**
 * Obligatoriska metadatafält för att en förberedd granskning ska kunna visas i listan.
 */
export function has_required_audit_metadata(metadata: AuditMetadataLike | null | undefined): boolean {
    return field_has_value(metadata?.actorName) && field_has_value(metadata?.auditorName);
}

/**
 * Avgör om en lokal ny granskning ska skapas på servern innan listvyn visas.
 */
export function should_sync_prepared_audit_to_list(
    state: PreparedAuditStateLike | null | undefined,
    target_view_name: string | null | undefined
): boolean {
    if (!state?.ruleFileContent) return false;
    if (!target_view_name || !LIST_VIEW_NAMES.has(target_view_name)) return false;
    if (state.auditStatus !== 'not_started') return false;
    if (state.auditId) return false;
    return has_required_audit_metadata(state.auditMetadata);
}

/**
 * Skapar förberedd granskning på servern om villkoren ovan är uppfyllda.
 */
export async function sync_prepared_audit_before_list_navigation(
    get_state_fn: () => PreparedAuditStateLike | null | undefined,
    dispatch_fn: DispatchFn,
    target_view_name: string | null | undefined
): Promise<void> {
    const state = typeof get_state_fn === 'function' ? get_state_fn() : null;
    if (!should_sync_prepared_audit_to_list(state, target_view_name)) return;
    await sync_to_server_now(get_state_fn, dispatch_fn);
}

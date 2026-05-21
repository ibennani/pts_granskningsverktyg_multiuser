/**
 * @fileoverview Spårning av lokala granskningsändringar vs serversynk (metadata + jämförelse vid boot-merge).
 */

export type AuditStateLike = {
    auditMetadata?: Record<string, unknown>;
    samples?: Array<{
        requirementResults?: Record<string, { lastStatusUpdate?: string | null }>;
    }>;
};

/**
 * Senaste ISO-tidsstämpel från kravresultat i stickprov (lastStatusUpdate).
 */
export function get_latest_requirement_status_update_iso(state: AuditStateLike | null | undefined): string | null {
    if (!state?.samples?.length) return null;
    let latest: string | null = null;
    for (const sample of state.samples) {
        const results = sample.requirementResults;
        if (!results || typeof results !== 'object') continue;
        for (const key of Object.keys(results)) {
            const ts = results[key]?.lastStatusUpdate;
            if (typeof ts === 'string' && ts && (!latest || ts > latest)) {
                latest = ts;
            }
        }
    }
    return latest;
}

/**
 * Om lokalt state ska skrivas över server (synk, boot-merge, 409-retry).
 * Versionsnummer ensamt räcker inte — äldre innehåll med högre version ska inte vinna.
 */
export function should_push_local_audit_to_server(
    local_state: AuditStateLike | null | undefined,
    remote_state: AuditStateLike | null | undefined
): boolean {
    if (!local_state || !remote_state) return false;
    return is_local_audit_content_newer_than(local_state, remote_state);
}

/**
 * Om lokalt state har nyare granskningsinnehåll än remote (vid samma versionsnummer).
 */
export function is_local_audit_content_newer_than(
    local_state: AuditStateLike | null | undefined,
    remote_state: AuditStateLike | null | undefined
): boolean {
    const local_meta = local_state?.auditMetadata;
    const remote_meta = remote_state?.auditMetadata;
    const local_ts =
        (typeof local_meta?.last_local_change_at === 'string' && local_meta.last_local_change_at) ||
        get_latest_requirement_status_update_iso(local_state);
    const remote_ts =
        (typeof remote_meta?.last_server_sync_at === 'string' && remote_meta.last_server_sync_at) ||
        get_latest_requirement_status_update_iso(remote_state);

    if (!local_ts) return false;
    if (!remote_ts) return true;
    return local_ts > remote_ts;
}

/**
 * Om det finns osparade lokala ändringar jämfört med senaste lyckade serversynk.
 */
export function has_unsynced_local_audit_changes(state: AuditStateLike | null | undefined): boolean {
    if (!state) return false;
    const meta = state.auditMetadata;
    const local_at =
        (typeof meta?.last_local_change_at === 'string' && meta.last_local_change_at) ||
        get_latest_requirement_status_update_iso(state);
    const server_at = typeof meta?.last_server_sync_at === 'string' ? meta.last_server_sync_at : null;
    if (!local_at) return false;
    if (!server_at) return true;
    return local_at > server_at;
}

/**
 * Metadata-patch för last_local_change_at efter kravresultatändring.
 */
export function build_last_local_change_metadata_patch(
    requirement_result: { lastStatusUpdate?: string | null } | null | undefined,
    now_iso: string
): { last_local_change_at: string } {
    const ts =
        (typeof requirement_result?.lastStatusUpdate === 'string' && requirement_result.lastStatusUpdate) ||
        now_iso;
    return { last_local_change_at: ts };
}

/**
 * Metadata-patch när serversynk lyckats.
 */
export function build_last_server_sync_metadata_patch(now_iso: string): { last_server_sync_at: string } {
    return { last_server_sync_at: now_iso };
}

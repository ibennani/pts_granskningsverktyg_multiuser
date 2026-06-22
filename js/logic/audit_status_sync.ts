/**
 * @fileoverview Synkregler för granskningsstatus mellan flikar och server.
 */

export type AuditStatusValue = 'not_started' | 'in_progress' | 'locked' | 'archived';

const STATUS_RANK: Record<string, number> = {
    not_started: 0,
    in_progress: 1,
    locked: 2,
    archived: 3
};

/** Högre värde = mer «avslutad» status (låst/arkiverad vinner över pågår). */
export function audit_status_rank(status: string | undefined | null): number {
    if (!status) return 0;
    return STATUS_RANK[status] ?? 0;
}

/**
 * Serverns status ska vinna över lokal utan att skrivas tillbaka (t.ex. avslutad på annan flik).
 */
export function server_status_should_win_over_local(
    local_status: string | undefined | null,
    remote_status: string | undefined | null
): boolean {
    if (!remote_status || !local_status || remote_status === local_status) return false;
    return audit_status_rank(remote_status) > audit_status_rank(local_status);
}

/**
 * Om öppen granskning ska laddas om från servern (version eller status skiljer sig).
 */
export function should_reload_audit_from_server(
    local_status: string | undefined | null,
    remote_status: string | undefined | null,
    local_version: number,
    remote_version: number
): boolean {
    if (remote_version > local_version) return true;
    if (
        remote_version === local_version
        && remote_status
        && local_status
        && remote_status !== local_status
    ) {
        return true;
    }
    return false;
}

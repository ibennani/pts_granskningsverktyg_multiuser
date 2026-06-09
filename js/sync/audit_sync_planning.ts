/**
 * @fileoverview Planering av audit-serversynk: regelfil-fingeravtryck och enstaka kravresultat.
 */

export type AuditSyncStrategy =
    | { mode: 'full' }
    | { mode: 'single_requirement'; sample_id: string; requirement_id: string }
    | { mode: 'metadata_only' };

let rule_file_fingerprint_at_last_sync: string | null = null;
let force_full_sync = false;
let metadata_only_pending = false;
const pending_requirement_keys = new Set<string>();

function requirement_sync_key(sample_id: string, requirement_id: string): string {
    return `${String(sample_id)}\u0001${String(requirement_id)}`;
}

/**
 * Fingeravtryck av regelfil för att avgöra om den ska skickas med PATCH.
 */
export function fingerprint_rule_file_content(content: unknown): string | null {
    if (content === null || content === undefined) return null;
    try {
        return JSON.stringify(content);
    } catch {
        return null;
    }
}

export function mark_rule_file_synced_from_state(rule_file_content: unknown): void {
    rule_file_fingerprint_at_last_sync = fingerprint_rule_file_content(rule_file_content);
}

export function clear_rule_file_sync_baseline_for_testing(): void {
    rule_file_fingerprint_at_last_sync = null;
    force_full_sync = false;
    metadata_only_pending = false;
    pending_requirement_keys.clear();
}

export function reset_audit_sync_planning_after_remote_load(rule_file_content: unknown): void {
    mark_rule_file_synced_from_state(rule_file_content);
    force_full_sync = false;
    metadata_only_pending = false;
    pending_requirement_keys.clear();
}

export function note_audit_full_sync_required(): void {
    force_full_sync = true;
    metadata_only_pending = false;
    pending_requirement_keys.clear();
}

/** Om hel PATCH väntar (t.ex. borttaget stickprov) — används av synkförberedelse. */
export function is_force_full_sync_pending(): boolean {
    return force_full_sync;
}

export function note_metadata_only_changed(): void {
    if (force_full_sync) return;
    metadata_only_pending = true;
}

export function note_requirement_result_changed(sample_id: string, requirement_id: string): void {
    if (force_full_sync) return;
    metadata_only_pending = false;
    pending_requirement_keys.add(requirement_sync_key(sample_id, requirement_id));
}

/** Om ett visst kravresultat väntar på serversynk. */
export function is_requirement_pending_sync(sample_id: string, requirement_id: string): boolean {
    if (force_full_sync) return true;
    return pending_requirement_keys.has(requirement_sync_key(sample_id, requirement_id));
}

/** Full synk eller enbart metadata väntar — partiell push ska då inte appliceras. */
export function has_blocking_non_requirement_sync(): boolean {
    return force_full_sync || metadata_only_pending;
}

/** Om schemalagd synk har markerade ändringar (ej samma som peek som defaultar till full). */
export function has_pending_audit_sync_plan(): boolean {
    if (force_full_sync) return true;
    if (pending_requirement_keys.size > 0) return true;
    return metadata_only_pending;
}

export function should_include_rule_file_in_patch(rule_file_content: unknown): boolean {
    if (force_full_sync) return true;
    const fp = fingerprint_rule_file_content(rule_file_content);
    if (fp === null) return false;
    if (rule_file_fingerprint_at_last_sync === null) return true;
    return fp !== rule_file_fingerprint_at_last_sync;
}

export function resolve_audit_sync_strategy(): AuditSyncStrategy {
    if (force_full_sync) {
        force_full_sync = false;
        metadata_only_pending = false;
        pending_requirement_keys.clear();
        return { mode: 'full' };
    }
    if (pending_requirement_keys.size === 1) {
        const only_key = [...pending_requirement_keys][0];
        pending_requirement_keys.clear();
        metadata_only_pending = false;
        const sep = only_key.indexOf('\u0001');
        if (sep < 0) return { mode: 'full' };
        return {
            mode: 'single_requirement',
            sample_id: only_key.slice(0, sep),
            requirement_id: only_key.slice(sep + 1)
        };
    }
    if (metadata_only_pending && pending_requirement_keys.size === 0) {
        metadata_only_pending = false;
        return { mode: 'metadata_only' };
    }
    metadata_only_pending = false;
    pending_requirement_keys.clear();
    return { mode: 'full' };
}

/** Läser planerad synkstrategi utan att tömma köer (t.ex. keepalive vid pagehide). */
export function peek_audit_sync_strategy(): AuditSyncStrategy {
    if (force_full_sync) return { mode: 'full' };
    if (pending_requirement_keys.size === 1) {
        const only_key = [...pending_requirement_keys][0];
        const sep = only_key.indexOf('\u0001');
        if (sep < 0) return { mode: 'full' };
        return {
            mode: 'single_requirement',
            sample_id: only_key.slice(0, sep),
            requirement_id: only_key.slice(sep + 1)
        };
    }
    if (metadata_only_pending && pending_requirement_keys.size === 0) {
        return { mode: 'metadata_only' };
    }
    return { mode: 'full' };
}

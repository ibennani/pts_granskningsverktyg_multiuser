/**
 * @fileoverview Planering av audit-serversynk: regelfil-fingeravtryck och enstaka kravresultat.
 */

export type AuditSyncStrategy =
    | { mode: 'full' }
    | { mode: 'single_requirement'; sample_id: string; requirement_id: string };

let rule_file_fingerprint_at_last_sync: string | null = null;
let force_full_sync = false;
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
    pending_requirement_keys.clear();
}

export function reset_audit_sync_planning_after_remote_load(rule_file_content: unknown): void {
    mark_rule_file_synced_from_state(rule_file_content);
    force_full_sync = false;
    pending_requirement_keys.clear();
}

export function note_audit_full_sync_required(): void {
    force_full_sync = true;
    pending_requirement_keys.clear();
}

export function note_requirement_result_changed(sample_id: string, requirement_id: string): void {
    if (force_full_sync) return;
    pending_requirement_keys.add(requirement_sync_key(sample_id, requirement_id));
}

export function should_include_rule_file_in_patch(rule_file_content: unknown): boolean {
    if (force_full_sync) return true;
    const fp = fingerprint_rule_file_content(rule_file_content);
    if (fp === null) return false;
    if (rule_file_fingerprint_at_last_sync === null) return true;
    return fp !== rule_file_fingerprint_at_last_sync;
}

export function resolve_audit_sync_strategy(): AuditSyncStrategy {
    if (force_full_sync || pending_requirement_keys.size !== 1) {
        force_full_sync = false;
        pending_requirement_keys.clear();
        return { mode: 'full' };
    }
    const only_key = [...pending_requirement_keys][0];
    pending_requirement_keys.clear();
    force_full_sync = false;
    const sep = only_key.indexOf('\u0001');
    if (sep < 0) return { mode: 'full' };
    return {
        mode: 'single_requirement',
        sample_id: only_key.slice(0, sep),
        requirement_id: only_key.slice(sep + 1)
    };
}

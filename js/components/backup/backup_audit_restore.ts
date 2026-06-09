/**
 * Hjälpfunktioner för att återställa granskning från säkerhetskopia via import-API.
 */

import { import_audit, get_base_url, get_auth_headers } from '../../api/client.js';

export function build_audit_import_body(backup_data: any, audit_id?: string) {
    const body: Record<string, unknown> = {
        ruleFileContent: backup_data.ruleFileContent,
        auditMetadata: backup_data.auditMetadata || {},
        samples: backup_data.samples || [],
        auditStatus: backup_data.auditStatus || 'not_started',
        archivedRequirementResults: backup_data.archivedRequirementResults || [],
        lastRulefileUpdateLog: backup_data.lastRulefileUpdateLog ?? null
    };
    if (audit_id) body.auditId = audit_id;
    return body;
}

export async function fetch_backup_json_for_restore(audit_id: string, filename: string) {
    const base = get_base_url();
    const backup_url = `${base}/backup/files/${encodeURIComponent(audit_id)}/${encodeURIComponent(filename)}`;
    const res = await fetch(backup_url, { cache: 'no-store', headers: get_auth_headers() });
    if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error || res.statusText);
    }
    return res.json();
}

export function should_recreate_deleted_audit_on_restore(err: unknown) {
    const status = (err as { status?: number })?.status;
    const message = String((err as { message?: string })?.message || '');
    return status === 404
        || (status === 400 && message.includes('dubblett'))
        || message.includes('Granskning hittades inte');
}

export async function import_deleted_audit_from_backup(backup_data: any) {
    await import_audit(build_audit_import_body(backup_data));
}

export async function import_replace_audit_from_backup(audit_id: string, backup_data: any) {
    await import_audit(
        build_audit_import_body(backup_data, audit_id),
        { replace_existing_audit_id: audit_id }
    );
}

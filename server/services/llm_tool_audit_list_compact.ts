/**
 * @file Kompakt granskningslista för LLM-verktyg (undviker trunkering).
 */

type AuditMetadata = {
    title?: string;
    startTime?: string;
};

type AuditIndexRow = {
    id: string;
    rule_set_id?: string | null;
    status?: string;
    metadata?: AuditMetadata | null;
    rule_set_name?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

export type CompactAuditForLlm = {
    id: string;
    title: string;
    status: string | null;
    rule_set_id: string | null;
    rule_set_name: string | null;
    created_at: string | null;
    start_time: string | null;
    updated_at: string | null;
};

function effective_start_timestamp(row: CompactAuditForLlm): number {
    const raw = row.start_time || row.created_at;
    if (!raw) return Number.POSITIVE_INFINITY;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
}

export function compact_audit_row_from_index(row: AuditIndexRow): CompactAuditForLlm {
    const metadata = row.metadata || {};
    const meta_title = typeof metadata.title === 'string' ? metadata.title.trim() : '';
    const title = meta_title || (typeof row.rule_set_name === 'string' ? row.rule_set_name.trim() : '') || 'Namnlös granskning';
    const rule_set_name =
        typeof row.rule_set_name === 'string' && row.rule_set_name.trim() ? row.rule_set_name.trim() : null;
    return {
        id: row.id,
        title,
        status: row.status || null,
        rule_set_id: row.rule_set_id || null,
        rule_set_name,
        created_at: row.created_at || null,
        start_time: typeof metadata.startTime === 'string' ? metadata.startTime : null,
        updated_at: row.updated_at || null
    };
}

export function resolve_earliest_started_audit(rows: CompactAuditForLlm[]): CompactAuditForLlm | null {
    if (!rows.length) return null;
    return rows.reduce((earliest, row) =>
        effective_start_timestamp(row) < effective_start_timestamp(earliest) ? row : earliest
    );
}

export function build_audit_list_payload(rows: AuditIndexRow[]): {
    count: number;
    earliest_started: CompactAuditForLlm | null;
    audits: CompactAuditForLlm[];
} {
    const compact = rows.map(compact_audit_row_from_index);
    const audits = [...compact].sort((a, b) => effective_start_timestamp(a) - effective_start_timestamp(b));
    return {
        count: audits.length,
        earliest_started: resolve_earliest_started_audit(audits),
        audits
    };
}

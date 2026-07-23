/**
 * @fileoverview Grupperar granskningar per ärendenummer och väljer granskningstyp.
 */
import { normalize_media_kind, resolve_target_type_id_for_case } from './audit_media_kind.mjs';

/**
 * @param {Array<{ id: string, metadata: unknown, rule_file_content: unknown }>} audits
 * @returns {Map<string, { target_type_id: string, audit_ids: string[] }>}
 */
export function build_case_type_plan(audits) {
    /** @type {Map<string, { kinds: Array<'pdf' | 'webb' | null>, audit_ids: string[] }>} */
    const by_case = new Map();

    for (const row of audits) {
        const metadata = row.metadata && typeof row.metadata === 'object'
            ? row.metadata
            : {};
        const case_number = String(metadata.caseNumber ?? '').trim();
        if (!case_number) continue;

        const media = normalize_media_kind(row.rule_file_content);
        const bucket = by_case.get(case_number) ?? { kinds: [], audit_ids: [] };
        bucket.kinds.push(media);
        bucket.audit_ids.push(row.id);
        by_case.set(case_number, bucket);
    }

    /** @type {Map<string, { target_type_id: string, audit_ids: string[] }>} */
    const plan = new Map();
    for (const [case_number, bucket] of by_case.entries()) {
        const target_type_id = resolve_target_type_id_for_case(bucket.kinds);
        if (!target_type_id) continue;
        plan.set(case_number, { target_type_id, audit_ids: bucket.audit_ids });
    }
    return plan;
}

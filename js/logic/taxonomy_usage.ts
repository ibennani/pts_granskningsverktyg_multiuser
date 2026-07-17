/**
 * @fileoverview Kontrollerar om en taxonomi används i regelfilen.
 */
import { resolve_audit_types } from '../../shared/rulefile/rulefile_audit_types.js';
import { get_primary_grouping_taxonomy_id } from './requirement_classifications.js';

export type TaxonomyUsageBlockReason =
    | 'primary_grouping'
    | 'requirement_classifications'
    | 'audit_types'
    | 'appendix1_grouping'
    | 'appendix1_body_text';

export type TaxonomyUsageCheck = {
    can_delete: boolean;
    reasons: TaxonomyUsageBlockReason[];
};

function normalize_id(value: unknown): string {
    return String(value ?? '').trim();
}

function requirements_use_taxonomy(
    requirements: unknown,
    taxonomy_id: string
): boolean {
    if (!requirements || !taxonomy_id) return false;
    const normalized = taxonomy_id.toLowerCase();
    const rows = Array.isArray(requirements)
        ? requirements
        : Object.values(requirements as Record<string, unknown>);
    return rows.some((row) => {
        const classifications = (row as { classifications?: unknown[] })?.classifications;
        if (!Array.isArray(classifications)) return false;
        return classifications.some(
            (entry) => normalize_id((entry as { taxonomyId?: string })?.taxonomyId).toLowerCase() === normalized
        );
    });
}

export function get_taxonomy_usage_check(
    rule_file_content: Record<string, unknown>,
    taxonomy_id: string
): TaxonomyUsageCheck {
    const id = normalize_id(taxonomy_id);
    const reasons: TaxonomyUsageBlockReason[] = [];
    if (!id) {
        return { can_delete: false, reasons };
    }

    const metadata = (rule_file_content.metadata ?? {}) as Record<string, unknown>;
    const primary_id = normalize_id(get_primary_grouping_taxonomy_id(rule_file_content));
    if (primary_id && primary_id.toLowerCase() === id.toLowerCase()) {
        reasons.push('primary_grouping');
    }

    if (requirements_use_taxonomy(rule_file_content.requirements, id)) {
        reasons.push('requirement_classifications');
    }

    const audit_types = resolve_audit_types(metadata);
    if (audit_types.some((row) => normalize_id(row.taxonomyId).toLowerCase() === id.toLowerCase())) {
        reasons.push('audit_types');
    }

    const appendix1 = (metadata.appendix1 ?? rule_file_content.appendix1) as
        | Record<string, unknown>
        | undefined;
    if (appendix1) {
        const grouping = normalize_id(appendix1.groupingTaxonomyId);
        if (grouping && grouping.toLowerCase() === id.toLowerCase()) {
            reasons.push('appendix1_grouping');
        }
        const body_by_taxonomy = appendix1.bodyTextByTaxonomy as Record<string, unknown> | undefined;
        if (body_by_taxonomy && Object.prototype.hasOwnProperty.call(body_by_taxonomy, id)) {
            reasons.push('appendix1_body_text');
        }
    }

    return { can_delete: reasons.length === 0, reasons };
}

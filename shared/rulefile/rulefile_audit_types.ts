/**
 * @fileoverview Granskningstyper i regelfilsmetadata (koppling till taxonomi).
 */

export type RulefileAuditType = {
    id: string;
    label: string;
    taxonomyId: string;
};

function slug_from_label(label: string): string {
    return label
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '');
}

export const DEFAULT_AUDIT_TYPES: RulefileAuditType[] = [
    { id: 'tillsyn-lptt', label: 'Tillsyn LPTT', taxonomyId: 'wcag22-pour' },
    { id: 'marknadskontroll-lptt', label: 'Marknadskontroll LPTT', taxonomyId: 'wcag22-pour' },
];

export function resolve_audit_types(metadata: unknown): RulefileAuditType[] {
    const meta = metadata as { auditTypes?: unknown } | null;
    if (!meta || !Array.isArray(meta.auditTypes)) {
        return [];
    }
    return meta.auditTypes
        .map((entry) => {
            const row = entry as Record<string, unknown>;
            const label = typeof row.label === 'string' ? row.label.trim() : '';
            const taxonomyId = typeof row.taxonomyId === 'string' ? row.taxonomyId.trim() : '';
            let id = typeof row.id === 'string' ? row.id.trim() : '';
            if (!id && label) id = slug_from_label(label);
            if (!label || !taxonomyId || !id) return null;
            return { id, label, taxonomyId };
        })
        .filter((row): row is RulefileAuditType => row !== null);
}

/** Seeded defaults om fältet saknas helt (skrivs vid persist). */
export function ensure_audit_types_for_edit(metadata: Record<string, unknown>): RulefileAuditType[] {
    if (!Array.isArray(metadata.auditTypes)) {
        metadata.auditTypes = DEFAULT_AUDIT_TYPES.map((row) => ({ ...row }));
    }
    return resolve_audit_types(metadata);
}

export function normalize_audit_types_for_persist(metadata: Record<string, unknown>): void {
    if (!Array.isArray(metadata.auditTypes)) return;
    metadata.auditTypes = resolve_audit_types(metadata).map((row) => ({ ...row }));
}

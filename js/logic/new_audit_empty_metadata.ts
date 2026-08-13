/**
 * @fileoverview Tomma metadatafält för ny granskning (endast ansvarig granskare ifylld).
 */

export const NEW_AUDIT_EMPTY_METADATA_FIELD_KEYS = [
    'caseNumber',
    'actorName',
    'actorLink',
    'auditorName',
    'caseHandler',
    'internalComment',
    'auditTypeId',
    'auditTypeLabel',
] as const;

export type NewAuditEmptyMetadataFormData = Record<
    (typeof NEW_AUDIT_EMPTY_METADATA_FIELD_KEYS)[number],
    string
>;

export function build_empty_new_audit_metadata_form_data(
    auditor_name: string
): NewAuditEmptyMetadataFormData {
    return {
        caseNumber: '',
        actorName: '',
        actorLink: '',
        auditorName: String(auditor_name ?? '').trim(),
        caseHandler: '',
        internalComment: '',
        auditTypeId: '',
        auditTypeLabel: '',
    };
}

function trim_metadata_value(value: unknown): string {
    return value !== null && value !== undefined ? String(value).trim() : '';
}

/** Sant om sparad metadata skiljer sig från tomma ny-granskning-värden. */
export function new_audit_metadata_differs_from_empty_form(
    metadata: Record<string, unknown> | null | undefined,
    auditor_name: string
): boolean {
    const empty = build_empty_new_audit_metadata_form_data(auditor_name);
    return new_audit_metadata_differs_from_reference_form(metadata, empty);
}

/** Sant om sparad metadata skiljer sig från referensvärden (t.ex. standardmetadata). */
export function new_audit_metadata_differs_from_reference_form(
    metadata: Record<string, unknown> | null | undefined,
    reference: NewAuditEmptyMetadataFormData
): boolean {
    return NEW_AUDIT_EMPTY_METADATA_FIELD_KEYS.some(
        (key) => trim_metadata_value(metadata?.[key]) !== reference[key]
    );
}

/**
 * @file Shallow normalisering av granskningsobjekt innan export så att anrop som
 * `(audit.samples || []).forEach` inte kraschar när `samples` är ett objekt eller annan typ.
 */

export function coerce_audit_for_export<T extends Record<string, unknown>>(audit: T | null | undefined): T | null | undefined {
    if (audit === null || audit === undefined) {
        return audit;
    }
    if (typeof audit !== 'object' || Array.isArray(audit)) {
        return audit;
    }
    const out = { ...audit } as Record<string, unknown>;
    if (!Array.isArray(out.samples)) {
        out.samples = [];
    }
    if (!Array.isArray(out.archivedRequirementResults)) {
        out.archivedRequirementResults = [];
    }
    return out as T;
}

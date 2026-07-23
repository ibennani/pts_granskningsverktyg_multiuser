/**
 * @fileoverview Härleder webb/PDF från regelfilens monitoringType.
 */

/**
 * @param {unknown} rule_content
 * @returns {'pdf' | 'webb' | null}
 */
export function normalize_media_kind(rule_content) {
    const m = rule_content?.metadata?.monitoringType;
    const text = typeof m?.text === 'string' ? m.text.trim() : '';
    const typ = typeof m?.type === 'string' ? m.type.trim() : '';
    const raw = (typ || text).toLowerCase();
    if (!raw) return null;
    if (raw.includes('pdf')) return 'pdf';
    if (raw === 'web' || raw.includes('webb') || raw.includes('web')) return 'webb';
    return null;
}

/**
 * @param {Array<'pdf' | 'webb' | null>} media_kinds
 * @returns {'marknadskontroll-lptt' | 'tillsyn-lptt' | null}
 */
export function resolve_target_type_id_for_case(media_kinds) {
    const kinds = media_kinds.filter(Boolean);
    if (kinds.length === 0) return null;
    if (kinds.some((kind) => kind === 'pdf')) return 'marknadskontroll-lptt';
    if (kinds.every((kind) => kind === 'webb')) return 'tillsyn-lptt';
    return null;
}

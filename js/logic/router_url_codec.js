/**
 * Kompakterar hash-fragment (#vy?parametrar) med korta vy-alias och korta nycklar
 * för vanliga id-parametrar. Långa vy-namn och långa parametrar accepteras fortfarande.
 * @module js/logic/router_url_codec
 */

/** @type {Readonly<Record<string, string>>} */
const CANONICAL_VIEW_TO_COMPACT = Object.freeze({
    audit_overview: 'ov',
    requirement_audit: 'ra',
    requirement_list: 'rl',
    all_requirements: 'qr',
    audit_actions: 'xa',
    audit_problems: 'pb',
    audit_images: 'im',
    archived_requirements: 'ah',
    rulefile_change_log: 'cf',
    update_rulefile: 'uf',
    rulefile_requirements: 'fq',
    rulefile_view_requirement: 'rv',
    rulefile_edit_requirement: 'rm',
    rulefile_add_requirement: 'rn',
    confirm_updates: 'cp',
    final_confirm_updates: 'fy',
    edit_rulefile_main: 'ej',
    rulefile_metadata_edit: 'je',
    rulefile_metadata_view: 'jv',
    rulefile_sections: 'rs',
    sample_management: 'sm',
    sample_form: 'sf',
    confirm_sample_edit: 'ce',
    metadata: 'md',
    edit_metadata: 'em',
    backup_detail: 'bd',
    backup_rulefile_detail: 'br',
    backup_settings: 'ws',
    confirm_delete: 'dx'
});

/** @type {Map<string, string>} */
const COMPACT_VIEW_TO_CANONICAL = new Map(
    Object.entries(CANONICAL_VIEW_TO_COMPACT).map(([canonical, compact]) => [compact, canonical])
);

/**
 * @param {string|null|undefined} slug
 * @returns {string}
 */
export function expand_view_slug_from_hash(slug) {
    if (!slug) return 'start';
    const mapped = COMPACT_VIEW_TO_CANONICAL.get(slug);
    return mapped || slug;
}

/**
 * @param {string} canonical_view
 * @returns {string}
 */
export function compact_view_slug_from_canonical(canonical_view) {
    return CANONICAL_VIEW_TO_COMPACT[canonical_view] || canonical_view;
}

/**
 * Normaliserar query-nycklar till kanoniska namn (auditId, sampleId, requirementId).
 * @param {Record<string, string>} raw_params
 * @returns {Record<string, string>}
 */
export function normalize_params_from_hash_query(raw_params) {
    const out = { ...raw_params };
    if (out.auditId === undefined && out.a !== undefined) out.auditId = out.a;
    if (out.sampleId === undefined && out.s !== undefined) out.sampleId = out.s;
    if (out.requirementId === undefined && out.r !== undefined) out.requirementId = out.r;
    delete out.a;
    delete out.s;
    delete out.r;
    return out;
}

/**
 * Byter ut långa id-nycklar mot korta i hash (behåller övriga nycklar oförändrade).
 * @param {Record<string, string>} canonical_params
 * @returns {Record<string, string>}
 */
export function compact_param_keys_for_hash(canonical_params) {
    const p = canonical_params && typeof canonical_params === 'object' ? canonical_params : {};
    const out = {};
    if (p.auditId !== undefined && p.auditId !== null && p.auditId !== '') {
        out.a = String(p.auditId);
    }
    if (p.sampleId !== undefined && p.sampleId !== null && p.sampleId !== '') {
        out.s = String(p.sampleId);
    }
    if (p.requirementId !== undefined && p.requirementId !== null && p.requirementId !== '') {
        out.r = String(p.requirementId);
    }
    for (const [k, v] of Object.entries(p)) {
        if (k === 'auditId' || k === 'sampleId' || k === 'requirementId') continue;
        out[k] = v;
    }
    return out;
}

/**
 * Bygger hash-del utan inledande # (kompakt vy + query).
 * @param {string} canonical_view_name
 * @param {Record<string, string>} canonical_params
 * @returns {string}
 */
export function build_compact_hash_fragment(canonical_view_name, canonical_params) {
    const view_part = compact_view_slug_from_canonical(canonical_view_name);
    const merged = canonical_params && Object.keys(canonical_params).length > 0
        ? compact_param_keys_for_hash(canonical_params)
        : {};
    if (!merged || Object.keys(merged).length === 0) return view_part;
    return `${view_part}?${new URLSearchParams(merged).toString()}`;
}

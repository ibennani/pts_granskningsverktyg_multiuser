/**
 * Serialiserar och tolkar kravgranskningens sidomeny-inställningar som hash-parametrar.
 * @module js/logic/requirement_audit_url_ui
 */

/** Maxlängd för söksträng i URL (tecken). */
export const REQUIREMENT_AUDIT_URL_SEARCH_MAX_LEN = 200;

const STATUS_KEYS = [
    'needs_help',
    'passed',
    'failed',
    'partially_audited',
    'not_audited',
    'updated'
] as const;

export type RequirementAuditStatusKey = (typeof STATUS_KEYS)[number];

export type RequirementAuditFilterBlock = {
    searchText: string;
    sortBy: string;
    status: Record<RequirementAuditStatusKey, boolean>;
};

export type RequirementAuditSidebarLike = {
    selectedMode: string;
    filtersByMode: {
        sample_requirements: RequirementAuditFilterBlock;
        requirement_samples: RequirementAuditFilterBlock;
    };
};

export const REQUIREMENT_AUDIT_URL_KEYS = {
    MODE: 'rasM',
    SORT_SR: 'rasSS',
    SORT_RS: 'rasRS',
    SEARCH_SR: 'rasSQ',
    SEARCH_RS: 'rasRQ',
    MASK_SR: 'rasSM',
    MASK_RS: 'rasRM'
} as const;

const ALL_TRUE_MASK = STATUS_KEYS.reduce((acc, _k, i) => acc | (1 << i), 0);

const MODE_TOKEN = {
    sample_requirements: 'sr',
    requirement_samples: 'rs'
} as const;

function default_sr_block(): RequirementAuditFilterBlock {
    return {
        searchText: '',
        sortBy: 'ref_asc',
        status: {
            needs_help: true,
            passed: true,
            failed: true,
            partially_audited: true,
            not_audited: true,
            updated: true
        }
    };
}

function default_rs_block(): RequirementAuditFilterBlock {
    return {
        searchText: '',
        sortBy: 'creation_order',
        status: {
            needs_help: true,
            passed: true,
            failed: true,
            partially_audited: true,
            not_audited: true,
            updated: true
        }
    };
}

export function default_requirement_audit_sidebar_like(): RequirementAuditSidebarLike {
    return {
        selectedMode: 'requirement_samples',
        filtersByMode: {
            sample_requirements: default_sr_block(),
            requirement_samples: default_rs_block()
        }
    };
}

export function status_object_to_mask(status: Record<string, boolean> | undefined): number {
    if (!status) return ALL_TRUE_MASK;
    let m = 0;
    STATUS_KEYS.forEach((k, i) => {
        if (status[k]) m |= 1 << i;
    });
    return m;
}

export function mask_to_status_object(mask: number): Record<RequirementAuditStatusKey, boolean> {
    const o = {} as Record<RequirementAuditStatusKey, boolean>;
    STATUS_KEYS.forEach((k, i) => {
        o[k] = (mask & (1 << i)) !== 0;
    });
    return o;
}

function truncate_search(s: string): string {
    const t = (s || '').trim();
    if (t.length <= REQUIREMENT_AUDIT_URL_SEARCH_MAX_LEN) return t;
    return t.slice(0, REQUIREMENT_AUDIT_URL_SEARCH_MAX_LEN);
}

/**
 * Platta parametrar att lägga i hash (kanoniska strängvärden).
 */
export function requirement_audit_sidebar_settings_to_url_params(
    settings: RequirementAuditSidebarLike | null | undefined
): Record<string, string> {
    if (!settings || !settings.filtersByMode) return {};
    const out: Record<string, string> = {};
    const def = default_requirement_audit_sidebar_like();
    const sr = settings.filtersByMode.sample_requirements || def.filtersByMode.sample_requirements;
    const rs = settings.filtersByMode.requirement_samples || def.filtersByMode.requirement_samples;
    const mode = settings.selectedMode === 'sample_requirements' ? 'sample_requirements' : 'requirement_samples';

    if (mode !== def.selectedMode) {
        out[REQUIREMENT_AUDIT_URL_KEYS.MODE] =
            mode === 'sample_requirements' ? MODE_TOKEN.sample_requirements : MODE_TOKEN.requirement_samples;
    }

    if (sr.sortBy !== def.filtersByMode.sample_requirements.sortBy) {
        out[REQUIREMENT_AUDIT_URL_KEYS.SORT_SR] = String(sr.sortBy);
    }
    if (rs.sortBy !== def.filtersByMode.requirement_samples.sortBy) {
        out[REQUIREMENT_AUDIT_URL_KEYS.SORT_RS] = String(rs.sortBy);
    }

    const sq = truncate_search(sr.searchText || '');
    if (sq.length > 0) {
        out[REQUIREMENT_AUDIT_URL_KEYS.SEARCH_SR] = sq;
    }
    const rq = truncate_search(rs.searchText || '');
    if (rq.length > 0) {
        out[REQUIREMENT_AUDIT_URL_KEYS.SEARCH_RS] = rq;
    }

    const sm = status_object_to_mask(sr.status);
    if (sm !== ALL_TRUE_MASK) {
        out[REQUIREMENT_AUDIT_URL_KEYS.MASK_SR] = String(sm);
    }
    const rm = status_object_to_mask(rs.status);
    if (rm !== ALL_TRUE_MASK) {
        out[REQUIREMENT_AUDIT_URL_KEYS.MASK_RS] = String(rm);
    }

    return out;
}

export function url_params_contain_requirement_audit_ui(raw: Record<string, string>): boolean {
    return Object.values(REQUIREMENT_AUDIT_URL_KEYS).some((k) => raw[k] !== undefined && raw[k] !== '');
}

function parse_mode_token(tok: string | undefined): 'sample_requirements' | 'requirement_samples' | null {
    if (tok === MODE_TOKEN.sample_requirements) return 'sample_requirements';
    if (tok === MODE_TOKEN.requirement_samples) return 'requirement_samples';
    return null;
}

export function sanitize_requirement_audit_sort(mode: string, sort_by: string | undefined): string | null {
    const sr_modes = ['ref_asc', 'ref_desc', 'title_asc', 'title_desc', 'updated_first'];
    const rs_modes = ['creation_order', 'sample_asc', 'sample_desc', 'page_type_asc', 'page_type_desc'];
    if (!sort_by) return null;
    if (mode === 'sample_requirements') return sr_modes.includes(sort_by) ? sort_by : null;
    if (mode === 'requirement_samples') return rs_modes.includes(sort_by) ? sort_by : null;
    return null;
}

/** Ofullständig patch från URL (enskilda fält). */
export type RequirementAuditSidebarUrlPatch = {
    selectedMode?: string;
    sample_requirements?: Partial<RequirementAuditFilterBlock>;
    requirement_samples?: Partial<RequirementAuditFilterBlock>;
};

function decode_search_param(v: string | undefined): string {
    if (v === undefined || v === '') return '';
    try {
        return truncate_search(decodeURIComponent(String(v).replace(/\+/g, ' ')));
    } catch {
        return truncate_search(String(v));
    }
}

/**
 * Parsar endast angivna sidomenyfält från hash (inget att skicka om inga ras-nycklar).
 */
export function url_params_to_requirement_audit_sidebar_patch(
    raw: Record<string, string | undefined>
): RequirementAuditSidebarUrlPatch | null {
    const has_any = url_params_contain_requirement_audit_ui(raw as Record<string, string>);
    if (!has_any) return null;

    const patch: RequirementAuditSidebarUrlPatch = {};
    const mode_token = raw[REQUIREMENT_AUDIT_URL_KEYS.MODE];
    const parsed_mode = parse_mode_token(mode_token);
    if (parsed_mode) {
        patch.selectedMode = parsed_mode;
    }

    const sort_sr_override = sanitize_requirement_audit_sort('sample_requirements', raw[REQUIREMENT_AUDIT_URL_KEYS.SORT_SR]);
    if (sort_sr_override) {
        patch.sample_requirements = { ...patch.sample_requirements, sortBy: sort_sr_override };
    }
    const sort_rs_override = sanitize_requirement_audit_sort('requirement_samples', raw[REQUIREMENT_AUDIT_URL_KEYS.SORT_RS]);
    if (sort_rs_override) {
        patch.requirement_samples = { ...patch.requirement_samples, sortBy: sort_rs_override };
    }

    if (raw[REQUIREMENT_AUDIT_URL_KEYS.SEARCH_SR]) {
        patch.sample_requirements = {
            ...patch.sample_requirements,
            searchText: decode_search_param(raw[REQUIREMENT_AUDIT_URL_KEYS.SEARCH_SR])
        };
    }
    if (raw[REQUIREMENT_AUDIT_URL_KEYS.SEARCH_RS]) {
        patch.requirement_samples = {
            ...patch.requirement_samples,
            searchText: decode_search_param(raw[REQUIREMENT_AUDIT_URL_KEYS.SEARCH_RS])
        };
    }

    const parse_mask = (s: string | undefined): number | null => {
        if (s === undefined || s === '') return null;
        const n = parseInt(String(s), 10);
        return Number.isFinite(n) && n >= 0 && n <= ALL_TRUE_MASK ? n : null;
    };

    const m_sr = parse_mask(raw[REQUIREMENT_AUDIT_URL_KEYS.MASK_SR]);
    if (m_sr !== null) {
        patch.sample_requirements = {
            ...patch.sample_requirements,
            status: mask_to_status_object(m_sr)
        };
    }
    const m_rs = parse_mask(raw[REQUIREMENT_AUDIT_URL_KEYS.MASK_RS]);
    if (m_rs !== null) {
        patch.requirement_samples = {
            ...patch.requirement_samples,
            status: mask_to_status_object(m_rs)
        };
    }

    return patch;
}

/**
 * Slår ihop patch med befintlig state ( eller standardvärden).
 */
export function merge_requirement_audit_sidebar_patch(
    prev: RequirementAuditSidebarLike | null | undefined,
    patch: RequirementAuditSidebarUrlPatch
): RequirementAuditSidebarLike {
    const d = default_requirement_audit_sidebar_like();
    const base = prev && prev.filtersByMode ? prev : d;

    const sample_req: RequirementAuditFilterBlock = {
        ...d.filtersByMode.sample_requirements,
        ...base.filtersByMode.sample_requirements,
        ...(patch.sample_requirements || {}),
        status: {
            ...d.filtersByMode.sample_requirements.status,
            ...base.filtersByMode.sample_requirements.status,
            ...(patch.sample_requirements?.status || {})
        }
    };
    const requirement_samp: RequirementAuditFilterBlock = {
        ...d.filtersByMode.requirement_samples,
        ...base.filtersByMode.requirement_samples,
        ...(patch.requirement_samples || {}),
        status: {
            ...d.filtersByMode.requirement_samples.status,
            ...base.filtersByMode.requirement_samples.status,
            ...(patch.requirement_samples?.status || {})
        }
    };

    return {
        selectedMode: patch.selectedMode ?? base.selectedMode ?? d.selectedMode,
        filtersByMode: {
            sample_requirements: sample_req,
            requirement_samples: requirement_samp
        }
    };
}

/**
 * Tar bort UI-nycklar från param-map så router/render inte skickar dem till komponenten som okända deps.
 */
export function strip_requirement_audit_ui_keys(params: Record<string, string>): Record<string, string> {
    const next = { ...params };
    for (const k of Object.values(REQUIREMENT_AUDIT_URL_KEYS)) {
        delete next[k];
    }
    return next;
}

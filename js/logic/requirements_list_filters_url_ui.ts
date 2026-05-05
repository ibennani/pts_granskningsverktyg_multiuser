/**
 * Hash-parametrar för filter i kravlistor (per stickprov respektive alla krav).
 * @module js/logic/requirements_list_filters_url_ui
 */

import {
    mask_to_status_object,
    status_object_to_mask,
    type RequirementAuditStatusKey
} from './requirement_audit_url_ui.js';

export const REQUIREMENT_LIST_FILTER_URL_KEYS = {
    SEARCH: 'rlSq',
    SORT: 'rlSo',
    MASK: 'rlMa'
} as const;

export const ALL_REQUIREMENTS_FILTER_URL_KEYS = {
    SEARCH: 'arSq',
    SORT: 'arSo',
    MASK: 'arMa'
} as const;

const RL_SORT_OK = new Set(['default', 'ref_asc', 'ref_desc', 'title_asc', 'title_desc', 'updated_first']);
const AR_SORT_OK = RL_SORT_OK;

const ALL_TRUE_MASK = ['needs_help', 'passed', 'failed', 'partially_audited', 'not_audited', 'updated'].reduce(
    (acc, _k, i) => acc | (1 << i),
    0
);

export type ListToolbarLike = {
    searchText: string;
    sortBy: string;
    status: Record<RequirementAuditStatusKey, boolean>;
};

const LIST_SEARCH_MAX = 200;

function truncate_search(s: string): string {
    const t = (s || '').trim();
    return t.length > LIST_SEARCH_MAX ? t.slice(0, LIST_SEARCH_MAX) : t;
}

/** Default enligt initialState för listfiltren. */
export function default_requirement_list_filter(): ListToolbarLike {
    const st_all_true: Record<RequirementAuditStatusKey, boolean> = {
        needs_help: true,
        passed: true,
        failed: true,
        partially_audited: true,
        not_audited: true,
        updated: true
    };
    return {
        searchText: '',
        sortBy: 'default',
        status: st_all_true
    };
}

export function list_filter_settings_to_url_params_for_requirement_list(
    settings: ListToolbarLike | null | undefined
): Record<string, string> {
    if (!settings) return {};
    const def = default_requirement_list_filter();
    const out: Record<string, string> = {};

    const q = truncate_search(settings.searchText || '');
    if (q.length > 0) {
        out[REQUIREMENT_LIST_FILTER_URL_KEYS.SEARCH] = q;
    }
    if (settings.sortBy && settings.sortBy !== def.sortBy && RL_SORT_OK.has(settings.sortBy)) {
        out[REQUIREMENT_LIST_FILTER_URL_KEYS.SORT] = String(settings.sortBy);
    }
    const mask = status_object_to_mask(settings.status || def.status);
    if (mask !== ALL_TRUE_MASK) {
        out[REQUIREMENT_LIST_FILTER_URL_KEYS.MASK] = String(mask);
    }
    return out;
}

export function list_filter_settings_to_url_params_for_all_requirements(
    settings: ListToolbarLike | null | undefined
): Record<string, string> {
    if (!settings) return {};
    const def = default_requirement_list_filter();
    const out: Record<string, string> = {};

    const q = truncate_search(settings.searchText || '');
    if (q.length > 0) {
        out[ALL_REQUIREMENTS_FILTER_URL_KEYS.SEARCH] = q;
    }
    if (settings.sortBy && settings.sortBy !== def.sortBy && AR_SORT_OK.has(settings.sortBy)) {
        out[ALL_REQUIREMENTS_FILTER_URL_KEYS.SORT] = String(settings.sortBy);
    }
    const mask = status_object_to_mask(settings.status || def.status);
    if (mask !== ALL_TRUE_MASK) {
        out[ALL_REQUIREMENTS_FILTER_URL_KEYS.MASK] = String(mask);
    }
    return out;
}

export function strip_requirement_list_filter_url_keys(params: Record<string, string>): Record<string, string> {
    const next = { ...params };
    for (const k of Object.values(REQUIREMENT_LIST_FILTER_URL_KEYS)) delete next[k];
    return next;
}

export function strip_all_requirements_filter_url_keys(params: Record<string, string>): Record<string, string> {
    const next = { ...params };
    for (const k of Object.values(ALL_REQUIREMENTS_FILTER_URL_KEYS)) delete next[k];
    return next;
}

function decode_search_val(v: string | undefined): string {
    if (v === undefined || v === '') return '';
    try {
        return truncate_search(decodeURIComponent(String(v).replace(/\+/g, ' ')));
    } catch {
        return truncate_search(String(v));
    }
}

export type ListFilterPatch = Partial<ListToolbarLike>;

export function url_params_to_requirement_list_filter_patch(raw: Record<string, string | undefined>): ListFilterPatch | null {
    const has =
        Boolean(raw[REQUIREMENT_LIST_FILTER_URL_KEYS.SEARCH]) ||
        Boolean(raw[REQUIREMENT_LIST_FILTER_URL_KEYS.SORT]) ||
        (raw[REQUIREMENT_LIST_FILTER_URL_KEYS.MASK] !== undefined && raw[REQUIREMENT_LIST_FILTER_URL_KEYS.MASK] !== '');
    if (!has) return null;
    const patch: ListFilterPatch = {};
    if (raw[REQUIREMENT_LIST_FILTER_URL_KEYS.SEARCH]) {
        patch.searchText = decode_search_val(raw[REQUIREMENT_LIST_FILTER_URL_KEYS.SEARCH]);
    }
    const sor = raw[REQUIREMENT_LIST_FILTER_URL_KEYS.SORT];
    if (sor && RL_SORT_OK.has(sor)) {
        patch.sortBy = sor;
    }
    const m_raw = raw[REQUIREMENT_LIST_FILTER_URL_KEYS.MASK];
    if (m_raw !== undefined && m_raw !== '') {
        const n = parseInt(String(m_raw), 10);
        if (Number.isFinite(n) && n >= 0 && n <= ALL_TRUE_MASK) {
            patch.status = mask_to_status_object(n);
        }
    }
    return patch;
}

export function url_params_to_all_requirements_filter_patch(raw: Record<string, string | undefined>): ListFilterPatch | null {
    const has =
        Boolean(raw[ALL_REQUIREMENTS_FILTER_URL_KEYS.SEARCH]) ||
        Boolean(raw[ALL_REQUIREMENTS_FILTER_URL_KEYS.SORT]) ||
        (raw[ALL_REQUIREMENTS_FILTER_URL_KEYS.MASK] !== undefined && raw[ALL_REQUIREMENTS_FILTER_URL_KEYS.MASK] !== '');
    if (!has) return null;
    const patch: ListFilterPatch = {};
    if (raw[ALL_REQUIREMENTS_FILTER_URL_KEYS.SEARCH]) {
        patch.searchText = decode_search_val(raw[ALL_REQUIREMENTS_FILTER_URL_KEYS.SEARCH]);
    }
    const sor = raw[ALL_REQUIREMENTS_FILTER_URL_KEYS.SORT];
    if (sor && AR_SORT_OK.has(sor)) {
        patch.sortBy = sor;
    }
    const m_raw = raw[ALL_REQUIREMENTS_FILTER_URL_KEYS.MASK];
    if (m_raw !== undefined && m_raw !== '') {
        const n = parseInt(String(m_raw), 10);
        if (Number.isFinite(n) && n >= 0 && n <= ALL_TRUE_MASK) {
            patch.status = mask_to_status_object(n);
        }
    }
    return patch;
}

export function merge_list_filter(prev: ListToolbarLike | null | undefined, patch: ListFilterPatch): ListToolbarLike {
    const d = default_requirement_list_filter();
    const base = prev && typeof prev === 'object' && prev.status ? prev : d;
    return {
        searchText: patch.searchText !== undefined ? patch.searchText : base.searchText,
        sortBy: patch.sortBy !== undefined ? patch.sortBy : base.sortBy,
        status: {
            ...d.status,
            ...base.status,
            ...(patch.status || {})
        }
    };
}

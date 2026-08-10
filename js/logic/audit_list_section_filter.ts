/**
 * @fileoverview Delad filter- och sorteringslogik för granskningslistans sektioner i AuditSamplesSection.
 */

import { DEFAULT_AUDIT_TYPES } from '../../shared/rulefile/rulefile_audit_types.js';
import { audit_row_granskningstyp_display_label } from '../utils/audit_type_display_label.js';
import { get_current_user_name } from '../user/current_user.js';
import { filter_text_matches } from '../utils/string_filter_normalize.js';

export type AuditListRow = {
    id?: string | number;
    status?: string;
    audit_type?: string;
    granskningstyp_id?: string;
    granskningstyp_label?: string;
    metadata?: {
        caseNumber?: string;
        actorName?: string;
        auditorName?: string;
        auditTypeId?: string;
        auditTypeLabel?: string;
    };
};

export type AuditListSectionConfig = {
    heading_key: string;
    audits: AuditListRow[];
    heading_audits: AuditListRow[];
};

export type AuditListViewMode = 'mine' | 'all' | 'case' | 'auditor';

export type AuditListFilterContext = {
    audits: AuditListRow[];
    audit_filter_query?: string;
    audit_type_filter?: string;
    granskningstyp_filter?: string;
    audit_list_group_mode?: AuditListViewMode | string;
    audit_table_page_size?: string;
};

export const DEFAULT_AUDIT_TABLE_PAGE_SIZE = 'all';
export const DEFAULT_AUDIT_LIST_GROUP_MODE = 'all';

/** Antal aktiva sekundära filter (exklusive sök). */
export function count_secondary_filters(ctx: AuditListFilterContext): number {
    let count = 0;
    if (String(ctx.granskningstyp_filter || '').trim()) count += 1;
    if (String(ctx.audit_type_filter || '').trim()) count += 1;
    const group_mode = String(ctx.audit_list_group_mode || DEFAULT_AUDIT_LIST_GROUP_MODE).trim();
    if (group_mode && group_mode !== DEFAULT_AUDIT_LIST_GROUP_MODE) count += 1;
    const page_size = String(ctx.audit_table_page_size || DEFAULT_AUDIT_TABLE_PAGE_SIZE).trim();
    if (page_size && page_size !== DEFAULT_AUDIT_TABLE_PAGE_SIZE) count += 1;
    return count;
}

/** Sant när listan är avgränsad av sök eller sekundära filter (gruppering, tom-lista, live-region). */
export function has_list_narrowing_filter(ctx: AuditListFilterContext): boolean {
    return count_secondary_filters(ctx) > 0 || !!(ctx.audit_filter_query || '').trim();
}

/** Sant när listan ska visa alla sektioner även om de är tomma (ingen söktext, standardfilter). */
export function is_audit_list_show_all_sections_mode(ctx: AuditListFilterContext): boolean {
    return !has_list_narrowing_filter(ctx);
}

/** Sant när listan ska grupperas (diarienummer eller granskare). */
export function is_audit_list_grouped_view_mode(mode: string | undefined): boolean {
    return mode === 'case' || mode === 'auditor';
}

const SECTION_HEADING_KEYS = [
    'start_view_audits_heading',
    'start_view_new_audits_heading',
    'start_view_completed_audits_heading',
    'start_view_archived_audits_heading'
] as const;

const STATUS_BY_HEADING: Record<(typeof SECTION_HEADING_KEYS)[number], string> = {
    start_view_audits_heading: 'in_progress',
    start_view_new_audits_heading: 'not_started',
    start_view_completed_audits_heading: 'locked',
    start_view_archived_audits_heading: 'archived'
};

/** Sorterar granskningar på ärendenummer (numeriskt där det går). */
export function sort_audits_by_case_number(list: AuditListRow[]): AuditListRow[] {
    return [...list].sort((a, b) => {
        const ca = (a.metadata?.caseNumber ?? '').toString().trim();
        const cb = (b.metadata?.caseNumber ?? '').toString().trim();
        if (!ca && !cb) return 0;
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.localeCompare(cb, undefined, { numeric: true });
    });
}

/** Filtrerar på fritext mot ärendenummer, aktör och granskare. */
export function filter_audits_by_text(list: AuditListRow[], query_raw: string): AuditListRow[] {
    const trimmed = (query_raw || '').trim();
    if (!trimmed) return list;
    return list.filter((a) => {
        const meta = a.metadata || {};
        const case_number = (meta.caseNumber ?? '').toString().trim();
        const actor_name = (meta.actorName ?? '').toString().trim();
        const auditor_name = (meta.auditorName ?? '').toString().trim();
        const combined = `${case_number} ${actor_name} ${auditor_name}`.trim();
        if (!combined) return false;
        return filter_text_matches(combined, trimmed);
    });
}

/** Filtrerar till granskningar där metadata.auditorName matchar inloggad användare. */
export function filter_audits_by_current_user(list: AuditListRow[]): AuditListRow[] {
    const current = get_current_user_name().trim().toLowerCase();
    if (!current) return [];
    return list.filter((a) => {
        const auditor = (a.metadata?.auditorName ?? '').toString().trim().toLowerCase();
        return auditor === current;
    });
}

/** Samlar unika granskningstyper för filterdropdown (alltid minst standardtyperna). */
export function collect_granskningstyp_filter_options(
    audits: AuditListRow[]
): Array<{ id: string; label: string }> {
    const map = new Map<string, string>();
    for (const row of DEFAULT_AUDIT_TYPES) {
        map.set(row.id, row.label);
    }
    for (const row of audits) {
        const id = String(row.granskningstyp_id || row.metadata?.auditTypeId || '').trim();
        if (!id) continue;
        if (map.has(id)) continue;
        const label = audit_row_granskningstyp_display_label(row);
        map.set(id, label || id);
    }
    return [...map.entries()]
        .sort((a, b) => a[1].localeCompare(b[1], 'sv'))
        .map(([id, label]) => ({ id, label }));
}

/** Filtrerar på media-typ webb/pdf (tom sträng = alla). */
export function filter_audits_by_type(list: AuditListRow[], audit_type_filter: string): AuditListRow[] {
    const want_type = String(audit_type_filter || '').trim();
    if (!want_type) return list;
    return list.filter((a) => String(a?.audit_type || '').trim() === want_type);
}

/** Filtrerar på granskningstyp (Tillsyn/Marknadskontroll). */
export function filter_audits_by_granskningstyp(
    list: AuditListRow[],
    granskningstyp_filter: string
): AuditListRow[] {
    const want_id = String(granskningstyp_filter || '').trim();
    if (!want_id) return list;
    return list.filter((a) => {
        const row_id = String(a.granskningstyp_id || a.metadata?.auditTypeId || '').trim();
        return row_id === want_id;
    });
}

/** Filtrerar och sorterar sektionens granskningar (text + media + granskningstyp). */
export function filter_audits_for_section(list: AuditListRow[], ctx: AuditListFilterContext): AuditListRow[] {
    const query_raw = ctx.audit_filter_query || '';
    return sort_audits_by_case_number(
        filter_audits_by_granskningstyp(
            filter_audits_by_type(filter_audits_by_text(list, query_raw), ctx.audit_type_filter || ''),
            ctx.granskningstyp_filter || ''
        )
    );
}

/**
 * Bygger sektionskonfiguration för granskningslistan.
 * Rubrik och tabell använder samma filterpipeline.
 */
export function build_audit_list_section_configs(ctx: AuditListFilterContext): {
    query_raw: string;
    has_text_filter: boolean;
    has_type_filter: boolean;
    has_granskningstyp_filter: boolean;
    secondary_filter_count: number;
    has_list_narrowing_filter: boolean;
    has_active_filter: boolean;
    section_configs: AuditListSectionConfig[];
} {
    const query_raw = ctx.audit_filter_query || '';
    const has_text_filter = !!query_raw.trim();
    const has_type_filter = !!String(ctx.audit_type_filter || '').trim();
    const has_granskningstyp_filter = !!String(ctx.granskningstyp_filter || '').trim();
    const secondary_filter_count = count_secondary_filters(ctx);
    const list_narrowing = has_list_narrowing_filter(ctx);
    const has_active_filter = list_narrowing;

    const mine_mode = ctx.audit_list_group_mode === 'mine';

    const section_configs = SECTION_HEADING_KEYS.map((heading_key) => {
        const status = STATUS_BY_HEADING[heading_key];
        let base = ctx.audits.filter((a) => a.status === status);
        if (mine_mode) {
            base = filter_audits_by_current_user(base);
        }
        const filtered = filter_audits_for_section(base, ctx);
        return {
            heading_key,
            audits: filtered,
            heading_audits: filtered
        };
    });

    return {
        query_raw,
        has_text_filter,
        has_type_filter,
        has_granskningstyp_filter,
        secondary_filter_count,
        has_list_narrowing_filter: list_narrowing,
        has_active_filter,
        section_configs
    };
}

/** Antal granskningar efter filter i alla sektioner. */
export function count_filtered_audits_in_sections(section_configs: AuditListSectionConfig[]): number {
    return section_configs.reduce((sum, cfg) => sum + (cfg.audits?.length ?? 0), 0);
}

/**
 * Returnerar sektioner som ska visas i listvyn.
 * Utan avgränsande filter (tom sökfält, standardval) visas alla sektioner även när de är tomma.
 * Med filter eller söktext visas bara sektioner som har matchande granskningar.
 */
export function get_visible_audit_list_section_configs(
    section_configs: AuditListSectionConfig[],
    ctx: AuditListFilterContext
): AuditListSectionConfig[] {
    if (!has_list_narrowing_filter(ctx)) {
        return section_configs;
    }
    return section_configs.filter((cfg) => (cfg.audits?.length ?? 0) > 0);
}

/** Synliga sektionsnycklar efter filter (samma ordning som i listvyn). */
export function get_visible_audit_list_section_keys(ctx: AuditListFilterContext): string[] {
    const { section_configs } = build_audit_list_section_configs(ctx);
    return get_visible_audit_list_section_configs(section_configs, ctx).map((cfg) => cfg.heading_key);
}

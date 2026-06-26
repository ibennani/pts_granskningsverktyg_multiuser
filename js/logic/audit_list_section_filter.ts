/**
 * @fileoverview Delad filter- och sorteringslogik för granskningslistans sektioner i AuditSamplesSection.
 */

import { get_current_user_name } from '../user/current_user.js';
import { filter_text_matches } from '../utils/string_filter_normalize.js';

export type AuditListRow = {
    id?: string | number;
    status?: string;
    audit_type?: string;
    metadata?: {
        caseNumber?: string;
        actorName?: string;
        auditorName?: string;
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
    audit_list_group_mode?: AuditListViewMode | string;
};

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

/** Filtrerar på granskningstyp (tom sträng = alla typer). */
export function filter_audits_by_type(list: AuditListRow[], audit_type_filter: string): AuditListRow[] {
    const want_type = String(audit_type_filter || '').trim();
    if (!want_type) return list;
    return list.filter((a) => String(a?.audit_type || '').trim() === want_type);
}

/** Filtrerar och sorterar sektionens granskningar (text + typ). */
export function filter_audits_for_section(list: AuditListRow[], ctx: AuditListFilterContext): AuditListRow[] {
    const query_raw = ctx.audit_filter_query || '';
    return sort_audits_by_case_number(
        filter_audits_by_type(filter_audits_by_text(list, query_raw), ctx.audit_type_filter || '')
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
    has_active_filter: boolean;
    section_configs: AuditListSectionConfig[];
} {
    const query_raw = ctx.audit_filter_query || '';
    const has_text_filter = !!query_raw.trim();
    const has_type_filter = !!String(ctx.audit_type_filter || '').trim();
    const has_active_filter = has_text_filter || has_type_filter;

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

    return { query_raw, has_text_filter, has_type_filter, has_active_filter, section_configs };
}

/**
 * @fileoverview Lokala visningsnamn för grupprader vid gruppering på ärendenummer.
 * Nyckeln är diarienumret; värdet är texten i kolumnen «Aktörens namn», inte ärendenumret.
 */

import {
    format_group_actor_names,
    type AuditRowForGrouping
} from './audit_list_case_grouping.js';

const STORAGE_KEY = 'gv_audit_list_group_display_names_v1';

export type AuditGroupDisplayNameMap = Record<string, string>;

function read_display_name_map(): AuditGroupDisplayNameMap {
    try {
        if (typeof sessionStorage === 'undefined') return {};
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed as AuditGroupDisplayNameMap;
    } catch {
        return {};
    }
}

function write_display_name_map(map: AuditGroupDisplayNameMap): void {
    try {
        if (typeof sessionStorage === 'undefined') return;
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        // Ignorera t.ex. quota-fel; listan fungerar utan sparade namn.
    }
}

/** Returnerar sparat gruppvisningsnamn för ärendenummer, eller tom sträng om inget finns. */
export function get_audit_group_display_name(case_number: string): string {
    const key = case_number.trim();
    if (!key) return '';
    return (read_display_name_map()[key] ?? '').toString().trim();
}

/** Sparar gruppvisningsnamn för ärendenummer. Tom sträng tar bort override. */
export function set_audit_group_display_name(case_number: string, display_name: string): void {
    const key = case_number.trim();
    if (!key) return;
    const trimmed = display_name.trim();
    const map = read_display_name_map();
    if (!trimmed) {
        delete map[key];
    } else {
        map[key] = trimmed;
    }
    write_display_name_map(map);
}

/** Visningsnamn för aktörskolumn: sparat namn eller aktör från äldsta granskningen. */
export function resolve_group_actor_display_name(
    group_key: string,
    audits: AuditRowForGrouping[]
): string {
    const custom = get_audit_group_display_name(group_key);
    if (custom) return custom;
    return format_group_actor_names(audits);
}

/** Sorteringsvärde för aktörskolumn med hänsyn till sparat visningsnamn. */
export function get_group_actor_display_sort_value(
    group_key: string,
    audits: AuditRowForGrouping[]
): string {
    return resolve_group_actor_display_name(group_key, audits);
}

/**
 * @fileoverview Tolerant matchning av id/key mellan DOM (data-attribut som strängar), JSON och regelfilsdefinitioner.
 */

/** True om två id-värden ska räknas som samma (sträng/tal). */
export function same_storage_id(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === undefined || a === null || b === undefined || b === null) {
        return false;
    }
    return String(a) === String(b);
}

/**
 * Kanonisk lagrings-/DOM-nyckel för en definition med `id` och/eller `key`.
 * `id` har företräde om det är satt och inte tomt.
 */
export function definition_primary_id(def: { id?: unknown; key?: unknown } | null | undefined): string {
    if (!def || typeof def !== 'object') return '';
    if (def.id !== undefined && def.id !== null && String(def.id) !== '') {
        return String(def.id);
    }
    if (def.key !== undefined && def.key !== null && String(def.key) !== '') {
        return String(def.key);
    }
    return '';
}

export function find_check_def_by_storage_id<T extends { id?: unknown; key?: unknown }>(
    checks: T[] | null | undefined,
    storage_or_dom_id: unknown
): T | undefined {
    return (checks ?? []).find((c) => same_storage_id(definition_primary_id(c), storage_or_dom_id));
}

export function find_pass_criterion_def_by_storage_id<T extends { id?: unknown; key?: unknown }>(
    pass_criteria: T[] | null | undefined,
    storage_or_dom_id: unknown
): T | undefined {
    return (pass_criteria ?? []).find((pc) => same_storage_id(definition_primary_id(pc), storage_or_dom_id));
}

export function index_of_check_def_by_storage_id<T extends { id?: unknown; key?: unknown }>(
    checks: T[] | null | undefined,
    storage_or_dom_id: unknown
): number {
    return (checks ?? []).findIndex((c) => same_storage_id(definition_primary_id(c), storage_or_dom_id));
}

export function index_of_pass_criterion_def_by_storage_id<T extends { id?: unknown; key?: unknown }>(
    pass_criteria: T[] | null | undefined,
    storage_or_dom_id: unknown
): number {
    return (pass_criteria ?? []).findIndex((pc) => same_storage_id(definition_primary_id(pc), storage_or_dom_id));
}

export type ResolvedMapEntry<T> = { storageKey: string; value: T };

/** Hittar post i objekt-map där nyckeln matchar lookup tolerant. */
export function resolve_map_entry<T>(
    map: Record<string, T> | null | undefined,
    lookup_id: unknown
): ResolvedMapEntry<T> | null {
    if (!map || typeof map !== 'object') return null;
    for (const k of Object.keys(map)) {
        if (same_storage_id(k, lookup_id)) {
            return { storageKey: k, value: map[k] as T };
        }
    }
    return null;
}

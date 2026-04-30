/**
 * @fileoverview Uppslagning av kravdefinitioner och lagrade kravresultat.
 */

import type { RequirementDef, RequirementResultStored } from './audit_logic_types.js';
import { RequirementLookup } from './requirement_lookup.js';

export function find_requirement_by_id(requirements: unknown, reqId: unknown): RequirementDef | null {
    if (reqId === null || reqId === undefined) return null;
    const look = RequirementLookup.from(requirements);
    return look ? look.findById(reqId) : null;
}

export function find_requirement_definition(requirements: unknown, reqId: unknown): RequirementDef | null {
    return find_requirement_by_id(requirements, reqId);
}

export function resolve_requirement_map_key(requirements: unknown, reqId: unknown): string | null {
    if (reqId === null || reqId === undefined) return null;
    const look = RequirementLookup.from(requirements);
    return look ? look.resolveMapKey(reqId) : null;
}

export function get_stored_requirement_result_for_def(
    requirement_results: Record<string, RequirementResultStored> | null | undefined,
    requirements: unknown,
    req_def: RequirementDef,
    entry_map_key?: string | number | null
): RequirementResultStored | undefined {
    if (!requirement_results || !req_def || typeof requirement_results !== 'object') {
        return undefined;
    }
    const look = RequirementLookup.from(requirements);
    const try_keys: string[] = [];
    const add = (k: string | number | null | undefined) => {
        if (k === null || k === undefined) return;
        const s = String(k).trim();
        if (s === '' || try_keys.includes(s)) return;
        try_keys.push(s);
    };
    add(look?.resolveMapKey(req_def.key));
    add(look?.resolveMapKey(req_def.id));
    if (look && !look.isArrayFormat() && entry_map_key !== null && entry_map_key !== undefined) {
        const raw = look.getRaw() as Record<string, RequirementDef>;
        const em = String(entry_map_key);
        if (Object.prototype.hasOwnProperty.call(raw, em)) {
            add(em);
        }
        add(look.resolveMapKey(em));
    }
    add(req_def.key);
    add(req_def.id);
    if (entry_map_key !== null && entry_map_key !== undefined) {
        add(entry_map_key);
    }
    for (const k of try_keys) {
        if (
            Object.prototype.hasOwnProperty.call(requirement_results, k) &&
            requirement_results[k] !== null &&
            requirement_results[k] !== undefined
        ) {
            return requirement_results[k];
        }
    }
    return undefined;
}

export function get_requirement_public_key(requirements: unknown, map_key: unknown): string | null {
    if (map_key === null || map_key === undefined) return null;
    const look = RequirementLookup.from(requirements);
    return look ? look.getPublicKey(map_key) : null;
}

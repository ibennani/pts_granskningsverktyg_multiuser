/**
 * @fileoverview Uppslagning av kravdefinitioner och lagrade kravresultat.
 */

import type { RequirementDef, RequirementResultStored } from './audit_logic_types.js';

export function find_requirement_by_id(requirements: unknown, reqId: unknown): RequirementDef | null {
    if (!requirements || reqId === null || reqId === undefined) return null;
    const reqIdStr = String(reqId);
    if (Array.isArray(requirements)) {
        return (
            requirements.find((r: RequirementDef) => {
                const k = r?.key !== null && r?.key !== undefined ? String(r.key) : null;
                const i = r?.id !== null && r?.id !== undefined ? String(r.id) : null;
                return (k !== null && k === reqIdStr) || (i !== null && i === reqIdStr);
            }) || null
        );
    }
    const direct =
        (requirements as Record<string, RequirementDef>)[reqIdStr] ??
        (requirements as Record<string, RequirementDef>)[String(reqId)];
    if (direct) return direct;
    for (const value of Object.values(requirements as Record<string, RequirementDef>)) {
        const k = value?.key !== null && value?.key !== undefined ? String(value.key) : null;
        const i = value?.id !== null && value?.id !== undefined ? String(value.id) : null;
        if ((k !== null && k === reqIdStr) || (i !== null && i === reqIdStr)) return value;
    }
    return null;
}

export function find_requirement_definition(requirements: unknown, reqId: unknown): RequirementDef | null {
    return find_requirement_by_id(requirements, reqId);
}

export function resolve_requirement_map_key(requirements: unknown, reqId: unknown): string | null {
    if (!requirements || Array.isArray(requirements) || reqId === null || reqId === undefined) return null;
    const reqIdStr = String(reqId);
    if (Object.prototype.hasOwnProperty.call(requirements, reqIdStr)) return reqIdStr;
    for (const [key, value] of Object.entries(requirements as Record<string, RequirementDef>)) {
        const k = value?.key !== null && value?.key !== undefined ? String(value.key) : null;
        const i = value?.id !== null && value?.id !== undefined ? String(value.id) : null;
        if ((k !== null && k === reqIdStr) || (i !== null && i === reqIdStr)) return key;
    }
    return null;
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
    const try_keys: string[] = [];
    const add = (k: string | number | null | undefined) => {
        if (k === null || k === undefined) return;
        const s = String(k).trim();
        if (s === '' || try_keys.includes(s)) return;
        try_keys.push(s);
    };
    add(resolve_requirement_map_key(requirements, req_def.key));
    add(resolve_requirement_map_key(requirements, req_def.id));
    if (requirements && !Array.isArray(requirements) && entry_map_key !== null && entry_map_key !== undefined) {
        const em = String(entry_map_key);
        if (Object.prototype.hasOwnProperty.call(requirements, em)) {
            add(em);
        }
        add(resolve_requirement_map_key(requirements, em));
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
    if (!requirements || map_key === null || map_key === undefined) return null;
    const mapKeyStr = String(map_key);
    if (Array.isArray(requirements)) {
        const req =
            (requirements as RequirementDef[]).find((r) => String(r?.key || r?.id || '') === mapKeyStr) || null;
        const pub = req?.key ?? req?.id ?? null;
        return pub !== null && pub !== undefined && String(pub).trim() !== '' ? String(pub) : mapKeyStr;
    }
    const req = (requirements as Record<string, RequirementDef>)[mapKeyStr] || null;
    const pub = req?.key ?? req?.id ?? null;
    return pub !== null && pub !== undefined && String(pub).trim() !== '' ? String(pub) : mapKeyStr;
}

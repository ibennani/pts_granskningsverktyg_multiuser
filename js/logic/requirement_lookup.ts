/**
 * @fileoverview Enhetlig uppslagning av krav oavsett om regelfilen lagrar dem som objekt eller array.
 */

import type { RequirementDef } from './audit_logic_types.js';

/** Kravlista i regelfil: antingen post per nyckel eller ordnad array. */
export type RequirementsInput = Record<string, RequirementDef> | RequirementDef[];

/**
 * Normaliserar krav till ett Record (nyckel = key eller id på posten).
 * Tomt objekt om indata saknas eller är ogiltig.
 */
export function normalize_requirements_to_record(requirements: unknown): Record<string, RequirementDef> {
    if (!requirements || typeof requirements !== 'object') return {};
    if (!Array.isArray(requirements)) return requirements as Record<string, RequirementDef>;
    const out: Record<string, RequirementDef> = {};
    for (const req of requirements as RequirementDef[]) {
        if (!req || typeof req !== 'object') continue;
        const key = req.key ?? req.id;
        if (key !== null && key !== undefined && String(key).trim() !== '') {
            out[String(key)] = req;
        }
    }
    return out;
}

/**
 * Kapslar objekt- eller array-format och erbjuder samma uppslags-API internt.
 */
export class RequirementLookup {
    private readonly source: RequirementsInput;

    private constructor(source: RequirementsInput) {
        this.source = source;
    }

    /** null om indata varken är objekt eller array (t.ex. null, primitiv). */
    static from(input: unknown): RequirementLookup | null {
        if (input === null || input === undefined) return null;
        if (typeof input !== 'object') return null;
        if (Array.isArray(input)) return new RequirementLookup(input as RequirementDef[]);
        return new RequirementLookup(input as Record<string, RequirementDef>);
    }

    isArrayFormat(): boolean {
        return Array.isArray(this.source);
    }

    /** Rå referens (samma struktur som i regelfilen). */
    getRaw(): RequirementsInput {
        return this.source;
    }

    findById(reqId: unknown): RequirementDef | null {
        if (reqId === null || reqId === undefined) return null;
        const reqIdStr = String(reqId);
        if (Array.isArray(this.source)) {
            const found =
                this.source.find((r: RequirementDef) => {
                    const k = r?.key !== null && r?.key !== undefined ? String(r.key) : null;
                    const i = r?.id !== null && r?.id !== undefined ? String(r.id) : null;
                    return (k !== null && k === reqIdStr) || (i !== null && i === reqIdStr);
                }) || null;
            return found;
        }
        const rec = this.source as Record<string, RequirementDef>;
        const direct = rec[reqIdStr] ?? rec[String(reqId)];
        if (direct) return direct;
        for (const value of Object.values(rec)) {
            const k = value?.key !== null && value?.key !== undefined ? String(value.key) : null;
            const i = value?.id !== null && value?.id !== undefined ? String(value.id) : null;
            if ((k !== null && k === reqIdStr) || (i !== null && i === reqIdStr)) return value;
        }
        return null;
    }

    resolveMapKey(reqId: unknown): string | null {
        if (reqId === null || reqId === undefined) return null;
        if (Array.isArray(this.source)) return null;
        const reqIdStr = String(reqId);
        const rec = this.source as Record<string, RequirementDef>;
        if (Object.prototype.hasOwnProperty.call(rec, reqIdStr)) return reqIdStr;
        for (const [key, value] of Object.entries(rec)) {
            const k = value?.key !== null && value?.key !== undefined ? String(value.key) : null;
            const i = value?.id !== null && value?.id !== undefined ? String(value.id) : null;
            if ((k !== null && k === reqIdStr) || (i !== null && i === reqIdStr)) return key;
        }
        return null;
    }

    getPublicKey(map_key: unknown): string | null {
        if (map_key === null || map_key === undefined) return null;
        const mapKeyStr = String(map_key);
        if (Array.isArray(this.source)) {
            const req =
                this.source.find((r) => String(r?.key || r?.id || '') === mapKeyStr) || null;
            const pub = req?.key ?? req?.id ?? null;
            return pub !== null && pub !== undefined && String(pub).trim() !== ''
                ? String(pub)
                : mapKeyStr;
        }
        const req = (this.source as Record<string, RequirementDef>)[mapKeyStr] || null;
        const pub = req?.key ?? req?.id ?? null;
        return pub !== null && pub !== undefined && String(pub).trim() !== '' ? String(pub) : mapKeyStr;
    }

    /** Poster som [lagringsnyckel, definition] för listor och menyer. */
    entries(): [string, RequirementDef][] {
        if (Array.isArray(this.source)) {
            return this.source.map((req, idx) => [String(req?.id ?? req?.key ?? idx), req]);
        }
        return Object.entries(this.source as Record<string, RequirementDef>);
    }

    forEachDef(callback: (def: RequirementDef, storage_key: string) => void): void {
        for (const [k, def] of this.entries()) {
            callback(def, k);
        }
    }
}

/**
 * Gemensam söklogik för krav – används av kravlistor, högerspalten och regelfilsredigering.
 * Säkerställer konsekvent sökbeteende överallt.
 *
 * @module js/utils/requirement_search_utils
 */

import { prepareString } from './string_filter_normalize.js';

function extract_text(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        return value.map(item => extract_text(item)).join(' ');
    }
    if (typeof value === 'object') {
        const candidate_keys = ['text', 'value', 'label', 'description', 'content'];
        const obj = value as Record<string, unknown>;
        for (const key of candidate_keys) {
            if (obj[key]) return extract_text(obj[key]);
        }
        return Object.values(obj).map(item => extract_text(item)).join(' ');
    }
    return String(value);
}

export interface SearchableRequirementOptions {
    includeInfoBlocks?: boolean;
    includeMetadata?: boolean;
}

/**
 * Returnerar sökbar text för ett krav (titel, referens, infoBlocks m.m.).
 * Strängen är normaliserad för accent-tolerant matchning.
 *
 * @param req - Kravobjekt
 * @param options - Alternativ
 * @returns Normaliserad sökbar text
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- kravobjekt har varierande form från regelfiler
export function get_searchable_text_for_requirement(req: any, options: SearchableRequirementOptions = {}): string {
    const { includeInfoBlocks = true, includeMetadata = false } = options;

    const searchable_fields = [
        typeof req?.title === 'string' ? req.title : '',
        typeof req?.standardReference?.text === 'string' ? req.standardReference.text : '',
        typeof req?.standardReference?.description === 'string' ? req.standardReference.description : '',
        typeof req?.reference === 'string' ? req.reference : ''
    ];

    if (includeInfoBlocks && req?.infoBlocks && typeof req.infoBlocks === 'object') {
        Object.values(req.infoBlocks as Record<string, { text?: string }>).forEach((block) => {
            if (block?.text) searchable_fields.push(block.text);
        });
    }

    if (includeInfoBlocks && (!req?.infoBlocks || Object.keys(req.infoBlocks || {}).length === 0)) {
        const legacy_fields = [
            req?.expectedObservation,
            req?.instructions,
            req?.tips,
            req?.exceptions,
            req?.commonErrors
        ];
        legacy_fields.forEach(field => {
            if (field) {
                const text = typeof field === 'object' ? field?.text : String(field);
                if (text) searchable_fields.push(text);
            }
        });
    }

    if (includeMetadata) {
        searchable_fields.push(
            extract_text(req?.metadata?.mainCategory?.text),
            extract_text(req?.metadata?.subCategory?.text),
            extract_text(req?.examples),
            extract_text(req?.classifications),
            extract_text(req?.contentType),
            extract_text(req?.checks)
        );
    }

    return prepareString(searchable_fields.filter(Boolean).join(' '));
}

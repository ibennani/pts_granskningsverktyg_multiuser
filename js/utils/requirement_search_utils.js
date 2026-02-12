/**
 * Gemensam söklogik för krav – används av kravlistor, högerspalten och regelfilsredigering.
 * Säkerställer konsekvent sökbeteende överallt.
 */

function extract_text(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        return value.map(item => extract_text(item)).join(' ');
    }
    if (typeof value === 'object') {
        const candidate_keys = ['text', 'value', 'label', 'description', 'content'];
        for (const key of candidate_keys) {
            if (value[key]) return extract_text(value[key]);
        }
        return Object.values(value).map(item => extract_text(item)).join(' ');
    }
    return String(value);
}

/**
 * Returnerar sökbar text för ett krav (titel, referens, infoBlocks m.m.).
 * Används för filtrering i kravlistor, högerspalten och regelfilsredigering.
 *
 * @param {Object} req - Kravobjekt
 * @param {Object} [options] - Alternativ
 * @param {boolean} [options.includeInfoBlocks=true] - Inkludera infoBlocks i sökningen
 * @param {boolean} [options.includeMetadata=false] - I regelfilsredigering: inkludera metadata, kategorier, kontroller m.m.
 * @returns {string} Normaliserad sökbar text (lowercase)
 */
export function get_searchable_text_for_requirement(req, options = {}) {
    const { includeInfoBlocks = true, includeMetadata = false } = options;

    const searchable_fields = [
        typeof req?.title === 'string' ? req.title : '',
        typeof req?.standardReference?.text === 'string' ? req.standardReference.text : '',
        typeof req?.standardReference?.description === 'string' ? req.standardReference.description : '',
        typeof req?.reference === 'string' ? req.reference : ''
    ];

    if (includeInfoBlocks && req?.infoBlocks && typeof req.infoBlocks === 'object') {
        Object.values(req.infoBlocks).forEach(block => {
            if (block?.text) searchable_fields.push(block.text);
        });
    }

    // Bakåtkompatibilitet: gamla fält som kan finnas i äldre regelfiler
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

    return searchable_fields.filter(Boolean).join(' ').toLowerCase();
}

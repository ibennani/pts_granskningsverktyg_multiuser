/**
 * @fileoverview Fingeravtryck och nycklar för inkrementell uppdatering av bildvyn.
 */

/**
 * @param {Array<{ reqId?: string, sample?: { id?: string }, checkId?: string, pcId?: string, filename?: string }>} images
 * @returns {string}
 */
export function build_audit_images_view_fingerprint(images) {
    const cards = group_images_for_fingerprint(images);
    return JSON.stringify(cards);
}

/**
 * @param {Array<{ reqId?: string, sample?: { id?: string }, checkId?: string, pcId?: string, filename?: string }>} images
 * @returns {Array<{ cardKey: string, reqId: string, sampleId: string, sections: Array<{ checkId: string, pcId: string, filenames: string[] }> }>}
 */
export function group_images_for_fingerprint(images) {
    const card_map = new Map();
    (images || []).forEach((item) => {
        const req_id = item?.reqId || '';
        const sample_id = item?.sample?.id || '';
        const card_key = `${req_id}::${sample_id}`;
        const section_key = `${item?.checkId || ''}::${item?.pcId || ''}`;
        if (!card_map.has(card_key)) {
            card_map.set(card_key, { cardKey: card_key, reqId: req_id, sampleId: sample_id, sections: new Map() });
        }
        const card = card_map.get(card_key);
        if (!card.sections.has(section_key)) {
            card.sections.set(section_key, {
                checkId: item?.checkId || '',
                pcId: item?.pcId || '',
                filenames: []
            });
        }
        if (item?.filename) {
            card.sections.get(section_key).filenames.push(item.filename);
        }
    });

    return [...card_map.values()]
        .sort((a, b) => a.cardKey.localeCompare(b.cardKey, 'sv'))
        .map((card) => ({
            cardKey: card.cardKey,
            reqId: card.reqId,
            sampleId: card.sampleId,
            sections: [...card.sections.values()]
                .sort((a, b) => `${a.checkId}::${a.pcId}`.localeCompare(`${b.checkId}::${b.pcId}`, 'sv'))
                .map((section) => ({
                    checkId: section.checkId,
                    pcId: section.pcId,
                    filenames: [...section.filenames].sort((a, b) => a.localeCompare(b, 'sv'))
                }))
        }));
}

export function build_audit_images_structure_fingerprint(images) {
    const cards = group_images_for_fingerprint(images);
    return JSON.stringify(cards.map((card) => ({
        cardKey: card.cardKey,
        sections: card.sections.map((section) => ({
            checkId: section.checkId,
            pcId: section.pcId
        }))
    })));
}

/**
 * @param {string} fingerprint_a
 * @param {string} fingerprint_b
 * @returns {boolean}
 */
export function audit_images_card_structure_unchanged(fingerprint_a, fingerprint_b) {
    if (!fingerprint_a || !fingerprint_b) return false;
    try {
        const a = JSON.parse(fingerprint_a);
        const b = JSON.parse(fingerprint_b);
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((card, index) => card.cardKey === b[index]?.cardKey
            && JSON.stringify(card.sections.map((s) => `${s.checkId}::${s.pcId}`))
            === JSON.stringify(b[index]?.sections.map((s) => `${s.checkId}::${s.pcId}`)));
    } catch {
        return false;
    }
}

/**
 * @param {(key: string, replacements?: Record<string, string>) => string} t
 * @param {number|string} count
 * @returns {string}
 */
export function get_audit_images_card_count_label(t, count) {
    const numeric_count = Number(count);
    if (numeric_count === 1) {
        return t('audit_images_card_count_singular');
    }
    return t('audit_images_card_count_plural', { count: String(numeric_count) });
}

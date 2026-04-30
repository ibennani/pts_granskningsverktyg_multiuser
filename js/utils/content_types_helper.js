// js/utils/content_types_helper.js

import { RequirementLookup, normalize_requirements_to_record } from '../logic/requirement_lookup.js';

/**
 * Räknar antal unika krav som är kopplade till en innehållstyp (parent + alla underkategorier).
 * @param {Object} ruleFileContent - Innehåller requirements
 * @param {Object} parentContentType - Parent med { id, types: [{ id }] }
 * @returns {number} Antal unika krav som refererar denna innehållstyp eller någon underkategori
 */
export function get_requirements_count_for_parent_content_type(ruleFileContent, parentContentType) {
    if (!ruleFileContent?.requirements) return 0;
    const ids_to_check = new Set();
    if (parentContentType?.id) ids_to_check.add(parentContentType.id);
    (parentContentType?.types || []).forEach(child => {
        if (child?.id) ids_to_check.add(child.id);
    });
    const req_ids = new Set();
    for (const id of ids_to_check) {
        const refs = get_requirements_by_content_type_id(ruleFileContent, id);
        refs.forEach(({ id: reqId }) => req_ids.add(reqId));
    }
    return req_ids.size;
}

/**
 * Räknar antal krav som är kopplade till en underkategori (content type).
 * @param {Object} ruleFileContent - Innehåller requirements
 * @param {string} contentTypeId - Underkategori-id (t.ex. "teknisk-grundstruktur-roller-och-egenskaper-i-koden")
 * @returns {number} Antal krav som har denna underkategori i contentType
 */
export function get_requirements_count_by_content_type_id(ruleFileContent, contentTypeId) {
    if (!ruleFileContent?.requirements || !contentTypeId) return 0;
    const look = RequirementLookup.from(ruleFileContent.requirements);
    if (!look) return 0;
    return look.entries().filter(([, req]) => {
        const ct = req.contentType;
        return Array.isArray(ct) && ct.includes(contentTypeId);
    }).length;
}

/**
 * Returnerar alla krav som refererar en underkategori.
 * @param {Object} ruleFileContent - Innehåller requirements
 * @param {string} contentTypeId - Underkategori-id
 * @returns {Array<{id: string, requirement: Object}>} Array med { id, requirement }
 */
export function get_requirements_by_content_type_id(ruleFileContent, contentTypeId) {
    if (!ruleFileContent?.requirements || !contentTypeId) return [];
    const look = RequirementLookup.from(ruleFileContent.requirements);
    if (!look) return [];
    return look
        .entries()
        .filter(([, req]) => {
            const ct = req.contentType;
            return Array.isArray(ct) && ct.includes(contentTypeId);
        })
        .map(([storage_key, req]) => ({
            id: String(req.key ?? req.id ?? storage_key),
            requirement: req
        }));
}

/**
 * Tar bort en underkategori-id från alla krav som refererar den.
 * Returnerar uppdaterad ruleFileContent med modifierade requirements.
 * @param {Object} ruleFileContent - Hela regelfilens innehåll
 * @param {string} contentTypeId - Underkategori-id som ska tas bort
 * @returns {Object} Ny ruleFileContent med uppdaterade requirements
 */
export function remove_content_type_from_requirements(ruleFileContent, contentTypeId) {
    if (!ruleFileContent?.requirements || !contentTypeId) return ruleFileContent;
    const raw = ruleFileContent.requirements;
    const look = RequirementLookup.from(raw);
    if (!look) return ruleFileContent;
    const is_array = look.isArrayFormat();
    const rec = normalize_requirements_to_record(raw);
    const newRequirements = { ...rec };
    for (const [reqId, req] of Object.entries(newRequirements)) {
        if (!req || typeof req !== 'object') continue;
        if (!Array.isArray(req.contentType)) continue;
        const idx = req.contentType.indexOf(contentTypeId);
        if (idx === -1) continue;
        const updatedCt = [...req.contentType];
        updatedCt.splice(idx, 1);
        newRequirements[reqId] = { ...req, contentType: updatedCt };
    }
    if (is_array && Array.isArray(raw)) {
        const updatedArr = raw.map((r) => {
            if (!r || typeof r !== 'object') return r;
            const k = String(r.key ?? r.id ?? '');
            return newRequirements[k] !== undefined ? newRequirements[k] : r;
        });
        return { ...ruleFileContent, requirements: updatedArr };
    }
    return { ...ruleFileContent, requirements: newRequirements };
}

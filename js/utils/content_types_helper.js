// js/utils/content_types_helper.js

/**
 * Räknar antal krav som är kopplade till en underkategori (content type).
 * @param {Object} ruleFileContent - Innehåller requirements
 * @param {string} contentTypeId - Underkategori-id (t.ex. "teknisk-grundstruktur-roller-och-egenskaper-i-koden")
 * @returns {number} Antal krav som har denna underkategori i contentType
 */
export function get_requirements_count_by_content_type_id(ruleFileContent, contentTypeId) {
    if (!ruleFileContent?.requirements || !contentTypeId) return 0;
    const requirements = Object.values(ruleFileContent.requirements);
    return requirements.filter(req => {
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
    return Object.entries(ruleFileContent.requirements).filter(([, req]) => {
        const ct = req.contentType;
        return Array.isArray(ct) && ct.includes(contentTypeId);
    }).map(([id, req]) => ({ id, requirement: req }));
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
    const newRequirements = { ...ruleFileContent.requirements };
    for (const [reqId, req] of Object.entries(newRequirements)) {
        if (!Array.isArray(req.contentType)) continue;
        const idx = req.contentType.indexOf(contentTypeId);
        if (idx === -1) continue;
        const updatedCt = [...req.contentType];
        updatedCt.splice(idx, 1);
        newRequirements[reqId] = { ...req, contentType: updatedCt };
    }
    return { ...ruleFileContent, requirements: newRequirements };
}

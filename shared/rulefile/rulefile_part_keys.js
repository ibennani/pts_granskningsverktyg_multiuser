/**
 * Stabilt nyckelformat för del-sparning och fältlås i regelfilsredigering.
 * Kan köras i Node och webbläsare (ingen DOM).
 *
 * Format (v1):
 * - metadata
 * - reportTemplate
 * - req:{requirement_key}
 * - req:{requirement_key}:infoBlocks:{block_id}:text
 *
 * Obs: requirement_key är samma nyckel som i ruleFileContent.requirements (inte requirement.id).
 */

/**
 * @param {string} requirement_key
 * @returns {string}
 */
export function make_requirement_part_key(requirement_key) {
    return `req:${String(requirement_key)}`;
}

/**
 * @param {string} requirement_key
 * @param {string} block_id
 * @returns {string}
 */
export function make_infoblock_text_part_key(requirement_key, block_id) {
    return `req:${String(requirement_key)}:infoBlocks:${String(block_id)}:text`;
}

/**
 * @param {unknown} part_key
 * @returns {{ kind: 'metadata'|'reportTemplate'|'req'|'infoblock_text', requirement_key?: string, block_id?: string }|null}
 */
export function parse_part_key(part_key) {
    const s = String(part_key || '');
    if (s === 'metadata') return { kind: 'metadata' };
    if (s === 'reportTemplate') return { kind: 'reportTemplate' };
    if (s.startsWith('req:')) {
        const rest = s.slice(4);
        if (!rest) return null;
        const parts = rest.split(':');
        const requirement_key = parts[0];
        if (!requirement_key) return null;
        if (parts.length === 1) return { kind: 'req', requirement_key };
        if (parts.length === 4 && parts[1] === 'infoBlocks' && parts[3] === 'text') {
            const block_id = parts[2];
            if (!block_id) return null;
            return { kind: 'infoblock_text', requirement_key, block_id };
        }
        return null;
    }
    return null;
}

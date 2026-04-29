// @ts-nocheck
/**
 * @file Rensar duplicerade resultatnycklar när canonical map-nyckel används i requirementResults.
 */

/**
 * Tar bort duplicerat lagert under publikt id när resultatet flyttats till map-nyckel.
 * @param {Record<string, unknown>} new_results
 * @param {unknown} map_key
 * @param {{ key?: unknown, id?: unknown }} req_def
 */
export function remove_stale_requirement_result_aliases(new_results, map_key, req_def) {
    if (!new_results || map_key == null) return;
    const mk = String(map_key);
    for (const pk of [req_def.key, req_def.id]) {
        if (pk == null) continue;
        const s = String(pk);
        if (s !== mk && Object.prototype.hasOwnProperty.call(new_results, s)) {
            delete new_results[s];
        }
    }
}

/**
 * @fileoverview Stabila nycklar för kravkopplings-kryssrutor.
 */
export function build_mapping_checkbox_key(req_key: string, concept_id: string): string {
    return `${req_key}::${concept_id}`;
}

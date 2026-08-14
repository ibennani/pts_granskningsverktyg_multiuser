/**
 * @fileoverview Server: hitta regelfilsrad för granskningstyp-overlay.
 */

import {
    filter_rule_set_id_candidates_to_known,
    pick_published_rule_row_by_monitoring_kind,
    read_rule_set_id_candidates,
    resolve_monitoring_kind_from_rule_content,
} from '../../shared/audit/audit_type_rule_set_resolve.js';
import { parse_rule_content_value } from '../../shared/audit/audit_type_catalog.js';
import { fetch_rule_set_by_id, fetch_rule_sets_list } from '../repositories/rule_repository.js';

/**
 * @param {unknown} rule_file_content
 * @param {string|null|undefined} audit_rule_set_id
 * @returns {Promise<Record<string, unknown>|null>}
 */
export async function resolve_rule_set_row_for_audit_overlay(
    rule_file_content,
    audit_rule_set_id = null
) {
    const parsed = parse_rule_content_value(rule_file_content);
    if (!parsed) return null;

    const list = await fetch_rule_sets_list();
    const candidates = filter_rule_set_id_candidates_to_known(
        read_rule_set_id_candidates(audit_rule_set_id, parsed),
        list.rows
    );
    for (const id of candidates) {
        const result = await fetch_rule_set_by_id(id);
        if (result.rows[0]) return result.rows[0];
    }

    const kind = resolve_monitoring_kind_from_rule_content(parsed);
    if (kind === 'unknown') return null;

    const match = pick_published_rule_row_by_monitoring_kind(list.rows, kind);
    if (!match?.id) return null;

    const result = await fetch_rule_set_by_id(match.id);
    return result.rows[0] || null;
}

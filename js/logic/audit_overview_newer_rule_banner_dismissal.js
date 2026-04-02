/**
 * Nyckel och jämförelse för att dölja granskningsöversiktens banner om nyare regelfil
 * tills servern erbjuder en högre metadata_version än den användaren avvisat.
 */
import { version_greater_than } from '../utils/version_utils.js';

/**
 * @param {string|number|null|undefined} audit_id
 * @param {string|null|undefined} rule_set_id
 * @returns {string}
 */
export function newer_rule_banner_dismissal_storage_key(audit_id, rule_set_id) {
    const a = audit_id != null && audit_id !== '' ? String(audit_id) : 'local';
    const r = rule_set_id != null && rule_set_id !== '' ? String(rule_set_id) : 'none';
    return `auditOverviewNewerRuleDismissed:${a}:${r}`;
}

/**
 * @param {string} offered_version - Erbjuden version från find_newer_rule_for_audit
 * @param {string|null} stored_version - Sparad sträng från sessionStorage
 * @returns {boolean}
 */
export function should_show_newer_rule_banner(offered_version, stored_version) {
    if (!offered_version) return false;
    if (!stored_version) return true;
    return version_greater_than(offered_version, stored_version);
}

/**
 * Kontrollerar om det finns en nyare regelfil på servern än den i granskningen.
 * @param {object} ruleFileContent - Granskningens ruleFileContent
 * @param {Array} rules - Lista från get_rules()
 * @param {function} version_greater_than - Versionsjämförelse
 * @param {string|null|undefined} [ruleSetId] - Granskningens rule_set_id; om satt används endast denna regel för matchning
 * @returns {{ ruleId: string, version: string } | null}
 */
export function find_newer_rule_for_audit(ruleFileContent, rules, version_greater_than, ruleSetId) {
    if (!ruleFileContent || !Array.isArray(rules) || rules.length === 0) return null;
    const audit_version = (ruleFileContent?.metadata?.version?.trim?.() || '').trim();
    if (audit_version === '') return null;

    if (ruleSetId) {
        const r = rules.find((rule) => rule.id === ruleSetId);
        if (!r) return null;
        const server_version = r.metadata_version || '';
        if (version_greater_than(server_version, audit_version)) {
            return { ruleId: r.id, version: server_version };
        }
        return null;
    }

    const audit_title = (ruleFileContent?.metadata?.title?.trim?.() || '').toLowerCase();
    const audit_monitoring = (ruleFileContent?.metadata?.monitoringType?.text?.trim?.() || '').toLowerCase();
    const audit_ids = [audit_title, audit_monitoring].filter(Boolean);
    if (audit_ids.length === 0) return null;
    let best_newer = null;
    for (const r of rules) {
        const rule_name = (r.name || '').trim().toLowerCase();
        const rule_monitoring = (r.monitoring_type_text || '').trim().toLowerCase();
        const rule_ids = [rule_name, rule_monitoring].filter(Boolean);
        const matches = audit_ids.some(aid => rule_ids.some(rid => rid === aid));
        if (!matches) continue;
        const server_version = r.metadata_version || '';
        if (version_greater_than(server_version, audit_version)) {
            if (!best_newer || version_greater_than(server_version, best_newer.version)) {
                best_newer = { ruleId: r.id, version: server_version };
            }
        }
    }
    return best_newer;
}

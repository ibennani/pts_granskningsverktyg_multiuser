/**
 * Bygger relevant_ids_by_sample och filtrerar entries i alla-läge.
 * @module js/components/requirements_list/requirement_list_all_mode_data
 */

/**
 * @param {object} state
 * @param {Array} entries Resultat av get_requirements_entries
 * @param {object} AuditLogic
 * @returns {{ entries: Array, relevant_ids_by_sample: Map<string, Set<string>> }}
 */
export function build_all_mode_data(state, entries, AuditLogic) {
    const rule_file_content = state?.ruleFileContent;
    const samples = state?.samples || [];

    const can_use_audit_logic = Boolean(
        AuditLogic &&
        typeof AuditLogic.get_relevant_requirements_for_sample === 'function' &&
        rule_file_content
    );

    const relevant_ids_by_sample = new Map();
    samples.forEach(sample => {
        const set_for_sample = new Set();

        if (can_use_audit_logic) {
            const relevant_reqs = AuditLogic.get_relevant_requirements_for_sample(rule_file_content, sample);
            (relevant_reqs || []).forEach(req => {
                const req_id = req?.key || req?.id;
                if (req_id) set_for_sample.add(String(req_id));
            });
        } else {
            const req_results = sample?.requirementResults;
            if (req_results && typeof req_results === 'object') {
                Object.keys(req_results).forEach(req_id => set_for_sample.add(String(req_id)));
            }
        }

        if (sample?.id) {
            relevant_ids_by_sample.set(sample.id, set_for_sample);
        }
    });

    const requirement_ids_in_samples = new Set();
    relevant_ids_by_sample.forEach(set_for_sample => {
        set_for_sample.forEach(req_id => requirement_ids_in_samples.add(req_id));
    });

    const entry_matches_any_sample = (req_id, req) => {
        const candidates = new Set([String(req_id)]);
        if (req?.key) candidates.add(String(req.key));
        if (req?.id) candidates.add(String(req.id));
        return [...candidates].some(id => requirement_ids_in_samples.has(id));
    };

    const filtered_entries = entries.filter(([req_id, req]) => entry_matches_any_sample(req_id, req));

    return { entries: filtered_entries, relevant_ids_by_sample };
}

// js/logic/audit_part_keys.js
//
// Stabilt nyckelformat för del-sparning och fältlås i granskningar.
//
// Format (v1):
// - audit:{auditId}:sample:{sampleId}:req:{requirementId}:commentToAuditor
// - audit:{auditId}:sample:{sampleId}:req:{requirementId}:commentToActor
// - audit:{auditId}:sample:{sampleId}:req:{requirementId}:stuckProblemDescription
// - audit:{auditId}:sample:{sampleId}:req:{requirementId}:check:{checkId}:pc:{pcId}:observationDetail
//
// Obs: `requirementId` är samma som används i route-parametern (req_key) i UI.

/**
 * @param {string} audit_id
 * @param {string} sample_id
 * @param {string} requirement_id
 * @param {'commentToAuditor'|'commentToActor'|'stuckProblemDescription'} field
 * @returns {string}
 */
export function make_requirement_text_part_key(audit_id, sample_id, requirement_id, field) {
    return `audit:${String(audit_id)}:sample:${String(sample_id)}:req:${String(requirement_id)}:${String(field)}`;
}

/**
 * @param {string} audit_id
 * @param {string} sample_id
 * @param {string} requirement_id
 * @param {string} check_id
 * @param {string} pc_id
 * @returns {string}
 */
export function make_observation_detail_part_key(audit_id, sample_id, requirement_id, check_id, pc_id) {
    return `audit:${String(audit_id)}:sample:${String(sample_id)}:req:${String(requirement_id)}:check:${String(check_id)}:pc:${String(pc_id)}:observationDetail`;
}

/**
 * @param {unknown} part_key
 * @returns {{ kind: 'req_text'|'observation_detail', audit_id: string, sample_id: string, requirement_id: string, field?: string, check_id?: string, pc_id?: string }|null}
 */
export function parse_audit_part_key(part_key) {
    const s = String(part_key || '');
    if (!s.startsWith('audit:')) return null;
    const parts = s.split(':');
    // audit:{auditId}:sample:{sampleId}:req:{requirementId}:commentToAuditor
    if (parts.length === 7 && parts[0] === 'audit' && parts[2] === 'sample' && parts[4] === 'req') {
        const audit_id = parts[1];
        const sample_id = parts[3];
        const requirement_id = parts[5];
        const field = parts[6];
        if (!audit_id || !sample_id || !requirement_id || !field) return null;
        if (field !== 'commentToAuditor' && field !== 'commentToActor' && field !== 'stuckProblemDescription') return null;
        return { kind: 'req_text', audit_id, sample_id, requirement_id, field };
    }
    // audit:{auditId}:sample:{sampleId}:req:{requirementId}:check:{checkId}:pc:{pcId}:observationDetail
    if (parts.length === 11 && parts[0] === 'audit' && parts[2] === 'sample' && parts[4] === 'req' && parts[6] === 'check' && parts[8] === 'pc') {
        const audit_id = parts[1];
        const sample_id = parts[3];
        const requirement_id = parts[5];
        const check_id = parts[7];
        const pc_id = parts[9];
        const field = parts[10];
        if (!audit_id || !sample_id || !requirement_id || !check_id || !pc_id || !field) return null;
        if (field !== 'observationDetail') return null;
        return { kind: 'observation_detail', audit_id, sample_id, requirement_id, check_id, pc_id };
    }
    return null;
}


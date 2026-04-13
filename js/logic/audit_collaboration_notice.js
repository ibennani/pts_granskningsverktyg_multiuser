/**
 * Notislogik för granskning när servern har en nyare version:
 * visa notis endast om användaren har osparat i exakt den cell (stickprov+krav)
 * som den inkommande uppdateringen berör.
 *
 * Baseline spåras per (auditId, sampleId, resolvedRequirementKey) och uppdateras
 * när vi vet att lokalt innehåll motsvarar servern (efter lyckad sync/omladdning).
 *
 * @module js/logic/audit_collaboration_notice
 */

/** @type {Map<string, string>} */
const baseline_serial_by_key = new Map();

/**
 * @param {unknown} v
 * @returns {string}
 */
function to_serial(v) {
    try {
        return JSON.stringify(v === undefined ? null : v);
    } catch {
        return 'null';
    }
}

/**
 * @param {string} audit_id
 * @param {string} sample_id
 * @param {string} req_key
 * @returns {string}
 */
function make_key(audit_id, sample_id, req_key) {
    return `${String(audit_id)}\u0000${String(sample_id)}\u0000${String(req_key)}`;
}

/**
 * Nollställer alla baselines (används i enhetstester).
 */
export function clear_all_audit_baselines_for_testing() {
    baseline_serial_by_key.clear();
}

/**
 * @returns {{ sample_id: string, req_param: string }|null}
 */
function get_focus_from_window() {
    if (typeof window === 'undefined') return null;
    if (String(window.__gv_current_view_name || '') !== 'requirement_audit') return null;
    let params = {};
    try {
        params = JSON.parse(window.__gv_current_view_params_json || '{}');
    } catch {
        return null;
    }
    const sid = params.sampleId ?? params.s;
    const rid = params.requirementId ?? params.r;
    if (sid === undefined || sid === null || sid === '') return null;
    if (rid === undefined || rid === null || rid === '') return null;
    return { sample_id: String(sid), req_param: String(rid) };
}

/**
 * @param {object|null|undefined} sample
 * @param {string} req_param
 * @param {object|null|undefined} requirements_map
 * @returns {string}
 */
function resolve_requirement_result_key(sample, req_param, requirements_map) {
    const results = sample && typeof sample.requirementResults === 'object' ? sample.requirementResults : {};
    const rp = String(req_param || '');
    if (rp !== '' && Object.prototype.hasOwnProperty.call(results, rp)) return rp;
    const reqs = requirements_map && typeof requirements_map === 'object' ? requirements_map : {};
    for (const k of Object.keys(reqs)) {
        const def = reqs[k];
        if (!def || typeof def !== 'object') continue;
        const key = def.key !== undefined && def.key !== null ? String(def.key) : '';
        const id = def.id !== undefined && def.id !== null ? String(def.id) : '';
        if (key === rp || id === rp || String(k) === rp) {
            if (Object.prototype.hasOwnProperty.call(results, k)) return k;
        }
    }
    return rp;
}

/**
 * @param {object|null|undefined} state
 * @param {string} sample_id
 * @param {string} req_param
 * @returns {{ resolved_key: string, result: unknown }|null}
 */
function get_focus_cell(state, sample_id, req_param) {
    const samples = Array.isArray(state?.samples) ? state.samples : [];
    const sample = samples.find((s) => s && String(s.id) === String(sample_id));
    if (!sample) return null;
    const req_map = state?.ruleFileContent?.requirements;
    const resolved_key = resolve_requirement_result_key(sample, req_param, req_map);
    const results = sample.requirementResults || {};
    return { resolved_key, result: results[resolved_key] };
}

/**
 * Sätter baseline för aktuell fokus-cell (används t.ex. när man navigerar in i ett krav).
 * @param {object|null|undefined} state
 */
export function establish_baseline_for_current_audit_focus(state) {
    if (!state?.auditId) return;
    const focus = get_focus_from_window();
    if (!focus) return;
    const cell = get_focus_cell(state, focus.sample_id, focus.req_param);
    if (!cell) return;
    baseline_serial_by_key.set(make_key(state.auditId, focus.sample_id, cell.resolved_key), to_serial(cell.result));
}

/**
 * Uppdaterar baseline från ett full_state som kommer från servern (efter poll, 409-omladdning, lyckad sparning).
 * @param {object|null|undefined} full_state
 */
export function update_baseline_from_server_full_state(full_state) {
    if (!full_state?.auditId) return;
    const focus = get_focus_from_window();
    if (!focus) return;
    const cell = get_focus_cell(full_state, focus.sample_id, focus.req_param);
    if (!cell) return;
    baseline_serial_by_key.set(make_key(full_state.auditId, focus.sample_id, cell.resolved_key), to_serial(cell.result));
}

/**
 * @param {{ local_state: object, remote_state: object }} args
 * @returns {boolean}
 */
export function should_show_audit_collaboration_notice(args) {
    const { local_state, remote_state } = args;
    if (!local_state || !remote_state) return false;
    if (String(local_state.auditId || '') === '' || String(remote_state.auditId || '') === '') return false;
    if (String(local_state.auditId) !== String(remote_state.auditId)) return false;

    const focus = get_focus_from_window();
    if (!focus) return false;
    const local_cell = get_focus_cell(local_state, focus.sample_id, focus.req_param);
    const remote_cell = get_focus_cell(remote_state, focus.sample_id, focus.req_param);
    if (!local_cell || !remote_cell) return false;

    const bkey = make_key(String(local_state.auditId), focus.sample_id, local_cell.resolved_key);
    const baseline_serial = baseline_serial_by_key.get(bkey);
    if (baseline_serial === undefined) return false;

    const local_serial = to_serial(local_cell.result);
    const remote_serial = to_serial(remote_cell.result);
    const dirty = local_serial !== baseline_serial;
    const incoming = local_serial !== remote_serial;
    return dirty && incoming;
}


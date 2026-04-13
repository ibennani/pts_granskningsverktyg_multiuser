/**
 * Notislogik för regelfilsredigering:
 * visa notis endast om användaren har osparat utkast i aktuell del (dirty mot baseline)
 * och servern skickar ändring i samma del (incoming).
 *
 * Baseline spåras per (ruleSetId, partKey) där partKey kan vara:
 * - 'metadata'
 * - 'reportTemplate'
 * - `req:${requirementKey}`
 *
 * @module js/logic/rulefile_collaboration_notice
 */

/** @type {Map<string, string>} */
const baseline_serial_by_part = new Map();

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
 * @param {string} rule_set_id
 * @param {string} part_key
 * @returns {string}
 */
function make_key(rule_set_id, part_key) {
    return `${String(rule_set_id)}\u0000${String(part_key)}`;
}

/**
 * @returns {{ view_name: string, params: Record<string, unknown> }|null}
 */
function get_rulefile_view_and_params_from_window() {
    if (typeof window === 'undefined') return null;
    const view_name = String(window.__gv_current_view_name || '');
    if (view_name === '') return null;
    let params = {};
    try {
        params = JSON.parse(window.__gv_current_view_params_json || '{}');
    } catch {
        params = {};
    }
    return { view_name, params };
}

/**
 * @param {object|null|undefined} requirements
 * @param {string} req_param
 * @returns {string}
 */
function resolve_requirement_key(requirements, req_param) {
    const reqs = requirements && typeof requirements === 'object' ? requirements : {};
    const rp = String(req_param || '');
    if (rp !== '' && Object.prototype.hasOwnProperty.call(reqs, rp)) return rp;
    for (const k of Object.keys(reqs)) {
        const def = reqs[k];
        if (!def || typeof def !== 'object') continue;
        const key = def.key !== undefined && def.key !== null ? String(def.key) : '';
        const id = def.id !== undefined && def.id !== null ? String(def.id) : '';
        if (key === rp || id === rp) return k;
    }
    return rp;
}

/**
 * @param {string} view_name
 * @param {Record<string, unknown>} params
 * @param {object|null|undefined} rulefile_content
 * @returns {string[]}
 */
function get_focus_part_keys(view_name, params, rulefile_content) {
    const parts = [];
    const v = String(view_name || '');
    const content = rulefile_content && typeof rulefile_content === 'object' ? rulefile_content : {};
    const requirements = content.requirements;

    if (v === 'rulefile_view_requirement' || v === 'rulefile_edit_requirement' || v === 'rulefile_add_requirement') {
        const rid = params.requirementId ?? params.r;
        if (rid !== undefined && rid !== null && rid !== '') {
            const rk = resolve_requirement_key(requirements, String(rid));
            if (rk) parts.push(`req:${rk}`);
        }
        return parts;
    }
    if (v === 'rulefile_metadata_edit' || v === 'rulefile_sections_edit_general' || v === 'edit_rulefile_main') {
        parts.push('metadata');
    }
    if (v === 'rulefile_sections_edit_general') {
        parts.push('reportTemplate');
    }
    if (parts.length > 0) return parts;

    // Övriga regelfilsvyer (listor m.m.) – om användaren har osparat någonstans räcker en notis.
    parts.push('metadata', 'reportTemplate');
    const reqs = requirements && typeof requirements === 'object' ? requirements : {};
    for (const k of Object.keys(reqs)) parts.push(`req:${k}`);
    return parts;
}

/**
 * @param {object|null|undefined} rulefile_content
 * @param {string} part_key
 * @returns {unknown}
 */
function get_part_value(rulefile_content, part_key) {
    const content = rulefile_content && typeof rulefile_content === 'object' ? rulefile_content : {};
    if (part_key === 'metadata') return content.metadata;
    if (part_key === 'reportTemplate') return content.reportTemplate;
    if (part_key.startsWith('req:')) {
        const rk = part_key.slice(4);
        const reqs = content.requirements && typeof content.requirements === 'object' ? content.requirements : {};
        return reqs[rk];
    }
    return undefined;
}

/**
 * Säkerställer baseline för fokusdel(ar) om den saknas (t.ex. när vyn öppnas första gången).
 * @param {object|null|undefined} state
 */
export function ensure_rulefile_baseline_for_current_focus(state) {
    if (!state?.ruleSetId || !state?.ruleFileContent) return;
    const ctx = get_rulefile_view_and_params_from_window();
    if (!ctx) return;
    const parts = get_focus_part_keys(ctx.view_name, ctx.params, state.ruleFileContent);
    parts.forEach((part_key) => {
        const k = make_key(state.ruleSetId, part_key);
        if (baseline_serial_by_part.has(k)) return;
        baseline_serial_by_part.set(k, to_serial(get_part_value(state.ruleFileContent, part_key)));
    });
}

/**
 * Uppdaterar baseline för fokusdel(ar) från serverns content (efter poll/lyckad PUT).
 * @param {string} rule_set_id
 * @param {object|null|undefined} remote_content
 */
export function update_rulefile_baseline_from_remote(rule_set_id, remote_content) {
    if (!rule_set_id || !remote_content) return;
    const ctx = get_rulefile_view_and_params_from_window();
    if (!ctx) return;
    const parts = get_focus_part_keys(ctx.view_name, ctx.params, remote_content);
    parts.forEach((part_key) => {
        baseline_serial_by_part.set(make_key(rule_set_id, part_key), to_serial(get_part_value(remote_content, part_key)));
    });
}

/**
 * @param {{ local_state: object, remote_content: object }} args
 * @returns {boolean}
 */
export function should_show_rulefile_collaboration_notice(args) {
    const { local_state, remote_content } = args;
    if (!local_state?.ruleSetId || !local_state?.ruleFileContent || !remote_content) return false;
    const ctx = get_rulefile_view_and_params_from_window();
    if (!ctx) return false;

    const parts = get_focus_part_keys(ctx.view_name, ctx.params, local_state.ruleFileContent);
    for (const part_key of parts) {
        const bkey = make_key(local_state.ruleSetId, part_key);
        const baseline_serial = baseline_serial_by_part.get(bkey);
        if (baseline_serial === undefined) continue;
        const local_serial = to_serial(get_part_value(local_state.ruleFileContent, part_key));
        const remote_serial = to_serial(get_part_value(remote_content, part_key));
        const dirty = local_serial !== baseline_serial;
        const incoming = local_serial !== remote_serial;
        if (dirty && incoming) return true;
    }
    return false;
}

/**
 * Nollställer alla baselines (används i enhetstester).
 */
export function clear_all_rulefile_baselines_for_testing() {
    baseline_serial_by_part.clear();
}


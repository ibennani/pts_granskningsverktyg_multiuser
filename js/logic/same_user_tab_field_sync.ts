// @ts-nocheck
/**
 * Synkar textarea-innehåll mellan flikar för samma inloggade användare (BroadcastChannel).
 * Olika användare påverkas inte — de följer server/lås som tidigare.
 */

import { parse_audit_part_key } from './audit_part_keys.js';
import { parse_part_key as parse_rulefile_part_key } from './rulefile_part_keys.js';
import {
    find_requirement_definition,
    get_stored_requirement_result_for_def,
    resolve_requirement_map_key
} from '../audit_logic.js';

const CHANNEL_NAME = 'gv-same-user-field-sync';

let _channel = null;
let _tab_origin_id = null;

function get_tab_origin_id() {
    if (_tab_origin_id) return _tab_origin_id;
    try {
        const k = 'gv_tab_sync_origin';
        let id = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(k) : null;
        if (!id) {
            id = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            sessionStorage.setItem(k, id);
        }
        _tab_origin_id = id;
    } catch {
        _tab_origin_id = `t-${Date.now()}`;
    }
    return _tab_origin_id;
}

function safe_attr_escape(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(String(value));
    }
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Skickar värde till andra flikar (samma origin) efter blur/sparning.
 * @param {{ userName: string, auditId?: string|null, ruleSetId?: string|null, partKey: string, value: string }} payload
 */
export function post_same_user_field_commit(payload) {
    if (typeof BroadcastChannel === 'undefined') return;
    const { userName, auditId, ruleSetId, partKey, value } = payload;
    if (!userName || !partKey) return;
    if (!_channel) {
        _channel = new BroadcastChannel(CHANNEL_NAME);
    }
    _channel.postMessage({
        v: 1,
        originId: get_tab_origin_id(),
        userName: String(userName),
        auditId: auditId != null ? String(auditId) : null,
        ruleSetId: ruleSetId != null ? String(ruleSetId) : null,
        partKey: String(partKey),
        value: typeof value === 'string' ? value : String(value ?? '')
    });
}

/** Exporteras för enhetstester */
export function merge_audit_result_from_broadcast(state, parsed, value) {
    const sample_id = parsed.sample_id;
    const req_id = parsed.requirement_id;
    const sample = state.samples?.find((s) => String(s.id) === String(sample_id));
    if (!sample) return null;
    const requirements = state.ruleFileContent?.requirements;
    const req_def = requirements ? find_requirement_definition(requirements, req_id) : null;
    const stored_base = req_def
        ? get_stored_requirement_result_for_def(
            sample.requirementResults,
            requirements,
            req_def,
            req_id
        )
        : sample.requirementResults?.[req_id];
    const save_key = req_def && requirements && !Array.isArray(requirements)
        ? (resolve_requirement_map_key(requirements, req_def.key || req_def.id)
            || String(req_def.key ?? req_def.id ?? req_id))
        : String(req_id);
    const cur = stored_base ? JSON.parse(JSON.stringify(stored_base)) : {};
    if (parsed.kind === 'req_text') {
        cur[parsed.field] = value;
    } else if (parsed.kind === 'observation_detail') {
        if (!cur.checkResults) cur.checkResults = {};
        if (!cur.checkResults[parsed.check_id]) cur.checkResults[parsed.check_id] = { passCriteria: {} };
        if (!cur.checkResults[parsed.check_id].passCriteria) cur.checkResults[parsed.check_id].passCriteria = {};
        const prev_pc = cur.checkResults[parsed.check_id].passCriteria[parsed.pc_id] || {};
        cur.checkResults[parsed.check_id].passCriteria[parsed.pc_id] = {
            ...prev_pc,
            observationDetail: value
        };
    } else {
        return null;
    }
    return { sampleId: sample_id, requirementId: save_key, newRequirementResult: cur };
}

/** Exporteras för enhetstester */
export function merge_rulefile_infoblock(state, requirement_key, block_id, value) {
    const req = state.ruleFileContent?.requirements?.[requirement_key];
    if (!req) return null;
    const updated = JSON.parse(JSON.stringify(req));
    if (!updated.infoBlocks) updated.infoBlocks = {};
    if (!updated.infoBlocks[block_id]) {
        updated.infoBlocks[block_id] = { name: '', expanded: true, text: '' };
    }
    updated.infoBlocks[block_id] = {
        ...updated.infoBlocks[block_id],
        text: value
    };
    return { requirementId: requirement_key, updatedRequirementData: updated };
}

function sync_textareas_in_dom(part_key, value) {
    const sel = `textarea[data-gv-audit-part-key="${safe_attr_escape(part_key)}"],textarea[data-gv-rule-part-key="${safe_attr_escape(part_key)}"]`;
    try {
        document.querySelectorAll(sel).forEach((el) => {
            if (el && el.tagName === 'TEXTAREA') {
                el.value = value;
            }
        });
    } catch {
        /* ignoreras */
    }
}

/**
 * Prenumeration: uppdaterar state + DOM när annan flik med samma användare sparat fält.
 * @param {{ getState: function, dispatch: function, StoreActionTypes: object, get_current_user_name: function }} deps
 * @returns {function(): void} avprenumerera
 */
export function init_same_user_tab_field_sync_listener(deps) {
    if (typeof BroadcastChannel === 'undefined') {
        return () => {};
    }
    const { getState, dispatch, StoreActionTypes, get_current_user_name } = deps;
    if (typeof getState !== 'function' || typeof dispatch !== 'function' || !StoreActionTypes) {
        return () => {};
    }
    const bc = new BroadcastChannel(CHANNEL_NAME);
    const my_origin = get_tab_origin_id();

    bc.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || msg.v !== 1 || !msg.partKey) return;
        if (msg.originId === my_origin) return;
        const local_user = typeof get_current_user_name === 'function' ? get_current_user_name() : null;
        if (!local_user || String(msg.userName) !== String(local_user)) return;

        const state = getState();
        const parsed_audit = parse_audit_part_key(msg.partKey);
        if (parsed_audit) {
            if (!msg.auditId || String(state.auditId) !== String(msg.auditId)) return;
            const merged = merge_audit_result_from_broadcast(state, parsed_audit, msg.value);
            if (!merged) return;
            dispatch({
                type: StoreActionTypes.UPDATE_REQUIREMENT_RESULT,
                payload: {
                    ...merged,
                    same_user_tab_broadcast: true
                }
            });
            sync_textareas_in_dom(msg.partKey, msg.value);
            return;
        }

        const parsed_rule = parse_rulefile_part_key(msg.partKey);
        if (parsed_rule?.kind === 'infoblock_text') {
            if (!msg.ruleSetId || String(state.ruleSetId) !== String(msg.ruleSetId)) return;
            const merged = merge_rulefile_infoblock(state, parsed_rule.requirement_key, parsed_rule.block_id, msg.value);
            if (!merged) return;
            dispatch({
                type: StoreActionTypes.UPDATE_REQUIREMENT_DEFINITION,
                payload: {
                    ...merged,
                    same_user_tab_broadcast: true
                }
            });
            sync_textareas_in_dom(msg.partKey, msg.value);
        }
    };

    return () => {
        try {
            bc.close();
        } catch {
            /* ignoreras */
        }
    };
}

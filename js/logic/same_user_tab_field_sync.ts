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
import type { RequirementResultStored } from './audit_logic_types.js';
import { RequirementLookup } from './requirement_lookup.js';
import { get_tab_origin_id } from '../utils/tab_origin_id.js';

const CHANNEL_NAME = 'gv-same-user-field-sync';

let _channel: BroadcastChannel | null = null;

function safe_attr_escape(value: unknown): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(String(value));
    }
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export type SameUserFieldCommitPayload = {
    userName: string;
    auditId?: string | null;
    ruleSetId?: string | null;
    partKey: string;
    value: string;
};

/**
 * Skickar värde till andra flikar (samma origin) efter blur/sparning.
 */
export function post_same_user_field_commit(payload: SameUserFieldCommitPayload): void {
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

type AuditStateLike = {
    samples?: Array<{ id?: unknown; requirementResults?: Record<string, RequirementResultStored> | null }>;
    ruleFileContent?: { requirements?: unknown };
    auditId?: unknown;
    ruleSetId?: unknown;
};

/** Exporteras för enhetstester */
export function merge_audit_result_from_broadcast(
    state: AuditStateLike,
    parsed: Record<string, unknown>,
    value: string
): { sampleId: unknown; requirementId: string; newRequirementResult: RequirementResultStored } | null {
    const sample_id = parsed.sample_id as unknown;
    const req_id = parsed.requirement_id as string;
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
    const look = RequirementLookup.from(requirements);
    const save_key =
        req_def && look && !look.isArrayFormat()
            ? resolve_requirement_map_key(requirements, req_def.key || req_def.id) ||
              String(req_def.key ?? req_def.id ?? req_id)
            : String(req_id);
    const cur = (stored_base ? JSON.parse(JSON.stringify(stored_base)) : {}) as RequirementResultStored;
    const kind = parsed.kind as string;
    if (kind === 'req_text') {
        (cur as Record<string, unknown>)[parsed.field as string] = value;
    } else if (kind === 'observation_detail') {
        if (!cur.checkResults) cur.checkResults = {};
        const check_id = String(parsed.check_id);
        const pc_id = String(parsed.pc_id);
        if (!cur.checkResults[check_id]) cur.checkResults[check_id] = { passCriteria: {} };
        if (!cur.checkResults[check_id].passCriteria) cur.checkResults[check_id].passCriteria = {};
        const prev_pc = cur.checkResults[check_id].passCriteria[pc_id] || {};
        cur.checkResults[check_id].passCriteria[pc_id] = {
            ...prev_pc,
            observationDetail: value
        };
    } else {
        return null;
    }
    return { sampleId: sample_id, requirementId: save_key, newRequirementResult: cur };
}

/** Exporteras för enhetstester */
export function merge_rulefile_infoblock(
    state: AuditStateLike,
    requirement_key: string,
    block_id: string,
    value: string
): { requirementId: string; updatedRequirementData: Record<string, unknown> } | null {
    const requirements_map = state.ruleFileContent?.requirements as
        | Record<string, Record<string, unknown>>
        | undefined;
    const req = requirements_map?.[requirement_key];
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

function sync_textareas_in_dom(part_key: string, value: string): void {
    const sel = `textarea[data-gv-audit-part-key="${safe_attr_escape(part_key)}"],textarea[data-gv-rule-part-key="${safe_attr_escape(part_key)}"]`;
    try {
        document.querySelectorAll(sel).forEach((el) => {
            if (el && el.tagName === 'TEXTAREA') {
                (el as HTMLTextAreaElement).value = value;
            }
        });
    } catch {
        /* ignoreras */
    }
}

type SameUserTabSyncDeps = {
    getState: () => unknown;
    dispatch: (action: Record<string, unknown>) => void;
    StoreActionTypes: Record<string, unknown>;
    get_current_user_name: () => string | null | undefined;
};

/**
 * Prenumeration: uppdaterar state + DOM när annan flik med samma användare sparat fält.
 * @returns avprenumerera
 */
export function init_same_user_tab_field_sync_listener(deps: SameUserTabSyncDeps): () => void {
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

        const state = getState() as AuditStateLike;
        const parsed_audit = parse_audit_part_key(msg.partKey);
        if (parsed_audit) {
            if (!msg.auditId || String(state.auditId) !== String(msg.auditId)) return;
            const merged = merge_audit_result_from_broadcast(state, parsed_audit, String(msg.value));
            if (!merged) return;
            dispatch({
                type: String(StoreActionTypes.UPDATE_REQUIREMENT_RESULT),
                payload: {
                    ...merged,
                    same_user_tab_broadcast: true
                }
            });
            sync_textareas_in_dom(msg.partKey, String(msg.value));
            return;
        }

        const parsed_rule = parse_rulefile_part_key(msg.partKey);
        if (parsed_rule?.kind === 'infoblock_text') {
            if (!msg.ruleSetId || String(state.ruleSetId) !== String(msg.ruleSetId)) return;
            const merged = merge_rulefile_infoblock(
                state,
                String(parsed_rule.requirement_key),
                String(parsed_rule.block_id),
                String(msg.value)
            );
            if (!merged) return;
            dispatch({
                type: String(StoreActionTypes.UPDATE_REQUIREMENT_DEFINITION),
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

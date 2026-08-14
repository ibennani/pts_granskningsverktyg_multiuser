/**
 * @fileoverview Reducer för atomisk import av handläggar-Word.
 */
import * as AuditLogic from '../audit_logic.js';
import { get_current_user_actor_ref } from '../logic/current_user_actor.js';
import { find_requirement_definition } from '../logic/audit_logic_lookup.js';
import {
    calculate_check_status,
    calculate_requirement_status,
} from '../logic/audit_logic_status.js';
import { get_current_iso_datetime_utc } from './audit_reducer_time.js';
import { with_last_local_change_at } from '../logic/audit_sync_tracking.js';
import type { ObservationWordImportApplyPayload } from '../import/observation_word_import_types.js';

function apply_change_to_requirement_result(
    requirement_result: Record<string, unknown>,
    requirement_def: Record<string, unknown>,
    change: ObservationWordImportApplyPayload['changes'][number],
    updated_by: string,
    now_iso: string
): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(requirement_result)) as Record<string, unknown>;
    const check_results = (result.checkResults || {}) as Record<string, Record<string, unknown>>;
    const check_result = check_results[change.check_id];
    if (!check_result) return result;

    const pass_criteria = (check_result.passCriteria || {}) as Record<string, Record<string, unknown>>;
    const pc_data = pass_criteria[change.pc_id];
    if (!pc_data) return result;

    if (change.action === 'update_text') {
        pc_data.observationDetail = change.observation_detail ?? '';
        pc_data.timestamp = now_iso;
        pc_data.updatedBy = updated_by;
    } else if (change.action === 'clear_deficiency') {
        pc_data.status = 'passed';
        pc_data.observationDetail = '';
        pc_data.attachedMediaFilenames = [];
        pc_data.timestamp = now_iso;
        pc_data.updatedBy = updated_by;
        delete pc_data.deficiencyId;
    }

    const checks = Array.isArray(requirement_def.checks) ? requirement_def.checks : [];
    const check_def = checks.find((check: { id?: string }) => check.id === change.check_id);
    if (check_def) {
        check_result.status = calculate_check_status(
            check_def,
            pass_criteria as Record<string, import('../logic/audit_logic_types.js').PassCriterionStatusMapVal>,
            check_result.overallStatus as string | undefined
        );
    }

    result.status = calculate_requirement_status(
        requirement_def as import('../logic/audit_logic_types.js').RequirementDef,
        result as import('../logic/audit_logic_types.js').RequirementResultStored
    );
    result.lastStatusUpdate = now_iso;
    return result;
}

export function reduce_apply_observation_word_import(
    current_state: Record<string, unknown>,
    payload: ObservationWordImportApplyPayload
): Record<string, unknown> {
    if (current_state.auditStatus === 'archived') return current_state;
    if (!Array.isArray(payload?.changes) || payload.changes.length === 0) {
        return current_state;
    }

    const requirements = (current_state.ruleFileContent as { requirements?: unknown })?.requirements;
    const updated_by = get_current_user_actor_ref();
    const now_iso = get_current_iso_datetime_utc();

    const grouped = new Map<string, ObservationWordImportApplyPayload['changes']>();
    for (const change of payload.changes) {
        const key = `${change.sample_id}::${change.requirement_id}`;
        const list = grouped.get(key) || [];
        list.push(change);
        grouped.set(key, list);
    }

    let new_state = { ...current_state };
    for (const [key, changes] of grouped.entries()) {
        const [sample_id, requirement_id] = key.split('::');
        const requirement_def = find_requirement_definition(requirements, requirement_id);
        if (!requirement_def) continue;

        new_state = {
            ...new_state,
            samples: (new_state.samples as Array<Record<string, unknown>>).map((sample) => {
                if (String(sample.id) !== String(sample_id)) return sample;
                const req_results = { ...(sample.requirementResults as Record<string, unknown> || {}) };
                let req_result = { ...(req_results[requirement_id] as Record<string, unknown> || {}) };
                for (const change of changes) {
                    req_result = apply_change_to_requirement_result(
                        req_result,
                        requirement_def as Record<string, unknown>,
                        change,
                        updated_by,
                        now_iso
                    );
                }
                req_results[requirement_id] = req_result;
                return { ...sample, requirementResults: req_results };
            }),
        };
    }

    new_state = AuditLogic.recalculateAuditTimes(new_state) as Record<string, unknown>;
    new_state = AuditLogic.updateIncrementalDeficiencyIds(new_state) as Record<string, unknown>;
    return with_last_local_change_at(new_state, now_iso) as Record<string, unknown>;
}

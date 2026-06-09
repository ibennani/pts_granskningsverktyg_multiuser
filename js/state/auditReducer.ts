// js/state/auditReducer.ts
import * as AuditLogic from '../audit_logic.js';
import { get_current_user_name } from '../utils/helpers.js';
import { ActionTypes } from './actionTypes.js';
import { get_current_iso_datetime_utc } from './audit_reducer_time.js';
import { remove_stale_requirement_result_aliases } from './auditResultAliases.js';
import { reduce_update_metadata } from './metadataHandlers.js';
import { reduce_set_audit_status } from './auditStatusHandlers.js';
import {
    reduce_stage_sample_changes,
    reduce_clear_staged_sample_changes,
    reduce_set_sample_edit_draft,
    reduce_clear_sample_edit_draft,
    reduce_add_sample,
    reduce_update_sample,
    reduce_delete_sample
} from './sampleHandlers.js';
import {
    reduce_initialize_new_audit,
    reduce_discard_prepared_audit,
    reduce_initialize_rulefile_editing,
    reduce_load_audit_from_file,
    reduce_set_remote_audit_id,
    reduce_replace_state_from_remote
} from './remoteStateHandlers.js';
import { RequirementLookup } from '../logic/requirement_lookup.js';
import { map_samples_bulk_pass_fully_unreviewed_only } from './audit_reducer_bulk_pass.js';
import { definition_primary_id, same_storage_id } from '../logic/entity_id_match.js';
import {
    should_touch_last_local_change_at,
    with_last_local_change_at
} from '../logic/audit_sync_tracking.js';
import { with_last_in_progress_activity_in_metadata } from '../logic/audit_list_last_updated.js';

export function auditReducer(current_state: any, action: any) {
    let new_state: any;

    switch (action.type) {
        case ActionTypes.DELETE_CHECK_FROM_REQUIREMENT: {
            const { requirementId: reqIdForCheck, checkId } = action.payload;
            if (!current_state.ruleFileContent || !current_state.ruleFileContent.requirements) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Cannot delete check: ruleFileContent or requirements is null/undefined');
                return current_state;
            }
            const reqToUpdateCheck = current_state.ruleFileContent.requirements[reqIdForCheck];
            if (reqToUpdateCheck) {
                const updatedChecks = reqToUpdateCheck.checks.filter(
                    (c: any) => !same_storage_id(definition_primary_id(c), checkId)
                );
                const updatedReq = { ...reqToUpdateCheck, checks: updatedChecks };
                const newRequirements = { ...current_state.ruleFileContent.requirements, [reqIdForCheck]: updatedReq };
                return { ...current_state, ruleFileContent: { ...current_state.ruleFileContent, requirements: newRequirements } };
            }
            return current_state;
        }
        case ActionTypes.DELETE_CRITERION_FROM_CHECK: {
            const { requirementId: reqIdForPc, checkId: checkIdForPc, passCriterionId } = action.payload;
            if (!current_state.ruleFileContent || !current_state.ruleFileContent.requirements) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Cannot delete criterion: ruleFileContent or requirements is null/undefined');
                return current_state;
            }
            const reqToUpdatePc = current_state.ruleFileContent.requirements[reqIdForPc];
            if (reqToUpdatePc) {
                const updatedChecksForPc = reqToUpdatePc.checks.map((c: any) => {
                    if (same_storage_id(definition_primary_id(c), checkIdForPc)) {
                        const updatedPassCriteria = (c.passCriteria || []).filter(
                            (pc: any) => !same_storage_id(definition_primary_id(pc), passCriterionId)
                        );
                        return { ...c, passCriteria: updatedPassCriteria };
                    }
                    return c;
                });
                const updatedReqForPc = { ...reqToUpdatePc, checks: updatedChecksForPc };
                const newRequirementsForPc = { ...current_state.ruleFileContent.requirements, [reqIdForPc]: updatedReqForPc };
                return { ...current_state, ruleFileContent: { ...current_state.ruleFileContent, requirements: newRequirementsForPc } };
            }
            return current_state;
        }
        case ActionTypes.UPDATE_REQUIREMENT_DEFINITION: {
            const { requirementId: updateReqId, updatedRequirementData } = action.payload;
            const requirements = current_state.ruleFileContent?.requirements;
            if (!requirements || !updatedRequirementData) return current_state;
            const look = RequirementLookup.from(requirements);
            if (!look || !look.findById(updateReqId)) return current_state;
            if (look.isArrayFormat()) {
                const raw = look.getRaw() as unknown[];
                const idx = raw.findIndex((r: any) => {
                    const rk = r?.key != null ? String(r.key) : '';
                    const ri = r?.id != null ? String(r.id) : '';
                    return rk === String(updateReqId) || ri === String(updateReqId);
                });
                if (idx === -1) return current_state;
                const arr = [...raw];
                arr[idx] = updatedRequirementData;
                return {
                    ...current_state,
                    ruleFileContent: {
                        ...current_state.ruleFileContent,
                        requirements: arr
                    }
                };
            }
            const map_key = look.resolveMapKey(updateReqId);
            if (!map_key) return current_state;
            const rec = look.getRaw() as Record<string, unknown>;
            const newRequirements = { ...rec, [map_key]: updatedRequirementData };
            return {
                ...current_state,
                ruleFileContent: {
                    ...current_state.ruleFileContent,
                    requirements: newRequirements
                }
            };
        }
        case ActionTypes.ADD_REQUIREMENT_DEFINITION: {
            const { requirementId: addReqId, newRequirementData } = action.payload;
            if (current_state.ruleFileContent?.requirements && newRequirementData) {
                const newRequirements = {
                    ...current_state.ruleFileContent.requirements,
                    [addReqId]: newRequirementData
                };
                return {
                    ...current_state,
                    ruleFileContent: {
                        ...current_state.ruleFileContent,
                        requirements: newRequirements
                    }
                };
            }
            return current_state;
        }
        case ActionTypes.DELETE_REQUIREMENT_DEFINITION: {
            const { requirementId: deleteReqId } = action.payload;
            if (!current_state.ruleFileContent || !current_state.ruleFileContent.requirements) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Cannot delete requirement: ruleFileContent or requirements is null/undefined');
                return current_state;
            }
            const reqs_before = current_state.ruleFileContent.requirements;
            const newRequirementsAfterDelete = { ...reqs_before };
            delete newRequirementsAfterDelete[deleteReqId];
            const req_def_for_delete = AuditLogic.find_requirement_definition(reqs_before, deleteReqId);
            const updatedSamples = current_state.samples.map((sample: any) => {
                if (!sample.requirementResults) return sample;
                const keys_to_remove = new Set([String(deleteReqId)]);
                if (req_def_for_delete) {
                    const mk = AuditLogic.resolve_requirement_map_key(
                        reqs_before,
                        req_def_for_delete.key || req_def_for_delete.id
                    );
                    if (mk) keys_to_remove.add(mk);
                    if (req_def_for_delete.key != null) keys_to_remove.add(String(req_def_for_delete.key));
                    if (req_def_for_delete.id != null) keys_to_remove.add(String(req_def_for_delete.id));
                }
                let changed = false;
                const newResults = { ...sample.requirementResults };
                keys_to_remove.forEach((k) => {
                    if (Object.prototype.hasOwnProperty.call(newResults, k)) {
                        delete newResults[k];
                        changed = true;
                    }
                });
                return changed ? { ...sample, requirementResults: newResults } : sample;
            });
            return {
                ...current_state,
                samples: updatedSamples,
                ruleFileContent: {
                    ...current_state.ruleFileContent,
                    requirements: newRequirementsAfterDelete
                }
            };
        }
        case ActionTypes.CONFIRM_SINGLE_REVIEWED_REQUIREMENT: {
            if (current_state.auditStatus === 'archived') return current_state;
            const { sampleId, requirementId } = action.payload;
            const new_update_details = { ...(current_state.requirementUpdateDetails || {}) };
            delete new_update_details[requirementId];
            const confirmed_single = {
                ...current_state,
                requirementUpdateDetails: new_update_details,
                samples: current_state.samples.map((sample: any) => {
                    if (sample.id !== sampleId) return sample;
                    const requirements = current_state.ruleFileContent.requirements;
                    const req_def = AuditLogic.find_requirement_definition(requirements, requirementId);
                    if (!req_def) {
                        if (!sample.requirementResults?.[requirementId]?.needsReview) return sample;
                        const newResults = { ...sample.requirementResults };
                        const newReqResult = { ...newResults[requirementId] };
                        delete newReqResult.needsReview;
                        newResults[requirementId] = newReqResult;
                        return { ...sample, requirementResults: newResults };
                    }
                    const stored = AuditLogic.get_stored_requirement_result_for_def(
                        sample.requirementResults,
                        requirements,
                        req_def,
                        requirementId
                    );
                    if (!stored?.needsReview) return sample;
                    const map_key =
                        AuditLogic.resolve_requirement_map_key(requirements, req_def.key || req_def.id)
                        || String(req_def.key || req_def.id);
                    const newResults = { ...sample.requirementResults };
                    const newReqResult = { ...stored };
                    delete newReqResult.needsReview;
                    newResults[map_key] = newReqResult;
                    remove_stale_requirement_result_aliases(newResults, map_key, req_def);
                    return { ...sample, requirementResults: newResults };
                })
            };
            if (should_touch_last_local_change_at(current_state.auditStatus)) {
                return with_last_local_change_at(confirmed_single, get_current_iso_datetime_utc());
            }
            return confirmed_single;
        }
        case ActionTypes.CONFIRM_ALL_REVIEWED_REQUIREMENTS:
            if (current_state.auditStatus === 'archived') return current_state;
            const confirmed_all = {
                ...current_state,
                requirementUpdateDetails: {},
                samples: current_state.samples.map((sample: any) => {
                    const requirements = current_state.ruleFileContent.requirements;
                    const newResults = { ...(sample.requirementResults || {}) };
                    let hasChanged = false;
                    const processed_map_keys = new Set();
                    Object.keys(newResults).forEach((reqId) => {
                        const req_def = AuditLogic.find_requirement_definition(requirements, reqId);
                        if (!req_def) {
                            const r = newResults[reqId];
                            if (r?.needsReview) {
                                hasChanged = true;
                                newResults[reqId] = { ...r };
                                delete newResults[reqId].needsReview;
                            }
                            return;
                        }
                        const map_key =
                            AuditLogic.resolve_requirement_map_key(requirements, req_def.key || req_def.id)
                            || String(req_def.key || req_def.id);
                        if (processed_map_keys.has(map_key)) return;
                        const stored = AuditLogic.get_stored_requirement_result_for_def(
                            sample.requirementResults,
                            requirements,
                            req_def,
                            reqId
                        );
                        if (!stored?.needsReview) return;
                        processed_map_keys.add(map_key);
                        hasChanged = true;
                        newResults[map_key] = { ...stored };
                        delete newResults[map_key].needsReview;
                        remove_stale_requirement_result_aliases(newResults, map_key, req_def);
                    });
                    return hasChanged ? { ...sample, requirementResults: newResults } : sample;
                })
            };
            if (should_touch_last_local_change_at(current_state.auditStatus)) {
                return with_last_local_change_at(confirmed_all, get_current_iso_datetime_utc());
            }
            return confirmed_all;
        case ActionTypes.MARK_ALL_UNREVIEWED_AS_PASSED: {
            if (current_state.auditStatus === 'archived') return current_state;
            if (!current_state.ruleFileContent?.requirements || !current_state.samples?.length) {
                return current_state;
            }
            const timestamp = get_current_iso_datetime_utc();
            const new_samples = map_samples_bulk_pass_fully_unreviewed_only(
                current_state,
                { target_sample_id: null, requirement_id: null },
                timestamp,
                get_current_user_name()
            );
            new_state = { ...current_state, samples: new_samples };
            new_state = AuditLogic.recalculateAuditTimes(new_state);
            new_state = AuditLogic.updateIncrementalDeficiencyIds(new_state);
            if (should_touch_last_local_change_at(current_state.auditStatus)) {
                return with_last_local_change_at(new_state, timestamp);
            }
            return new_state;
        }
        case ActionTypes.MARK_ALL_UNREVIEWED_AS_PASSED_IN_SAMPLE: {
            if (current_state.auditStatus === 'archived') return current_state;
            const sample_id = action.payload?.sampleId;
            if (!sample_id || !current_state.ruleFileContent?.requirements || !current_state.samples?.length) {
                return current_state;
            }
            const timestamp = get_current_iso_datetime_utc();
            const new_samples = map_samples_bulk_pass_fully_unreviewed_only(
                current_state,
                { target_sample_id: sample_id, requirement_id: null },
                timestamp,
                get_current_user_name()
            );
            new_state = { ...current_state, samples: new_samples };
            new_state = AuditLogic.recalculateAuditTimes(new_state);
            new_state = AuditLogic.updateIncrementalDeficiencyIds(new_state);
            if (should_touch_last_local_change_at(current_state.auditStatus)) {
                return with_last_local_change_at(new_state, timestamp);
            }
            return new_state;
        }
        case ActionTypes.MARK_REQUIREMENT_AS_PASSED_IN_ALL_SAMPLES: {
            if (current_state.auditStatus === 'archived') return current_state;
            const requirement_id = action.payload?.requirementId;
            if (!requirement_id || !current_state.ruleFileContent?.requirements || !current_state.samples?.length) {
                return current_state;
            }
            const timestamp = get_current_iso_datetime_utc();
            const new_samples = map_samples_bulk_pass_fully_unreviewed_only(
                current_state,
                { target_sample_id: null, requirement_id },
                timestamp,
                get_current_user_name()
            );
            new_state = { ...current_state, samples: new_samples };
            new_state = AuditLogic.recalculateAuditTimes(new_state);
            new_state = AuditLogic.updateIncrementalDeficiencyIds(new_state);
            if (should_touch_last_local_change_at(current_state.auditStatus)) {
                return with_last_local_change_at(new_state, timestamp);
            }
            return new_state;
        }
        case ActionTypes.STAGE_SAMPLE_CHANGES:
            return reduce_stage_sample_changes(current_state, action);
        case ActionTypes.CLEAR_STAGED_SAMPLE_CHANGES:
            return reduce_clear_staged_sample_changes(current_state);
        case ActionTypes.SET_SAMPLE_EDIT_DRAFT:
            return reduce_set_sample_edit_draft(current_state, action);
        case ActionTypes.CLEAR_SAMPLE_EDIT_DRAFT:
            return reduce_clear_sample_edit_draft(current_state);
        case ActionTypes.INITIALIZE_NEW_AUDIT:
            return reduce_initialize_new_audit(current_state, action);
        case ActionTypes.DISCARD_PREPARED_AUDIT:
            return reduce_discard_prepared_audit(current_state, action);
        case ActionTypes.INITIALIZE_RULEFILE_EDITING:
            return reduce_initialize_rulefile_editing(current_state, action);
        case ActionTypes.LOAD_AUDIT_FROM_FILE:
            return reduce_load_audit_from_file(current_state, action);
        case ActionTypes.UPDATE_METADATA:
            return reduce_update_metadata(current_state, action);
        case ActionTypes.ADD_SAMPLE:
            return reduce_add_sample(current_state, action);
        case ActionTypes.UPDATE_SAMPLE:
            return reduce_update_sample(current_state, action);
        case ActionTypes.DELETE_SAMPLE:
            return reduce_delete_sample(current_state, action);
        case ActionTypes.UPDATE_REQUIREMENT_RESULT: {
            if (current_state.auditStatus === 'archived') return current_state;
            const {
                sampleId: updateSampleId,
                requirementId: updateRequirementId,
                newRequirementResult,
                from_remote_push,
                remote_version
            } = action.payload;
            const result_to_save = { ...newRequirementResult };
            new_state = {
                ...current_state,
                samples: current_state.samples.map((sample: any) =>
                    (String(sample.id) === String(updateSampleId))
                        ? { ...sample, requirementResults: { ...(sample.requirementResults || {}), [updateRequirementId]: result_to_save } }
                        : sample
                )
            };
            if (from_remote_push === true && remote_version != null && !Number.isNaN(Number(remote_version))) {
                new_state.version = Number(remote_version);
            }
            new_state = AuditLogic.recalculateAuditTimes(new_state);
            new_state = AuditLogic.updateIncrementalDeficiencyIds(new_state);
            if (from_remote_push === true) {
                return new_state;
            }
            const now_iso = get_current_iso_datetime_utc();
            if (
                current_state.auditStatus === 'in_progress'
                || current_state.auditStatus === 'not_started'
            ) {
                const activity_ts =
                    typeof result_to_save.lastStatusUpdate === 'string' && result_to_save.lastStatusUpdate
                        ? result_to_save.lastStatusUpdate
                        : now_iso;
                new_state.auditMetadata = with_last_in_progress_activity_in_metadata(
                    new_state.auditMetadata,
                    activity_ts
                );
            }
            if (should_touch_last_local_change_at(current_state.auditStatus)) {
                return with_last_local_change_at(new_state, now_iso);
            }
            return new_state;
        }
        case ActionTypes.SET_AUDIT_STATUS:
            return reduce_set_audit_status(current_state, action);
        case ActionTypes.SET_REMOTE_AUDIT_ID:
            return reduce_set_remote_audit_id(current_state, action);
        case ActionTypes.REPLACE_STATE_FROM_REMOTE:
            return reduce_replace_state_from_remote(current_state, action);
        default:
            return current_state;
    }
}

// @ts-nocheck
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
    reduce_initialize_rulefile_editing,
    reduce_load_audit_from_file,
    reduce_set_remote_audit_id,
    reduce_replace_state_from_remote
} from './remoteStateHandlers.js';

export function auditReducer(current_state, action) {
    let new_state;

    switch (action.type) {
        case ActionTypes.DELETE_CHECK_FROM_REQUIREMENT: {
            const { requirementId: reqIdForCheck, checkId } = action.payload;
            if (!current_state.ruleFileContent || !current_state.ruleFileContent.requirements) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Cannot delete check: ruleFileContent or requirements is null/undefined');
                return current_state;
            }
            const reqToUpdateCheck = current_state.ruleFileContent.requirements[reqIdForCheck];
            if (reqToUpdateCheck) {
                const updatedChecks = reqToUpdateCheck.checks.filter(c => c.id !== checkId);
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
                const updatedChecksForPc = reqToUpdatePc.checks.map(c => {
                    if (c.id === checkIdForPc) {
                        const updatedPassCriteria = c.passCriteria.filter(pc => pc.id !== passCriterionId);
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
            if (current_state.ruleFileContent?.requirements?.[updateReqId]) {
                const newRequirements = {
                    ...current_state.ruleFileContent.requirements,
                    [updateReqId]: updatedRequirementData
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
            const req_def_for_delete =
                AuditLogic.find_requirement_definition(reqs_before, deleteReqId)
                || (!Array.isArray(reqs_before) ? reqs_before[deleteReqId] : null);
            const updatedSamples = current_state.samples.map((sample) => {
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
            return {
                ...current_state,
                requirementUpdateDetails: new_update_details,
                samples: current_state.samples.map((sample) => {
                    if (sample.id !== sampleId) return sample;
                    const requirements = current_state.ruleFileContent.requirements;
                    const req_def =
                        AuditLogic.find_requirement_definition(requirements, requirementId)
                        || (!Array.isArray(requirements) ? requirements?.[requirementId] : null);
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
        }
        case ActionTypes.CONFIRM_ALL_REVIEWED_REQUIREMENTS:
            if (current_state.auditStatus === 'archived') return current_state;
            return {
                ...current_state,
                requirementUpdateDetails: {},
                samples: current_state.samples.map((sample) => {
                    const requirements = current_state.ruleFileContent.requirements;
                    const newResults = { ...(sample.requirementResults || {}) };
                    let hasChanged = false;
                    const processed_map_keys = new Set();
                    Object.keys(newResults).forEach((reqId) => {
                        const req_def =
                            AuditLogic.find_requirement_definition(requirements, reqId)
                            || (!Array.isArray(requirements) ? requirements?.[reqId] : null);
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
        case ActionTypes.MARK_ALL_UNREVIEWED_AS_PASSED: {
            if (current_state.auditStatus === 'archived') return current_state;
            if (!current_state.ruleFileContent?.requirements || !current_state.samples?.length) {
                return current_state;
            }
            const timestamp = get_current_iso_datetime_utc();
            const new_samples = current_state.samples.map(sample => {
                const relevant_reqs = AuditLogic.get_relevant_requirements_for_sample(current_state.ruleFileContent, sample);
                const new_results = { ...(sample.requirementResults || {}) };
                let has_changed = false;
                const requirements = current_state.ruleFileContent.requirements;
                relevant_reqs.forEach(req_def => {
                    const existing = AuditLogic.get_stored_requirement_result_for_def(
                        new_results,
                        requirements,
                        req_def
                    );
                    const status = AuditLogic.get_effective_requirement_audit_status(
                        requirements,
                        new_results,
                        req_def,
                        null
                    );
                    if (status === 'not_audited' || status === 'partially_audited') {
                        const map_key =
                            AuditLogic.resolve_requirement_map_key(
                                requirements,
                                req_def.key || req_def.id
                            ) || String(req_def.key || req_def.id);
                        new_results[map_key] = AuditLogic.build_not_applicable_requirement_result(
                            req_def,
                            existing,
                            timestamp,
                            get_current_user_name()
                        );
                        remove_stale_requirement_result_aliases(new_results, map_key, req_def);
                        has_changed = true;
                    }
                });
                return has_changed ? { ...sample, requirementResults: new_results } : sample;
            });
            new_state = { ...current_state, samples: new_samples };
            new_state = AuditLogic.recalculateAuditTimes(new_state);
            return AuditLogic.updateIncrementalDeficiencyIds(new_state);
        }
        case ActionTypes.MARK_REQUIREMENT_AS_PASSED_IN_ALL_SAMPLES: {
            if (current_state.auditStatus === 'archived') return current_state;
            const requirement_id = action.payload?.requirementId;
            if (!requirement_id || !current_state.ruleFileContent?.requirements || !current_state.samples?.length) {
                return current_state;
            }
            const timestamp = get_current_iso_datetime_utc();
            const new_samples = current_state.samples.map(sample => {
                const relevant_reqs = AuditLogic.get_relevant_requirements_for_sample(current_state.ruleFileContent, sample);
                const req_def = relevant_reqs.find(r => (r.key || r.id) === requirement_id);
                if (!req_def) return sample;
                const new_results = { ...(sample.requirementResults || {}) };
                const existing = AuditLogic.get_stored_requirement_result_for_def(
                    new_results,
                    current_state.ruleFileContent.requirements,
                    req_def
                );
                const status = AuditLogic.get_effective_requirement_audit_status(
                    current_state.ruleFileContent.requirements,
                    new_results,
                    req_def,
                    null
                );
                if (status !== 'not_audited' && status !== 'partially_audited') return sample;
                const map_key =
                    AuditLogic.resolve_requirement_map_key(
                        current_state.ruleFileContent.requirements,
                        req_def.key || req_def.id
                    ) || String(req_def.key || req_def.id);
                new_results[map_key] = AuditLogic.build_not_applicable_requirement_result(
                    req_def,
                    existing,
                    timestamp,
                    get_current_user_name()
                );
                remove_stale_requirement_result_aliases(new_results, map_key, req_def);
                return { ...sample, requirementResults: new_results };
            });
            new_state = { ...current_state, samples: new_samples };
            new_state = AuditLogic.recalculateAuditTimes(new_state);
            return AuditLogic.updateIncrementalDeficiencyIds(new_state);
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
            const { sampleId: updateSampleId, requirementId: updateRequirementId, newRequirementResult } = action.payload;
            const result_to_save = { ...newRequirementResult };
            new_state = {
                ...current_state,
                samples: current_state.samples.map(sample =>
                    (sample.id === updateSampleId)
                        ? { ...sample, requirementResults: { ...(sample.requirementResults || {}), [updateRequirementId]: result_to_save } }
                        : sample
                )
            };
            new_state = AuditLogic.recalculateAuditTimes(new_state);
            return AuditLogic.updateIncrementalDeficiencyIds(new_state);
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

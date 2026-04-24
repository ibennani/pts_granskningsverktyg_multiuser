// js/state/auditReducer.js
import * as AuditLogic from '../audit_logic.js';
import { get_current_user_name } from '../utils/helpers.js';
import { ActionTypes } from './actionTypes.js';
import { initial_state, APP_STATE_VERSION } from './initialState.js';

function get_current_iso_datetime_utc_internal() {
    return new Date().toISOString();
}

/** Tar bort duplicerat lagert under publikt id när resultatet flyttats till map-nyckel. */
function remove_stale_requirement_result_aliases(new_results, map_key, req_def) {
    if (!new_results || map_key == null) return;
    const mk = String(map_key);
    for (const pk of [req_def.key, req_def.id]) {
        if (pk == null) continue;
        const s = String(pk);
        if (s !== mk && Object.prototype.hasOwnProperty.call(new_results, s)) {
            delete new_results[s];
        }
    }
}

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
            const newRequirementsAfterDelete = { ...current_state.ruleFileContent.requirements };
            delete newRequirementsAfterDelete[deleteReqId];
            const updatedSamples = current_state.samples.map(sample => {
                if (sample.requirementResults && sample.requirementResults[deleteReqId]) {
                    const newResults = { ...sample.requirementResults };
                    delete newResults[deleteReqId];
                    return { ...sample, requirementResults: newResults };
                }
                return sample;
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
                samples: current_state.samples.map(sample => {
                    if (sample.id === sampleId && sample.requirementResults?.[requirementId]?.needsReview) {
                        const newResults = { ...sample.requirementResults };
                        const newReqResult = { ...newResults[requirementId] };
                        delete newReqResult.needsReview;
                        newResults[requirementId] = newReqResult;
                        return { ...sample, requirementResults: newResults };
                    }
                    return sample;
                })
            };
        }
        case ActionTypes.CONFIRM_ALL_REVIEWED_REQUIREMENTS:
            if (current_state.auditStatus === 'archived') return current_state;
            return {
                ...current_state,
                requirementUpdateDetails: {},
                samples: current_state.samples.map(sample => {
                    const newResults = {};
                    let hasChanged = false;
                    Object.keys(sample.requirementResults || {}).forEach(reqId => {
                        const originalResult = sample.requirementResults[reqId];
                        if (originalResult?.needsReview) {
                            hasChanged = true;
                            newResults[reqId] = { ...originalResult };
                            delete newResults[reqId].needsReview;
                        } else {
                            newResults[reqId] = originalResult;
                        }
                    });
                    return hasChanged ? { ...sample, requirementResults: newResults } : sample;
                })
            };
        case ActionTypes.MARK_ALL_UNREVIEWED_AS_PASSED: {
            if (current_state.auditStatus === 'archived') return current_state;
            if (!current_state.ruleFileContent?.requirements || !current_state.samples?.length) {
                return current_state;
            }
            const timestamp = get_current_iso_datetime_utc_internal();
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
                    const status = AuditLogic.calculate_requirement_status(req_def, existing);
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
            const timestamp = get_current_iso_datetime_utc_internal();
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
                const status = AuditLogic.calculate_requirement_status(req_def, existing);
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
            return { ...current_state, pendingSampleChanges: action.payload };
        case ActionTypes.CLEAR_STAGED_SAMPLE_CHANGES:
            return { ...current_state, pendingSampleChanges: null };
        case ActionTypes.SET_SAMPLE_EDIT_DRAFT:
            return { ...current_state, sampleEditDraft: action.payload };
        case ActionTypes.CLEAR_SAMPLE_EDIT_DRAFT:
            return { ...current_state, sampleEditDraft: null };
        case ActionTypes.INITIALIZE_NEW_AUDIT:
            return {
                ...initial_state,
                saveFileVersion: APP_STATE_VERSION,
                ruleFileContent: action.payload.ruleFileContent,
                auditMetadata: {
                    caseNumber: '', actorName: '', actorLink: '', auditorName: '', caseHandler: '', internalComment: ''
                },
                uiSettings: JSON.parse(JSON.stringify(initial_state.uiSettings)),
                auditStatus: 'not_started'
            };
        case ActionTypes.INITIALIZE_RULEFILE_EDITING:
            return {
                ...initial_state,
                saveFileVersion: APP_STATE_VERSION,
                ruleFileContent: action.payload.ruleFileContent,
                ruleFileIsPublished: action.payload.ruleFileIsPublished ?? false,
                uiSettings: JSON.parse(JSON.stringify(initial_state.uiSettings)),
                auditStatus: 'rulefile_editing',
                ruleFileOriginalContentString: action.payload.originalRuleFileContentString || null,
                ruleFileOriginalFilename: action.payload.originalRuleFileFilename || '',
                ruleSetId: action.payload.ruleSetId ?? null,
                ruleFileServerVersion: action.payload.ruleFileServerVersion ?? 0
            };
        case ActionTypes.LOAD_AUDIT_FROM_FILE:
            if (action.payload && typeof action.payload === 'object') {
                const loaded_data = action.payload;
                const new_state_base = JSON.parse(JSON.stringify(initial_state));
                let merged_state = {
                    ...new_state_base,
                    ...loaded_data,
                    uiSettings: { ...new_state_base.uiSettings, ...(loaded_data.uiSettings || {}) },
                    saveFileVersion: APP_STATE_VERSION
                };
                if (!Array.isArray(merged_state.archivedRequirementResults)) {
                    merged_state.archivedRequirementResults = [];
                }
                (merged_state.samples || []).forEach(sample => {
                    Object.values(sample.requirementResults || {}).forEach(reqResult => {
                        Object.values(reqResult.checkResults || {}).forEach(checkResult => {
                            if (checkResult.passCriteria) {
                                Object.keys(checkResult.passCriteria).forEach(pcId => {
                                    const pcValue = checkResult.passCriteria[pcId];
                                    if (typeof pcValue === 'string') {
                                        checkResult.passCriteria[pcId] = {
                                            status: pcValue,
                                            observationDetail: '',
                                            timestamp: merged_state.startTime || null,
                                            attachedMediaFilenames: []
                                        };
                                    } else if (typeof pcValue === 'object' && pcValue !== null && !Array.isArray(pcValue.attachedMediaFilenames)) {
                                        pcValue.attachedMediaFilenames = [];
                                    }
                                });
                            }
                        });
                        const stuck_parts = [];
                        Object.values(reqResult.checkResults || {}).forEach(checkResult => {
                            Object.values(checkResult.passCriteria || {}).forEach(pcResult => {
                                const s = (pcResult?.stuckProblemDescription || '').trim();
                                if (s) stuck_parts.push(s);
                                if (pcResult && typeof pcResult === 'object') delete pcResult.stuckProblemDescription;
                            });
                        });
                        if (stuck_parts.length > 0) reqResult.stuckProblemDescription = stuck_parts.join('\n\n');
                        if (typeof reqResult.stuckProblemDescription !== 'string') reqResult.stuckProblemDescription = '';
                    });
                });
                if (!merged_state.deficiencyCounter) merged_state.deficiencyCounter = 1;
                merged_state = AuditLogic.recalculateAuditTimes(merged_state);
                merged_state.manageUsersText = current_state.manageUsersText ?? '';
                let loaded_final = AuditLogic.recalculateStatusesOnLoad(merged_state);
                if ((loaded_final.auditStatus === 'locked' || loaded_final.auditStatus === 'archived')
                    && (loaded_final.auditLastUpdatedAtFrozen === undefined || loaded_final.auditLastUpdatedAtFrozen === null)) {
                    loaded_final = {
                        ...loaded_final,
                        auditLastUpdatedAtFrozen: AuditLogic.compute_audit_last_updated_live_timestamp(loaded_final)
                    };
                }
                return loaded_final;
            }
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] LOAD_AUDIT_FROM_FILE: Invalid payload.', action.payload);
            return current_state;
        case ActionTypes.UPDATE_METADATA: {
            const payload = { ...(action.payload || {}) };
            const skip_internal_sync = action.payload?.skip_server_sync === true;
            delete payload.skip_server_sync;
            if (current_state.auditStatus === 'archived') {
                const keys = Object.keys(payload);
                if (keys.length !== 1 || keys[0] !== 'audit_edit_log') return current_state;
            }
            const merged = {
                ...current_state,
                auditMetadata: { ...current_state.auditMetadata, ...payload }
            };
            const may_bump_non_obs = !skip_internal_sync
                && current_state.auditStatus !== 'locked'
                && current_state.auditStatus !== 'archived';
            if (may_bump_non_obs) {
                merged.auditLastNonObservationActivityAt = get_current_iso_datetime_utc_internal();
            }
            return merged;
        }
        case ActionTypes.ADD_SAMPLE: {
            if (current_state.auditStatus === 'archived') return current_state;
            const new_sample_with_defaults = { sampleCategory: '', sampleType: '', ...action.payload };
            const out = {
                ...current_state,
                samples: [...current_state.samples, new_sample_with_defaults]
            };
            if (current_state.auditStatus !== 'locked') {
                out.auditLastNonObservationActivityAt = get_current_iso_datetime_utc_internal();
            }
            return out;
        }
        case ActionTypes.UPDATE_SAMPLE:
            if (current_state.auditStatus === 'archived') return current_state;
            {
                const base = {
                    ...current_state,
                    samples: current_state.samples.map(s => s.id === action.payload.sampleId ? { ...s, ...action.payload.updatedSampleData } : s)
                };
                if (current_state.auditStatus !== 'locked') {
                    base.auditLastNonObservationActivityAt = get_current_iso_datetime_utc_internal();
                }
                return base;
            }
        case ActionTypes.DELETE_SAMPLE:
            if (current_state.auditStatus === 'archived') return current_state;
            new_state = {
                ...current_state,
                samples: current_state.samples.filter(s => s.id !== action.payload.sampleId)
            };
            if (current_state.auditStatus !== 'locked') {
                new_state.auditLastNonObservationActivityAt = get_current_iso_datetime_utc_internal();
            }
            return AuditLogic.updateIncrementalDeficiencyIds(new_state);
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
        case ActionTypes.SET_AUDIT_STATUS: {
            const newStatus = action.payload.status;
            let state_before_status_change = current_state;
            let frozen_last_updated = current_state.auditLastUpdatedAtFrozen ?? null;
            if (newStatus === 'locked' && current_state.auditStatus === 'in_progress') {
                if (current_state.deficiencyCounter === 1) {
                    state_before_status_change = AuditLogic.assignSortedDeficiencyIdsOnLock(current_state);
                }
                state_before_status_change = AuditLogic.recalculateAuditTimes(state_before_status_change);
                if (!state_before_status_change.endTime) {
                    state_before_status_change = { ...state_before_status_change, endTime: get_current_iso_datetime_utc_internal() };
                }
                frozen_last_updated = AuditLogic.compute_audit_last_updated_live_timestamp(state_before_status_change);
            } else if (newStatus === 'in_progress' && current_state.auditStatus === 'locked') {
                state_before_status_change = AuditLogic.removeAllDeficiencyIds(current_state);
                state_before_status_change = { ...AuditLogic.recalculateAuditTimes(state_before_status_change), endTime: null };
                frozen_last_updated = null;
            } else if (newStatus === 'in_progress' && current_state.auditStatus === 'not_started') {
                state_before_status_change = AuditLogic.removeAllDeficiencyIds(current_state);
                state_before_status_change = AuditLogic.recalculateAuditTimes(state_before_status_change);
            } else if (newStatus === 'archived' && current_state.auditStatus === 'locked') {
                state_before_status_change = current_state;
            } else if (newStatus === 'locked' && current_state.auditStatus === 'archived') {
                state_before_status_change = current_state;
            }
            return {
                ...state_before_status_change,
                auditStatus: newStatus,
                auditLastUpdatedAtFrozen: frozen_last_updated
            };
        }
        case ActionTypes.SET_REMOTE_AUDIT_ID:
            return {
                ...current_state,
                auditId: action.payload.auditId,
                ruleSetId: action.payload.ruleSetId ?? current_state.ruleSetId,
                version: action.payload.version ?? current_state.version
            };
        case ActionTypes.REPLACE_STATE_FROM_REMOTE: {
            const remote = action.payload;
            if (!remote || typeof remote !== 'object') return current_state;
            let merged_remote = {
                ...remote,
                uiSettings: current_state.uiSettings || remote.uiSettings || {},
                manageUsersText: current_state.manageUsersText ?? '',
                // Bevara lokala "utkast"/bekräftelsedata vid server-poll, annars kan användarens val försvinna.
                pendingSampleChanges: current_state.pendingSampleChanges ?? null,
                sampleEditDraft: current_state.sampleEditDraft ?? null
            };
            if ((merged_remote.auditStatus === 'locked' || merged_remote.auditStatus === 'archived')
                && (merged_remote.auditLastUpdatedAtFrozen === undefined || merged_remote.auditLastUpdatedAtFrozen === null)) {
                merged_remote = {
                    ...merged_remote,
                    auditLastUpdatedAtFrozen: AuditLogic.compute_audit_last_updated_live_timestamp(merged_remote)
                };
            }
            return merged_remote;
        }
        default:
            return current_state;
    }
}

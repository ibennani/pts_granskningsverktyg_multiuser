// @ts-nocheck
/**
 * @file Init, inläsning från fil och fjärrsynkad state i audit-reducern.
 */

import * as AuditLogic from '../audit_logic.js';
import { initial_state, APP_STATE_VERSION } from './initialState.js';

export function reduce_initialize_new_audit(_current_state, action) {
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
}

export function reduce_initialize_rulefile_editing(_current_state, action) {
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
}

export function reduce_load_audit_from_file(current_state, action) {
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
}

export function reduce_set_remote_audit_id(current_state, action) {
    return {
        ...current_state,
        auditId: action.payload.auditId,
        ruleSetId: action.payload.ruleSetId ?? current_state.ruleSetId,
        version: action.payload.version ?? current_state.version
    };
}

export function reduce_replace_state_from_remote(current_state, action) {
    const remote = action.payload;
    if (!remote || typeof remote !== 'object') return current_state;
    let merged_remote = {
        ...remote,
        uiSettings: current_state.uiSettings || remote.uiSettings || {},
        manageUsersText: current_state.manageUsersText ?? '',
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

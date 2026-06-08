/**
 * @file Init, inläsning från fil och fjärrsynkad state i audit-reducern.
 */

import * as AuditLogic from '../audit_logic.js';
import { initial_state, APP_STATE_VERSION } from './initialState.js';
import {
    traverse_all_pass_criteria,
    traverse_all_requirement_results
} from '../utils/traverse_audit_data.js';
import type { RequirementResultNode } from '../utils/traverse_audit_data.js';

export function reduce_initialize_new_audit (_current_state: any, action: any) {
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

export function reduce_initialize_rulefile_editing (_current_state: any, action: any) {
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

export function reduce_load_audit_from_file (current_state: any, action: any) {
    if (action.payload && typeof action.payload === 'object') {
        const loaded_data = action.payload;
        const new_state_base = JSON.parse(JSON.stringify(initial_state));
        let merged_state: any = {
            ...new_state_base,
            ...loaded_data,
            uiSettings: { ...new_state_base.uiSettings, ...(loaded_data.uiSettings || {}) },
            saveFileVersion: APP_STATE_VERSION
        };
        if (!Array.isArray(merged_state.archivedRequirementResults)) {
            merged_state.archivedRequirementResults = [];
        }

        traverse_all_pass_criteria(merged_state, ({ check_result, pc_key, pc_result }) => {
            const pc_value = pc_result as Record<string, unknown> | string;
            if (typeof pc_value === 'string') {
                check_result.passCriteria = check_result.passCriteria ?? {};
                (check_result.passCriteria as Record<string, unknown>)[pc_key] = {
                    status: pc_value,
                    observationDetail: '',
                    timestamp: merged_state.startTime || null,
                    attachedMediaFilenames: []
                };
            } else if (
                typeof pc_value === 'object' &&
                pc_value !== null &&
                !Array.isArray((pc_value as Record<string, unknown>).attachedMediaFilenames)
            ) {
                (pc_value as Record<string, unknown>).attachedMediaFilenames = [];
            }
        });

        const stuck_accum = new WeakMap<RequirementResultNode, string[]>();
        traverse_all_pass_criteria(merged_state, ({ req_result, pc_result }) => {
            const s = (String((pc_result as { stuckProblemDescription?: string })?.stuckProblemDescription || '')).trim();
            if (s) {
                let arr = stuck_accum.get(req_result as RequirementResultNode);
                if (!arr) {
                    arr = [];
                    stuck_accum.set(req_result as RequirementResultNode, arr);
                }
                arr.push(s);
            }
            if (pc_result && typeof pc_result === 'object') {
                delete (pc_result as { stuckProblemDescription?: string }).stuckProblemDescription;
            }
        });

        traverse_all_requirement_results(merged_state, ({ req_result }) => {
            const rr = req_result as RequirementResultNode & { stuckProblemDescription?: unknown };
            const parts = stuck_accum.get(req_result as RequirementResultNode);
            if (parts && parts.length > 0) {
                rr.stuckProblemDescription = parts.join('\n\n');
            }
            if (typeof rr.stuckProblemDescription !== 'string') {
                rr.stuckProblemDescription = '';
            }
        });

        if (!merged_state.deficiencyCounter) merged_state.deficiencyCounter = 1;
        merged_state = AuditLogic.recalculateAuditTimes(merged_state);
        merged_state.manageUsersText = current_state.manageUsersText ?? '';
        let loaded_final: any = AuditLogic.recalculateStatusesOnLoad(merged_state);
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

export function reduce_set_remote_audit_id (current_state: any, action: any) {
    const next: Record<string, unknown> = {
        ...current_state,
        auditId: action.payload.auditId,
        ruleSetId: action.payload.ruleSetId ?? current_state.ruleSetId,
        version: action.payload.version ?? current_state.version
    };
    if (typeof action.payload.updated_at === 'string' && action.payload.updated_at) {
        next.updated_at = action.payload.updated_at;
    }
    return next;
}

export function reduce_replace_state_from_remote (current_state: any, action: any) {
    const remote = action.payload;
    if (!remote || typeof remote !== 'object') return current_state;
    let merged_remote: any = {
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

/**
 * @fileoverview Media-räkning, "kört fast"-problem, byggande av resultatobjekt, bifogade bilder.
 */

import { traverse_all_pass_criteria } from '../utils/traverse_audit_data.js';
import type {
    AuditStateShape,
    CheckDef,
    CheckResultStored,
    PassCriterionDef,
    PassCriterionStored,
    RequirementDef,
    RequirementResultStored,
    SampleStored
} from './audit_logic_types.js';
import { find_requirement_by_id } from './audit_logic_lookup.js';

export function count_attached_images(state: AuditStateShape | null | undefined): number {
    if (!state?.samples) return 0;
    let count = 0;
    traverse_all_pass_criteria(state, ({ pc_result }) => {
        const filenames = pc_result.attachedMediaFilenames;
        if (Array.isArray(filenames)) {
            count += filenames.length;
        }
    });
    return count;
}

export function count_attached_media_places(state: AuditStateShape | null | undefined): number {
    if (!state?.samples) return 0;
    let count = 0;
    traverse_all_pass_criteria(state, ({ pc_result }) => {
        const filenames = pc_result?.attachedMediaFilenames;
        if (Array.isArray(filenames) && filenames.some((f) => f && String(f).trim())) {
            count += 1;
        }
    });
    return count;
}

export function collect_audit_problems(state: AuditStateShape): Array<{
    requirement: RequirementDef;
    sample: SampleStored;
    reqId: string;
    stuck_text: string;
    lastStatusUpdate: string | null;
}> {
    if (!state?.samples || !state?.ruleFileContent?.requirements) return [];
    const problems: Array<{
        requirement: RequirementDef;
        sample: SampleStored;
        reqId: string;
        stuck_text: string;
        lastStatusUpdate: string | null;
    }> = [];
    const requirements = state.ruleFileContent.requirements;

    (state.samples || []).forEach((sample) => {
        Object.entries(sample.requirementResults || {}).forEach(([reqId, reqResult]) => {
            const stuck_text = (reqResult?.stuckProblemDescription || '').trim();
            if (!stuck_text) return;

            const requirement =
                find_requirement_by_id(requirements, reqId) || { id: reqId, key: reqId, title: String(reqId) };

            problems.push({
                requirement,
                sample,
                reqId,
                stuck_text,
                lastStatusUpdate: reqResult?.lastStatusUpdate || null
            });
        });
    });
    problems.sort((a, b) => {
        const ta = a.lastStatusUpdate || '';
        const tb = b.lastStatusUpdate || '';
        return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    return problems;
}

export function count_audit_problems(state: AuditStateShape): number {
    return collect_audit_problems(state).length;
}

export function requirement_needs_help(req_result: RequirementResultStored | null | undefined): boolean {
    return (req_result?.stuckProblemDescription || '').trim() !== '';
}

export function build_passed_requirement_result(
    requirement_definition: RequirementDef,
    existing_result: RequirementResultStored | null | undefined,
    timestamp: string,
    updatedBy?: string
): RequirementResultStored {
    const checks = requirement_definition?.checks ?? [];
    const checkResults: Record<string, CheckResultStored> = {};

    checks.forEach((check_def: CheckDef) => {
        const passCriteria: Record<string, PassCriterionStored> = {};
        (check_def.passCriteria ?? []).forEach((pc_def: PassCriterionDef) => {
            const pc_id = String(pc_def.id ?? '');
            const pc: PassCriterionStored = {
                status: 'passed',
                observationDetail: '',
                timestamp: timestamp,
                attachedMediaFilenames: []
            };
            if (updatedBy) pc.updatedBy = updatedBy;
            passCriteria[pc_id] = pc;
        });
        checkResults[String(check_def.id ?? '')] = {
            status: 'passed',
            overallStatus: 'passed',
            passCriteria
        };
    });

    const result: RequirementResultStored = {
        status: 'passed',
        commentToAuditor:
            existing_result?.commentToAuditor !== undefined ? String(existing_result.commentToAuditor) : '',
        commentToActor: existing_result?.commentToActor !== undefined ? String(existing_result.commentToActor) : '',
        lastStatusUpdate: timestamp,
        stuckProblemDescription:
            existing_result?.stuckProblemDescription !== undefined
                ? String(existing_result.stuckProblemDescription)
                : '',
        checkResults
    };
    if (updatedBy) result.lastStatusUpdateBy = updatedBy;
    return result;
}

export function build_not_applicable_requirement_result(
    requirement_definition: RequirementDef,
    existing_result: RequirementResultStored | null | undefined,
    timestamp: string,
    updatedBy?: string
): RequirementResultStored {
    const checks = requirement_definition?.checks ?? [];
    const checkResults: Record<string, CheckResultStored> = {};

    checks.forEach((check_def: CheckDef) => {
        const passCriteria: Record<string, PassCriterionStored> = {};
        (check_def.passCriteria ?? []).forEach((pc_def: PassCriterionDef) => {
            const pc_id = String(pc_def.id ?? '');
            const pc: PassCriterionStored = {
                status: 'passed',
                observationDetail: '',
                timestamp: timestamp,
                attachedMediaFilenames: []
            };
            if (updatedBy) pc.updatedBy = updatedBy;
            passCriteria[pc_id] = pc;
        });
        checkResults[String(check_def.id ?? '')] = {
            status: 'passed',
            overallStatus: 'not_applicable',
            passCriteria
        };
    });

    const result: RequirementResultStored = {
        status: 'passed',
        commentToAuditor:
            existing_result?.commentToAuditor !== undefined ? String(existing_result.commentToAuditor) : '',
        commentToActor: existing_result?.commentToActor !== undefined ? String(existing_result.commentToActor) : '',
        lastStatusUpdate: timestamp,
        stuckProblemDescription: '',
        checkResults
    };
    if (updatedBy) result.lastStatusUpdateBy = updatedBy;
    return result;
}

export function collect_attached_images(state: AuditStateShape): Array<Record<string, unknown>> {
    if (!state?.samples || !state?.ruleFileContent?.requirements) return [];
    const images: Array<Record<string, unknown>> = [];
    const requirements = state.ruleFileContent.requirements;

    (state.samples ?? []).forEach((sample) => {
        Object.entries(sample.requirementResults ?? {}).forEach(([reqId, reqResultRaw]) => {
            const reqResult = reqResultRaw as RequirementResultStored;
            const requirement =
                (Array.isArray(requirements)
                    ? requirements.find((r: RequirementDef) => (r?.key || r?.id) === reqId)
                    : (requirements as Record<string, RequirementDef>)[reqId]) || null;
            if (!requirement) return;

            const checks_arr = requirement.checks ?? [];
            Object.entries(reqResult.checkResults ?? {}).forEach(([checkId, checkResultRaw]) => {
                const checkResult = checkResultRaw as CheckResultStored;
                const check_def = checks_arr.find((c) => (c?.id || c?.key) === checkId);
                const check_index = check_def ? checks_arr.indexOf(check_def) : -1;
                const pc_arr = check_def?.passCriteria ?? [];
                Object.entries(checkResult.passCriteria ?? {}).forEach(([pcId, pcResultRaw]) => {
                    const pcResult = pcResultRaw as PassCriterionStored;
                    const filenames = pcResult?.attachedMediaFilenames;
                    if (!Array.isArray(filenames) || filenames.length === 0) return;
                    const pc_def = pc_arr.find((p) => (p?.id || p?.key) === pcId) || {};
                    const pc_index = pc_arr.indexOf(pc_def);
                    filenames.forEach((filename: unknown) => {
                        if (filename && String(filename).trim()) {
                            images.push({
                                requirement,
                                sample,
                                reqId,
                                checkId,
                                pcId,
                                check_def: check_def || null,
                                pc_def,
                                check_index,
                                pc_index,
                                filename: String(filename).trim()
                            });
                        }
                    });
                });
            });
        });
    });
    return images;
}

/**
 * @fileoverview Brist-ID:n: formatering, borttagning, sorterad tilldelning vid låsning, inkrementell uppdatering.
 */

import { consoleManager } from '../utils/console_manager.js';
import {
    traverse_all_pass_criteria
} from '../utils/traverse_audit_data.js';
import type {
    AuditStateShape,
    CheckDef,
    PassCriterionDef,
    PassCriterionStored,
    RequirementDef
} from './audit_logic_types.js';
import { find_requirement_definition } from './audit_logic_lookup.js';
import { get_audit_translation_t } from './audit_logic_i18n.js';

type FailedCriterionRow = {
    sampleDescription?: string;
    reqRefText?: string;
    pcRequirementText?: string;
    resultObjectToUpdate: PassCriterionStored;
};

export function formatDeficiencyId(number: number, totalCount: number): string {
    const t = get_audit_translation_t();

    let padding = 1;
    if (totalCount >= 100) {
        padding = 3;
    } else if (totalCount >= 10) {
        padding = 2;
    }

    return `${t('deficiency_prefix', { defaultValue: 'B' })}${String(number).padStart(padding, '0')}`;
}

export function removeAllDeficiencyIds(auditState: AuditStateShape): AuditStateShape {
    consoleManager.log('[AuditLogic] Removing all deficiency IDs...');
    const newState = JSON.parse(JSON.stringify(auditState)) as AuditStateShape;

    traverse_all_pass_criteria(newState, ({ pc_result }) => {
        delete pc_result.deficiencyId;
    });

    newState.deficiencyCounter = 1;
    return newState;
}

export function assignSortedDeficiencyIdsOnLock(auditState: AuditStateShape): AuditStateShape {
    consoleManager.log('[AuditLogic] Running assignSortedDeficiencyIdsOnLock...');
    const newState = JSON.parse(JSON.stringify(auditState)) as AuditStateShape;
    newState.deficiencyCounter = 1;

    const rule_file = newState.ruleFileContent;
    const samples = newState.samples;
    if (!rule_file?.requirements || !samples) {
        return newState;
    }

    traverse_all_pass_criteria(newState, ({ pc_result }) => {
        delete pc_result.deficiencyId;
    });

    const reqs_raw = rule_file.requirements;
    const req_order_keys = Array.isArray(reqs_raw) ? [] : Object.keys(reqs_raw as Record<string, RequirementDef>);

    const failedCriteria: FailedCriterionRow[] = [];
    samples.forEach((sample) => {
        const req_results = sample.requirementResults ?? {};
        const sortedReqKeys = Object.keys(req_results).sort((a, b) => {
            const indexA = req_order_keys.indexOf(a);
            const indexB = req_order_keys.indexOf(b);
            return indexA - indexB;
        });

        sortedReqKeys.forEach((reqKey) => {
            const reqResult = req_results[reqKey];
            const reqDef =
                find_requirement_definition(rule_file.requirements, reqKey) ||
                (!Array.isArray(reqs_raw) ? (reqs_raw as Record<string, RequirementDef>)[reqKey] : undefined);
            if (!reqDef || !reqResult) return;

            const sortedCheckKeys = Object.keys(reqResult.checkResults ?? {}).sort((a, b) => {
                const checkOrder = (reqDef.checks ?? []).map((c: CheckDef) => c.id ?? '');
                return checkOrder.indexOf(a) - checkOrder.indexOf(b);
            });

            sortedCheckKeys.forEach((checkKey) => {
                const checkResult = (reqResult.checkResults ?? {})[checkKey];
                const checkDef = (reqDef.checks ?? []).find((c: CheckDef) => c.id === checkKey);
                if (!checkDef || !checkResult) return;

                const sortedPcKeys = Object.keys(checkResult.passCriteria ?? {}).sort((a, b) => {
                    const pcOrder = (checkDef.passCriteria ?? []).map((pc: PassCriterionDef) => pc.id ?? '');
                    return pcOrder.indexOf(a) - pcOrder.indexOf(b);
                });

                sortedPcKeys.forEach((pcKey) => {
                    const pcMap = checkResult.passCriteria ?? {};
                    const pcResult = pcMap[pcKey];
                    const pcDef = (checkDef.passCriteria ?? []).find((pc: PassCriterionDef) => pc.id === pcKey);
                    const originalPcResultRef = samples
                        .find((s) => s.id === sample.id)
                        ?.requirementResults?.[reqKey]
                        ?.checkResults?.[checkKey]
                        ?.passCriteria?.[pcKey];

                    if (pcResult?.status === 'failed' && pcDef && originalPcResultRef) {
                        failedCriteria.push({
                            sampleDescription: sample.description as string | undefined,
                            reqRefText: (reqDef.standardReference?.text || reqDef.title) as string | undefined,
                            pcRequirementText: pcDef.requirement,
                            resultObjectToUpdate: originalPcResultRef as PassCriterionStored
                        });
                    }
                });
            });
        });
    });

    let counter = 1;
    const totalCount = failedCriteria.length;
    failedCriteria.forEach((item) => {
        item.resultObjectToUpdate.deficiencyId = formatDeficiencyId(counter, totalCount);
        counter += 1;
    });
    newState.deficiencyCounter = counter;

    return newState;
}

export function updateIncrementalDeficiencyIds(
    auditState: AuditStateShape | null | undefined
): AuditStateShape | null | undefined {
    if (!auditState) return auditState;
    const newState = JSON.parse(JSON.stringify(auditState)) as AuditStateShape;

    traverse_all_pass_criteria(newState, ({ pc_result }) => {
        if (pc_result.status !== 'failed' && pc_result.deficiencyId) {
            delete pc_result.deficiencyId;
        }
    });

    return newState;
}

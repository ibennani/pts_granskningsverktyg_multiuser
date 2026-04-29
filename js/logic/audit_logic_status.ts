/**
 * @fileoverview Beräkning av kontrollpunkts- och kravstatus samt kanonisk effektiv status.
 */

import type {
    CheckDef,
    PassCriterionStatusMapVal,
    RequirementDef,
    RequirementResultStored
} from './audit_logic_types.js';
import { get_stored_requirement_result_for_def } from './audit_logic_lookup.js';

export function calculate_check_status(
    check_object: CheckDef | null | undefined,
    pass_criteria_statuses_map: Record<string, PassCriterionStatusMapVal> | null | undefined,
    overall_manual_status = 'not_audited'
): string {
    if (!check_object?.passCriteria || check_object.passCriteria.length === 0) return 'passed';

    if (overall_manual_status === 'failed') return 'failed';
    if (overall_manual_status === 'not_applicable') return 'passed';
    if (overall_manual_status === 'not_audited') return 'not_audited';

    const pc_statuses = (check_object.passCriteria ?? []).map((pc) => {
        const pc_data = (pass_criteria_statuses_map ?? {})[pc.id ?? ''];
        return typeof pc_data === 'object' && pc_data !== null
            ? (pc_data as { status?: string }).status
            : (pc_data || 'not_audited');
    });

    const logic = (check_object.logic || 'AND').toUpperCase();

    if (logic === 'OR') {
        const has_passed = pc_statuses.some((s) => s === 'passed');
        const has_not_audited = pc_statuses.some((s) => s === 'not_audited');
        const all_not_audited = pc_statuses.every((s) => s === 'not_audited');
        const all_audited_and_failed = !pc_statuses.some((s) => s === 'not_audited') && !has_passed;

        if (has_passed) return 'passed';
        if (all_not_audited) return 'partially_audited';
        if (all_audited_and_failed) return 'failed';
        if (has_not_audited && !has_passed) return 'partially_audited';
        return 'failed';
    }
    if (pc_statuses.some((s) => s === 'failed')) return 'failed';
    if (pc_statuses.some((s) => s === 'not_audited')) return 'partially_audited';
    return 'passed';
}

export function calculate_requirement_status(
    requirement_object: RequirementDef | null | undefined,
    requirement_result_object: RequirementResultStored | null | undefined
): string {
    if (!requirement_object || typeof requirement_object !== 'object') {
        console.warn('[AuditLogic] calculate_requirement_status: Invalid requirement_object');
        return 'not_audited';
    }

    if (!requirement_object.checks || !Array.isArray(requirement_object.checks) || requirement_object.checks.length === 0) {
        return requirement_result_object?.status || 'not_audited';
    }

    if (
        !requirement_result_object ||
        typeof requirement_result_object !== 'object' ||
        !requirement_result_object.checkResults
    ) {
        return 'not_audited';
    }

    try {
        let has_failed_check = false;
        let has_partially_audited_check = false;
        let has_not_audited_check = false;
        let has_any_button_pressed = false;

        for (const check_definition of requirement_object.checks) {
            if (!check_definition || typeof check_definition !== 'object' || !check_definition.id) {
                console.warn('[AuditLogic] calculate_requirement_status: Invalid check_definition:', check_definition);
                has_not_audited_check = true;
                continue;
            }

            const checkResultForDef = requirement_result_object.checkResults?.[check_definition.id ?? ''];
            let status = 'not_audited';

            const overall = checkResultForDef?.overallStatus;
            if (overall === 'passed' || overall === 'not_applicable') {
                has_any_button_pressed = true;
            }

            if (checkResultForDef) {
                try {
                    status = calculate_check_status(
                        check_definition,
                        checkResultForDef.passCriteria,
                        checkResultForDef.overallStatus
                    );
                } catch (error) {
                    console.warn('[AuditLogic] calculate_requirement_status: Error calculating check status:', error);
                    status = 'not_audited';
                }
            }

            if (status === 'failed') {
                has_failed_check = true;
                break;
            }
            if (status === 'partially_audited') has_partially_audited_check = true;
            if (status === 'not_audited') has_not_audited_check = true;
        }

        if (has_failed_check) return 'failed';
        if (!has_not_audited_check && !has_partially_audited_check) return 'passed';
        if (has_any_button_pressed) return 'partially_audited';
        return 'not_audited';
    } catch (error) {
        if (window.ConsoleManager?.warn) {
            window.ConsoleManager.warn('[AuditLogic] calculate_requirement_status: Error processing requirement:', error);
        }
        return 'not_audited';
    }
}

export function get_effective_requirement_audit_status(
    requirements: unknown,
    requirement_results: Record<string, RequirementResultStored> | null | undefined,
    req_def: RequirementDef,
    entry_map_key: string | number | null = null
): string {
    const stored = get_stored_requirement_result_for_def(requirement_results, requirements, req_def, entry_map_key);
    return calculate_requirement_status(req_def, stored);
}

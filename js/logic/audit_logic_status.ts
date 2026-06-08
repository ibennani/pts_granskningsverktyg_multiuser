/**
 * @fileoverview Beräkning av kontrollpunkts- och kravstatus samt kanonisk effektiv status.
 */

import type {
    CheckDef,
    CheckResultStored,
    PassCriterionStatusMapVal,
    RequirementDef,
    RequirementResultStored
} from './audit_logic_types.js';
import { get_stored_requirement_result_for_def } from './audit_logic_lookup.js';
import { definition_primary_id, resolve_map_entry } from './entity_id_match.js';

/**
 * Aggregerar barnstatus enligt trestegsmodellen:
 * ogranskad → delvis granskad → (alla klara) underkänd om minst ett fail, annars godkänd.
 */
export function aggregate_child_audit_statuses(
    child_statuses: string[],
    opts: { treat_unstarted_as_partial?: boolean } = {}
): string {
    if (!child_statuses.length) {
        return 'not_audited';
    }

    const any_started = child_statuses.some((s) => s !== 'not_audited');
    const all_complete = child_statuses.every((s) => s === 'passed' || s === 'failed');
    const any_failed = child_statuses.some((s) => s === 'failed');

    if (!any_started) {
        return opts.treat_unstarted_as_partial ? 'partially_audited' : 'not_audited';
    }
    if (!all_complete) {
        return 'partially_audited';
    }
    return any_failed ? 'failed' : 'passed';
}

/**
 * AND-logik: kontrollpunkten är underkänd först när alla godkännandekriterier är underkända.
 * Ett eller flera underkända (men inte alla) → delvis granskad tills bedömningen är klar.
 */
export function aggregate_and_criterion_statuses(
    pc_statuses: string[],
    opts: { treat_unstarted_as_partial?: boolean } = {}
): string {
    if (!pc_statuses.length) {
        return 'not_audited';
    }

    const any_started = pc_statuses.some((s) => s !== 'not_audited');
    const all_failed = pc_statuses.every((s) => s === 'failed');
    const all_passed = pc_statuses.every((s) => s === 'passed');
    const any_failed = pc_statuses.some((s) => s === 'failed');

    if (!any_started) {
        return opts.treat_unstarted_as_partial ? 'partially_audited' : 'not_audited';
    }
    if (all_failed) {
        return 'failed';
    }
    if (any_failed) {
        return 'partially_audited';
    }
    if (all_passed) {
        return 'passed';
    }
    return 'partially_audited';
}

/**
 * OR-logik: ett enda underkänt godkännandekriterium gör hela kontrollpunkten underkänd.
 * Minst ett godkänt utan underkända → utan anmärkning även om övriga ännu inte bedömts.
 */
export function aggregate_or_criterion_statuses(
    pc_statuses: string[],
    opts: { treat_unstarted_as_partial?: boolean } = {}
): string {
    if (!pc_statuses.length) {
        return 'not_audited';
    }

    const any_started = pc_statuses.some((s) => s !== 'not_audited');
    const any_failed = pc_statuses.some((s) => s === 'failed');
    const any_passed = pc_statuses.some((s) => s === 'passed');

    if (!any_started) {
        return opts.treat_unstarted_as_partial ? 'partially_audited' : 'not_audited';
    }
    if (any_failed) {
        return 'failed';
    }
    if (any_passed) {
        return 'passed';
    }
    return 'partially_audited';
}

function check_uses_or_logic(check_object: CheckDef | null | undefined): boolean {
    return (check_object?.logic || 'AND').toUpperCase() === 'OR';
}

/**
 * Effektiv kriteriestatus: vid "Inte aktuellt" på kontrollpunkten räknas kriteriet som godkänt.
 */
export function effective_pass_criterion_status(
    stored_status: string | null | undefined,
    check_overall_status: string | null | undefined
): string {
    if (check_overall_status === 'not_applicable') {
        return 'passed';
    }
    const raw = stored_status || 'not_audited';
    return typeof raw === 'string' ? raw : 'not_audited';
}

function map_pass_criterion_statuses(
    check_object: CheckDef,
    pass_criteria_statuses_map: Record<string, PassCriterionStatusMapVal> | null | undefined,
    check_overall_status: string
): string[] {
    if (check_overall_status === 'not_applicable') {
        return (check_object.passCriteria ?? []).map(() => 'passed');
    }
    return (check_object.passCriteria ?? []).map((pc) => {
        const pc_key = definition_primary_id(pc);
        const resolved = pc_key ? resolve_map_entry(pass_criteria_statuses_map ?? {}, pc_key) : null;
        const pc_data = resolved?.value;
        const raw =
            typeof pc_data === 'object' && pc_data !== null
                ? (pc_data as { status?: string }).status
                : pc_data || 'not_audited';
        return effective_pass_criterion_status(
            typeof raw === 'string' ? raw : 'not_audited',
            check_overall_status
        );
    });
}

export function calculate_check_status(
    check_object: CheckDef | null | undefined,
    pass_criteria_statuses_map: Record<string, PassCriterionStatusMapVal> | null | undefined,
    overall_manual_status = 'not_audited'
): string {
    if (!check_object?.passCriteria || check_object.passCriteria.length === 0) {
        return 'passed';
    }

    if (overall_manual_status === 'failed') {
        return 'failed';
    }
    if (overall_manual_status === 'not_audited') {
        return 'not_audited';
    }

    const pc_statuses = map_pass_criterion_statuses(
        check_object,
        pass_criteria_statuses_map,
        overall_manual_status
    );
    const aggregate_opts = { treat_unstarted_as_partial: overall_manual_status === 'passed' };
    if (check_uses_or_logic(check_object)) {
        return aggregate_or_criterion_statuses(pc_statuses, aggregate_opts);
    }
    return aggregate_and_criterion_statuses(pc_statuses, aggregate_opts);
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
        const check_statuses: string[] = [];
        let has_any_button_pressed = false;

        for (const check_definition of requirement_object.checks) {
            const check_storage_key = definition_primary_id(check_definition);
            if (!check_definition || typeof check_definition !== 'object' || !check_storage_key) {
                console.warn('[AuditLogic] calculate_requirement_status: Invalid check_definition:', check_definition);
                check_statuses.push('not_audited');
                continue;
            }

            const resolved_check = resolve_map_entry(
                requirement_result_object.checkResults as Record<string, CheckResultStored>,
                check_storage_key
            );
            const checkResultForDef = resolved_check?.value;
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

            check_statuses.push(status);
        }

        if (check_statuses.every((s) => s === 'not_audited') && !has_any_button_pressed) {
            return 'not_audited';
        }

        return aggregate_child_audit_statuses(check_statuses);
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

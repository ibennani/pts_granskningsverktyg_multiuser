/**
 * @fileoverview Gemensam traversering av granskningsdata (stickprov → kravresultat
 * → kontrollresultat → bedömningskriterier) så att samma loop inte dupliceras på många ställen.
 */

/** Löst typat resultat för ett bedömningskriterium i lagrat granskningsläge. */
export type PassCriterionResult = Record<string, unknown> & {
    status?: string;
    deficiencyId?: string;
    timestamp?: string;
    attachedMediaFilenames?: unknown;
    observationDetail?: string;
};

export type CheckResultNode = Record<string, unknown> & {
    passCriteria?: Record<string, PassCriterionResult>;
    timestamp?: string;
};

export type RequirementResultNode = Record<string, unknown> & {
    checkResults?: Record<string, CheckResultNode>;
    lastStatusUpdate?: string;
};

export type SampleNode = Record<string, unknown> & {
    id?: string;
    description?: string;
    requirementResults?: Record<string, RequirementResultNode>;
};

export type AuditStateLike = {
    samples?: SampleNode[];
};

export type PassCriteriaTraversalContext = {
    sample: SampleNode;
    req_key: string;
    req_result: RequirementResultNode;
    check_key: string;
    check_result: CheckResultNode;
    pc_key: string;
    pc_result: PassCriterionResult;
};

export type RequirementTraversalContext = {
    sample: SampleNode;
    req_key: string;
    req_result: RequirementResultNode;
};

export type CheckTraversalContext = {
    sample: SampleNode;
    req_key: string;
    req_result: RequirementResultNode;
    check_key: string;
    check_result: CheckResultNode;
};

/**
 * Anropar callback för varje bedömningskriterium under alla stickprov.
 */
export function traverse_all_pass_criteria(
    audit_state: AuditStateLike | null | undefined,
    callback: (ctx: PassCriteriaTraversalContext) => void
): void {
    for (const sample of audit_state?.samples ?? []) {
        const req_map = sample.requirementResults ?? {};
        for (const [req_key, req_result] of Object.entries(req_map)) {
            const checks = req_result.checkResults ?? {};
            for (const [check_key, check_result] of Object.entries(checks)) {
                const pcs = check_result.passCriteria ?? {};
                for (const [pc_key, pc_result] of Object.entries(pcs)) {
                    callback({
                        sample,
                        req_key,
                        req_result,
                        check_key,
                        check_result,
                        pc_key,
                        pc_result: pc_result as PassCriterionResult
                    });
                }
            }
        }
    }
}

/**
 * Anropar callback per kravresultat (utan att gå in i kontroller/kriterier).
 */
export function traverse_all_requirement_results(
    audit_state: AuditStateLike | null | undefined,
    callback: (ctx: RequirementTraversalContext) => void
): void {
    for (const sample of audit_state?.samples ?? []) {
        const req_map = sample.requirementResults ?? {};
        for (const [req_key, req_result] of Object.entries(req_map)) {
            callback({ sample, req_key, req_result });
        }
    }
}

/**
 * Anropar callback per kontrollresultat (alla nivåer under krav).
 */
export function traverse_all_check_results(
    audit_state: AuditStateLike | null | undefined,
    callback: (ctx: CheckTraversalContext) => void
): void {
    for (const sample of audit_state?.samples ?? []) {
        const req_map = sample.requirementResults ?? {};
        for (const [req_key, req_result] of Object.entries(req_map)) {
            const checks = req_result.checkResults ?? {};
            for (const [check_key, check_result] of Object.entries(checks)) {
                callback({ sample, req_key, req_result, check_key, check_result });
            }
        }
    }
}

/**
 * @fileoverview Samlar brist-id och observationstext för Word-export till handläggare.
 */
import { for_each_failed_export_pass_criterion } from './export_deficiency_traversal.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';

export type ObservationExportEntry = {
    deficiencyId: string;
    observationDetail: string;
};

type RequirementCheck = {
    id?: string;
    passCriteria?: Array<{ id?: string; failureStatementTemplate?: string; requirement?: string }>;
};

type RequirementDefinition = {
    checks?: RequirementCheck[];
};

function resolve_observation_text(
    req_definition: RequirementDefinition,
    check_id: string,
    pc_id: string,
    pc_obj: { observationDetail?: string }
): string {
    const pc_def = req_definition.checks
        ?.find((check) => check.id === check_id)
        ?.passCriteria?.find((pc) => pc.id === pc_id);
    const template_observation = pc_def?.failureStatementTemplate || '';
    const user_observation = pc_obj.observationDetail || '';
    const pass_criterion_text = pc_def?.requirement || '';

    if (!user_observation.trim() || user_observation.trim() === template_observation.trim()) {
        return pass_criterion_text;
    }
    return user_observation;
}

function sort_deficiency_entries(entries: ObservationExportEntry[]): ObservationExportEntry[] {
    return [...entries].sort((a, b) => {
        const num_a = parseInt(extractDeficiencyNumber(a.deficiencyId), 10);
        const num_b = parseInt(extractDeficiencyNumber(b.deficiencyId), 10);
        if (Number.isFinite(num_a) && Number.isFinite(num_b) && num_a !== num_b) {
            return num_a - num_b;
        }
        return extractDeficiencyNumber(a.deficiencyId).localeCompare(
            extractDeficiencyNumber(b.deficiencyId),
            undefined,
            { numeric: true }
        );
    });
}

/**
 * Returnerar alla unika brister med observationstext, sorterade på brist-id.
 */
export function collect_observation_export_deficiencies(current_audit: unknown): ObservationExportEntry[] {
    if (!current_audit) return [];

    const by_id = new Map<string, ObservationExportEntry>();

    for_each_failed_export_pass_criterion(current_audit, ({
        req_definition,
        check_id,
        pc_id,
        pc_obj,
    }) => {
        const deficiency_id = String(pc_obj.deficiencyId || '').trim();
        if (!deficiency_id || by_id.has(deficiency_id)) return;

        by_id.set(deficiency_id, {
            deficiencyId: deficiency_id,
            observationDetail: resolve_observation_text(
                req_definition as RequirementDefinition,
                check_id,
                pc_id,
                pc_obj
            ),
        });
    });

    return sort_deficiency_entries([...by_id.values()]);
}

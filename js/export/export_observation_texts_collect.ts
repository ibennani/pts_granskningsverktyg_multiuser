/**
 * @fileoverview Samlar brist-id och observationstext för Word-export till handläggare.
 */
import { for_each_failed_export_pass_criterion } from './export_deficiency_traversal.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';

type RequirementCheck = {
    id?: string;
    passCriteria?: Array<{ id?: string; failureStatementTemplate?: string; requirement?: string }>;
};

export type ObservationExportSample = {
    description?: string;
    url?: string;
};

export type ObservationExportRequirement = {
    title?: string;
    standardReference?: { text?: string; url?: string };
    classifications?: Array<{ taxonomyId?: string; conceptId?: string }>;
    checks?: RequirementCheck[];
};

export type ObservationExportEntry = {
    deficiencyId: string;
    observationDetail: string;
    req_definition: ObservationExportRequirement;
    sample: ObservationExportSample;
};

function resolve_observation_text(
    req_definition: ObservationExportRequirement,
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

function to_export_sample(sample: unknown): ObservationExportSample {
    const s = sample as { description?: string; url?: string } | null | undefined;
    return {
        description: s?.description,
        url: s?.url,
    };
}

/**
 * Returnerar alla unika brister med observationstext, sorterade på brist-id.
 */
export function collect_observation_export_deficiencies(current_audit: unknown): ObservationExportEntry[] {
    if (!current_audit) return [];

    const by_id = new Map<string, ObservationExportEntry>();

    for_each_failed_export_pass_criterion(current_audit, ({
        sample,
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
                req_definition as ObservationExportRequirement,
                check_id,
                pc_id,
                pc_obj
            ),
            req_definition: req_definition as ObservationExportRequirement,
            sample: to_export_sample(sample),
        });
    });

    return sort_deficiency_entries([...by_id.values()]);
}

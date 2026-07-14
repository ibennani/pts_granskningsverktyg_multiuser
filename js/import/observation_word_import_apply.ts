/**
 * @fileoverview Bygger state-ändringar för import av handläggar-Word.
 */
import { build_deficiency_location_index } from './observation_word_import_diff.js';
import type {
    ObservationWordImportApplyPayload,
    ObservationWordImportChange,
    ObservationWordImportDiffResult,
} from './observation_word_import_types.js';

/**
 * Skapar payload för APPLY_OBSERVATION_WORD_IMPORT utifrån diff-resultat.
 */
export function build_observation_word_import_apply_payload(
    audit: unknown,
    diff: ObservationWordImportDiffResult
): ObservationWordImportApplyPayload {
    const changes: ObservationWordImportChange[] = [];
    if (!diff.can_import) {
        return { changes };
    }

    const location_index = build_deficiency_location_index(audit);

    for (const item of diff.items) {
        const location = location_index.get(item.id_number);
        if (!location) continue;

        if (item.status === 'changed') {
            changes.push({
                sample_id: location.sample_id,
                requirement_id: location.requirement_id,
                check_id: location.check_id,
                pc_id: location.pc_id,
                action: 'update_text',
                observation_detail: item.word_text ?? '',
            });
            continue;
        }

        if (item.status === 'missing_in_word') {
            changes.push({
                sample_id: location.sample_id,
                requirement_id: location.requirement_id,
                check_id: location.check_id,
                pc_id: location.pc_id,
                action: 'clear_deficiency',
            });
        }
    }

    return { changes };
}

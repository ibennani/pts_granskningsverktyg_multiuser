/**
 * @fileoverview Formatering av brist-id för visning i granskningsgränssnittet.
 */

import { extractDeficiencyNumber } from '../export/export_format_helpers.js';

export type DeficiencyIdTranslateFn = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Returnerar etikett t.ex. "Brist-id: 027" eller null om id saknas.
 */
export function format_deficiency_id_label(
    deficiency_id: unknown,
    t: DeficiencyIdTranslateFn
): string | null {
    const number = extractDeficiencyNumber(deficiency_id);
    if (!number) return null;
    return t('pass_criterion_deficiency_id_label', { id: number });
}

/**
 * Om brist-id ska visas i titelraden (låst granskning, underkänt kriterium).
 */
export function should_show_deficiency_id_in_title(
    audit_frozen: boolean,
    pc_status: string | undefined,
    deficiency_id: unknown
): boolean {
    return Boolean(audit_frozen && pc_status === 'failed' && deficiency_id);
}

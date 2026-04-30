/**
 * @fileoverview Gemensam bootstrap för export: översättning, notifiering, kanoniskt kravresultat.
 */

import { get_stored_requirement_result_for_def } from '../audit_logic.js';
import type { RequirementResultStored } from '../logic/audit_logic_types.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import { get_translation_t } from '../utils/translation_access.js';

export function get_t_internal() {
    return get_translation_t();
}

type NotificationLike = { show_global_message?: (message: string, type: string, duration?: number) => void };

export function show_global_message_internal(message: string, type: string, duration?: number) {
    const nc = app_runtime_refs.notification_component as NotificationLike | null;
    if (nc && typeof nc.show_global_message === 'function') {
        nc.show_global_message(message, type, duration);
    }
}

/** Kanoniskt kravresultat per stickprov (samma uppslag som granskning och audit_logic). */
export function get_export_requirement_result(requirements: unknown, sample: unknown, req_definition: unknown) {
    if (!requirements || !sample || !req_definition) return undefined;
    const results = (sample as { requirementResults?: Record<string, RequirementResultStored> | null | undefined })
        .requirementResults;
    return get_stored_requirement_result_for_def(results, requirements, req_definition, null);
}

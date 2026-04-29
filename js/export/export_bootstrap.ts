// @ts-nocheck
/**
 * @fileoverview Gemensam bootstrap för export: översättning, notifiering, kanoniskt kravresultat.
 */

import { get_stored_requirement_result_for_def } from '../audit_logic.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import { get_translation_t } from '../utils/translation_access.js';

export function get_t_internal() {
    return get_translation_t();
}

export function show_global_message_internal(message, type, duration) {
    const nc = app_runtime_refs.notification_component;
    if (typeof nc !== 'undefined' && typeof nc.show_global_message === 'function') {
        nc.show_global_message(message, type, duration);
    }
}

/** Kanoniskt kravresultat per stickprov (samma uppslag som granskning och audit_logic). */
export function get_export_requirement_result(requirements, sample, req_definition) {
    if (!requirements || !sample || !req_definition) return undefined;
    return get_stored_requirement_result_for_def(
        sample.requirementResults,
        requirements,
        req_definition,
        null
    );
}

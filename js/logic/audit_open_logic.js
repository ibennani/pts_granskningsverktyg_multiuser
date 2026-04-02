// js/logic/audit_open_logic.js
// Gemensam logik för att öppna och ladda ner granskningar baserat på audit-id.

import { load_audit_with_rule_file } from '../api/client.js';
import { is_fetch_network_error } from './connectivity_service.js';

function get_translation_func(Translation) {
    if (Translation && typeof Translation.t === 'function') {
        return Translation.t.bind(Translation);
    }
    return (key) => key;
}

/**
 * Navigerar till standardvy för en granskning utifrån status och stickprov (efter LOAD i state).
 * @param {Object} full_state
 * @param {function(string, Object): void} router
 */
export function navigate_to_default_audit_view(full_state, router) {
    if (!full_state || typeof router !== 'function') return;
    const status = full_state.auditStatus || 'not_started';
    const samples = full_state.samples || [];
    let next_view = 'audit_overview';
    if (status === 'not_started' && samples.length === 0) {
        next_view = 'sample_management';
    } else if (status === 'not_started') {
        next_view = 'metadata';
    }
    const aid = (full_state.auditId !== null && full_state.auditId !== undefined && full_state.auditId !== '')
        ? String(full_state.auditId)
        : null;
    router(next_view, aid ? { auditId: aid } : {});
}

/**
 * Öppnar en granskning genom att ladda den från servern, validera och uppdatera state.
 * Navigerar sedan vidare till lämplig vy baserat på status/innehåll.
 *
 * @param {Object} params
 * @param {string|number} params.audit_id
 * @param {function} params.dispatch
 * @param {Object} params.StoreActionTypes
 * @param {Object} params.ValidationLogic
 * @param {function} params.router
 * @param {Object} [params.NotificationComponent]
 * @param {function} [params.t] - Översättningsfunktion
 * @returns {Promise<boolean>} true om allt lyckades, annars false
 */
export async function open_audit_by_id(params) {
    const {
        audit_id,
        dispatch,
        StoreActionTypes,
        ValidationLogic,
        router,
        NotificationComponent,
        t: t_input
    } = params || {};

    const t = typeof t_input === 'function' ? t_input : get_translation_func(globalThis.Translation);

    if (!audit_id || !dispatch || !StoreActionTypes || !ValidationLogic || !router) {
        return false;
    }

    try {
        const full_state = await load_audit_with_rule_file(audit_id);
        const validation = ValidationLogic?.validate_saved_audit_file?.(full_state, { t });

        if (full_state && validation?.isValid) {
            dispatch({
                type: StoreActionTypes.LOAD_AUDIT_FROM_FILE,
                payload: full_state
            });

            if (NotificationComponent?.show_global_message) {
                NotificationComponent.show_global_message(t('saved_audit_loaded_successfully'), 'success');
            }

            navigate_to_default_audit_view(full_state, router);
            return true;
        }

        if (validation && !validation.isValid && NotificationComponent?.show_global_message) {
            NotificationComponent.show_global_message(
                validation.message || t('error_invalid_saved_audit_file'),
                'error'
            );
        }
    } catch (err) {
        if (NotificationComponent?.show_global_message) {
            if (is_fetch_network_error(err)) {
                NotificationComponent.show_global_message(
                    t('connectivity_offline_cannot_open_audit'),
                    'warning'
                );
            } else {
                NotificationComponent.show_global_message(
                    t('server_load_audit_error', { message: err.message }) || err.message,
                    'error'
                );
            }
        }
    }

    return false;
}

/**
 * Laddar ner en granskning som JSON-fil baserat på audit-id.
 *
 * @param {Object} params
 * @param {string|number} params.audit_id
 * @param {Object} params.ValidationLogic
 * @param {Object} params.SaveAuditLogic
 * @param {Object} [params.NotificationComponent]
 * @param {function} [params.t] - Översättningsfunktion
 * @returns {Promise<boolean>} true om nedladdningen lyckades, annars false
 */
export async function download_audit_by_id(params) {
    const {
        audit_id,
        ValidationLogic,
        SaveAuditLogic,
        NotificationComponent,
        t: t_input
    } = params || {};

    const t = typeof t_input === 'function' ? t_input : get_translation_func(globalThis.Translation);
    const show_msg = NotificationComponent?.show_global_message?.bind(NotificationComponent);

    if (!audit_id || !ValidationLogic || !SaveAuditLogic) {
        return false;
    }

    try {
        const full_state = await load_audit_with_rule_file(audit_id);
        const is_valid = ValidationLogic?.validate_saved_audit_file?.(full_state)?.isValid;

        if (full_state?.ruleFileContent && is_valid) {
            if (typeof SaveAuditLogic.save_audit_to_json_file === 'function') {
                await SaveAuditLogic.save_audit_to_json_file(full_state, t, show_msg);
                return true;
            }
            if (show_msg) show_msg(t('error_internal'), 'error');
            return false;
        }

        if (show_msg) show_msg(t('error_invalid_saved_audit_file'), 'error');
    } catch (err) {
        if (show_msg) {
            show_msg(
                t('server_load_audit_error', { message: err.message }) || err.message,
                'error'
            );
        }
    }

    return false;
}


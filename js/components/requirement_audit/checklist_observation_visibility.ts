/**
 * @fileoverview Synklogik för observationsfält och kriterielista i ChecklistHandler.
 * En källa för när textarea ska visas/döljas utifrån sparad status.
 */

import { resolve_map_entry } from '../../logic/entity_id_match.js';

export type PassCriterionStoredSlice = {
    status: string;
    observationDetail: string;
    deficiencyId?: unknown;
    attachedMediaFilenames?: unknown[];
};

/** Effektiv kriteriestatus givet kontrollpunktens overallStatus. */
export function effective_pc_status(
    overall_manual_status: string | null | undefined,
    pc_status: string | null | undefined
): string {
    if (overall_manual_status === 'not_applicable') {
        return 'passed';
    }
    return pc_status || 'not_audited';
}

/** Observationsfältet ska endast synas vid underkänt kriterium. */
export function should_show_observation_wrapper(
    overall_manual_status: string | null | undefined,
    pc_status: string | null | undefined
): boolean {
    return effective_pc_status(overall_manual_status, pc_status) === 'failed';
}

/** Kriterielistan visas när kontrollpunkten har Stämmer. */
export function should_show_pass_criteria_list(
    overall_manual_status: string | null | undefined,
    pass_criteria_count: number
): boolean {
    return overall_manual_status === 'passed' && pass_criteria_count > 0;
}

/**
 * Läser kriteriedata tolerant mot id/key-strängskillnader i passCriteria-map.
 */
export function read_pc_stored_data(
    check_result_data: { passCriteria?: Record<string, unknown> } | null | undefined,
    pc_id: string | null | undefined
): PassCriterionStoredSlice {
    if (!pc_id) {
        return { status: 'not_audited', observationDetail: '' };
    }
    const resolved = resolve_map_entry(check_result_data?.passCriteria, pc_id);
    const raw = resolved?.value;
    if (typeof raw === 'string') {
        return { status: raw, observationDetail: '' };
    }
    if (typeof raw === 'object' && raw !== null) {
        const obj = raw as PassCriterionStoredSlice;
        return {
            status: obj.status || 'not_audited',
            observationDetail: typeof obj.observationDetail === 'string' ? obj.observationDetail : '',
            deficiencyId: obj.deficiencyId,
            attachedMediaFilenames: Array.isArray(obj.attachedMediaFilenames)
                ? obj.attachedMediaFilenames
                : []
        };
    }
    return { status: 'not_audited', observationDetail: '' };
}

export type ObservationUiAudit = {
    mismatch: boolean;
    reasons: string[];
    effective_pc_status: string;
    should_show_wrapper: boolean;
    wrapper_visible: boolean;
    failed_button_active: boolean | null;
};

/** Jämför DOM med sparad status — används vid felsökning av synk. */
export function audit_observation_ui(params: {
    overall_manual_status: string | null | undefined;
    pc_status: string | null | undefined;
    wrapper_visible: boolean;
    failed_button_active: boolean | null;
}): ObservationUiAudit {
    const effective = effective_pc_status(params.overall_manual_status, params.pc_status);
    const should_show = should_show_observation_wrapper(params.overall_manual_status, params.pc_status);
    const reasons: string[] = [];
    if (params.wrapper_visible !== should_show) {
        reasons.push(
            params.wrapper_visible
                ? 'textarea_synlig_men_inte_underkänt_i_data'
                : 'textarea_dold_men_underkänt_i_data'
        );
    }
    if (params.failed_button_active !== null) {
        const want_failed_active = effective === 'failed';
        if (params.failed_button_active !== want_failed_active) {
            reasons.push('underkänt_knapp_matchar_inte_data');
        }
    }
    return {
        mismatch: reasons.length > 0,
        reasons,
        effective_pc_status: effective,
        should_show_wrapper: should_show,
        wrapper_visible: params.wrapper_visible,
        failed_button_active: params.failed_button_active
    };
}

export type ObservationWrapperApplyResult = {
    applied: boolean;
    deferred_hide: boolean;
};

/**
 * Sätter hidden på observationswrapper utifrån data.
 * Döljer inte medan fokus ligger i wrapper (undviker omotiverad fokusflytt).
 */
export function apply_observation_wrapper_visibility(
    wrapper: Element | null | undefined,
    overall_manual_status: string | null | undefined,
    pc_status: string | null | undefined,
    active_element: Element | null = null
): ObservationWrapperApplyResult {
    if (!wrapper || !(wrapper instanceof HTMLElement)) {
        return { applied: false, deferred_hide: false };
    }
    const should_show = should_show_observation_wrapper(overall_manual_status, pc_status);
    const active = active_element ?? (typeof document !== 'undefined' ? document.activeElement : null);
    if (!should_show && active instanceof Node && wrapper.contains(active)) {
        return { applied: false, deferred_hide: true };
    }
    wrapper.hidden = !should_show;
    return { applied: true, deferred_hide: false };
}

/** Läser kontrollpunktens resultat tolerant mot id/key i checkResults-map. */
export function read_check_stored_data(
    check_results: Record<string, unknown> | null | undefined,
    check_id: string | null | undefined
): { overallStatus?: string; status?: string; passCriteria?: Record<string, unknown> } | null {
    if (!check_id) return null;
    const resolved = resolve_map_entry(check_results, check_id);
    const raw = resolved?.value;
    if (typeof raw === 'object' && raw !== null) {
        return raw as { overallStatus?: string; status?: string; passCriteria?: Record<string, unknown> };
    }
    return null;
}

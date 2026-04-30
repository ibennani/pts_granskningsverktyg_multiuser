/**
 * @file Defensiv normalisering av app-state som lästs från JSON (sessionStorage,
 * localStorage-backup). Säkerställer att listor är arrayer och att kända fält
 * har typer som reducers och vyer förväntar sig, så att t.ex. `.map` inte kastar.
 */

import { initial_state } from '../state/initialState.js';

/** Returnerar en array; annars tom lista. */
export function coerce_to_array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

/** Tillåtna värden för auditStatus inkl. internt fel-läge från getState-fallback. */
const AUDIT_STATUS_WHITELIST = new Set([
    'not_started',
    'in_progress',
    'locked',
    'archived',
    'rulefile_editing',
    'error'
]);

export function coerce_audit_status(value: unknown): string {
    if (typeof value === 'string' && AUDIT_STATUS_WHITELIST.has(value)) {
        return value;
    }
    return 'not_started';
}

export function coerce_rule_file_content(value: unknown): unknown {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return null;
}

export function coerce_audit_metadata(
    value: unknown,
    template: Record<string, unknown>
): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ...template };
    }
    return { ...template, ...(value as Record<string, unknown>) };
}

function deep_clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export function coerce_plain_object_or_empty(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

export function coerce_ui_settings(value: unknown, template: unknown): unknown {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return deep_clone(template);
}

export function coerce_deficiency_counter(value: unknown): number {
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (!Number.isFinite(n) || n < 1) {
        return 1;
    }
    return Math.floor(n);
}

export function coerce_nullable_plain_object(value: unknown): unknown {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return null;
}

/**
 * Normaliserar ett state-objekt efter merge med initial_state (t.ex. från storage).
 */
export function sanitize_persisted_app_state_shape(state: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...state };
    out.samples = coerce_to_array(out.samples);
    out.archivedRequirementResults = coerce_to_array(out.archivedRequirementResults);
    out.auditMetadata = coerce_audit_metadata(
        out.auditMetadata,
        initial_state.auditMetadata as unknown as Record<string, unknown>
    );
    out.uiSettings = coerce_ui_settings(out.uiSettings, initial_state.uiSettings);
    out.auditCalculations = coerce_plain_object_or_empty(out.auditCalculations);
    out.ruleFileContent = coerce_rule_file_content(out.ruleFileContent);
    out.auditStatus = coerce_audit_status(out.auditStatus);
    out.deficiencyCounter = coerce_deficiency_counter(out.deficiencyCounter);
    out.manageUsersText = typeof out.manageUsersText === 'string' ? out.manageUsersText : '';
    out.ruleFileIsPublished = !!out.ruleFileIsPublished;
    out.pendingSampleChanges = coerce_nullable_plain_object(out.pendingSampleChanges);
    out.sampleEditDraft = coerce_nullable_plain_object(out.sampleEditDraft);
    return out;
}

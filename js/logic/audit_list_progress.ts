/**
 * @fileoverview Framsteg enligt granskningsöversikten – samma räkning och avrundning överallt.
 */

import type { AuditStateShape } from './audit_logic_types.js';
import { calculate_overall_audit_progress } from './audit_logic_progress.js';

export type AuditProgressSource = {
    ruleFileContent?: unknown;
    samples?: unknown[];
    auditStatus?: string;
};

export type AuditIndexRowLike = {
    id?: string | number;
    progress?: number | null;
};

export type AuditProgressSummary = {
    audited: number;
    total: number;
    /** Procent 0–100, samma formel som översikten (en decimal vid visning). */
    percent: number;
};

function parse_json_field<T>(value: T | string | null | undefined): T | null | undefined {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value !== 'string') {
        return value;
    }
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function normalize_samples(samples: unknown): unknown[] | null {
    const parsed = parse_json_field<unknown[]>(samples as string | unknown[] | null | undefined);
    if (!parsed) {
        return null;
    }
    return Array.isArray(parsed) ? parsed : null;
}

/**
 * Samma beräkning som Granskningsöversikten (calculate_overall_audit_progress + procent utan heltalsavrundning).
 */
export function get_overall_audit_progress_summary(
    source: AuditProgressSource | null | undefined
): AuditProgressSummary | null {
    if (!source?.ruleFileContent) {
        return null;
    }
    const samples = normalize_samples(source.samples);
    if (!samples) {
        return null;
    }
    const shaped: AuditStateShape = {
        ...(source as AuditStateShape),
        samples
    };
    const progress = calculate_overall_audit_progress(shaped);
    if (progress.total <= 0) {
        return null;
    }
    const percent = (100 * progress.audited) / progress.total;
    return {
        audited: progress.audited,
        total: progress.total,
        percent
    };
}

/**
 * Avrundad procent för sortering/jämförelse (en decimal, som översikten visar).
 */
export function progress_percent_sort_value(summary: AuditProgressSummary | null): number {
    if (!summary) {
        return -1;
    }
    return Math.round(summary.percent * 10) / 10;
}

/**
 * Formaterar procent som i översikten (t.ex. "100,0").
 */
export function format_progress_percent_like_overview(
    percent: number,
    lang_code: string,
    format_number_locally?: (
        val: number,
        lang: string,
        opts: { minimumFractionDigits: number; maximumFractionDigits: number }
    ) => string | null | undefined
): string {
    if (typeof format_number_locally === 'function') {
        const formatted = format_number_locally(percent, lang_code, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });
        if (formatted !== null && formatted !== undefined) {
            return String(formatted);
        }
    }
    return percent.toFixed(1).replace('.', ',');
}

/**
 * Beräknar avrundad procent (en decimal) för API-lista – samma logik som översikten.
 */
export function compute_audit_progress_percent(source: AuditProgressSource | null | undefined): number | null {
    const summary = get_overall_audit_progress_summary(source);
    return summary ? progress_percent_sort_value(summary) : null;
}

/**
 * Procent för listrad: alltid översiktens beräkning för öppen granskning i state, annars API-värde.
 */
export function progress_percent_for_audit_row(
    row: AuditIndexRowLike | null | undefined,
    live_state: (AuditProgressSource & { auditId?: string | null }) | null | undefined
): number | null {
    if (
        live_state?.auditId != null &&
        row?.id != null &&
        String(live_state.auditId) === String(row.id)
    ) {
        const summary = get_overall_audit_progress_summary(live_state);
        if (summary) {
            return progress_percent_sort_value(summary);
        }
    }
    if (row?.progress !== null && row?.progress !== undefined) {
        return Number(row.progress);
    }
    return null;
}

/**
 * Visningstext för progress-kolumn (en decimal + %), i linje med översikten.
 */
export function format_audit_row_progress_display(
    row: AuditIndexRowLike | null | undefined,
    live_state: (AuditProgressSource & { auditId?: string | null }) | null | undefined,
    lang_code: string,
    format_number_locally?: (
        val: number,
        lang: string,
        opts: { minimumFractionDigits: number; maximumFractionDigits: number }
    ) => string | null | undefined
): string | null {
    let summary: AuditProgressSummary | null = null;
    if (
        live_state?.auditId != null &&
        row?.id != null &&
        String(live_state.auditId) === String(row.id)
    ) {
        summary = get_overall_audit_progress_summary(live_state);
    }
    if (!summary && row?.progress !== null && row?.progress !== undefined) {
        summary = {
            audited: 0,
            total: 0,
            percent: Number(row.progress)
        };
    }
    if (!summary) {
        return null;
    }
    return `${format_progress_percent_like_overview(summary.percent, lang_code, format_number_locally)} %`;
}

/**
 * Uppdaterar progress på rader som motsvarar öppen granskning i state.
 */
export function enrich_audits_with_live_progress<T extends AuditIndexRowLike>(
    audits: T[] | null | undefined,
    live_state: (AuditProgressSource & { auditId?: string | null }) | null | undefined
): T[] {
    if (!Array.isArray(audits) || !live_state?.auditId) {
        return audits || [];
    }
    return audits.map((row) => {
        if (String(row?.id) !== String(live_state.auditId)) {
            return row;
        }
        const pct = progress_percent_for_audit_row(row, live_state);
        if (pct === null) {
            return row;
        }
        return { ...row, progress: pct };
    });
}

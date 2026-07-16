/**
 * @fileoverview Hjälpfunktioner för Bilaga 1-sammanfattningstext (regelfil + granskning).
 */

export type Appendix1RulefileSlice = {
    appendix1?: {
        summaryText?: unknown;
    };
};

export type Appendix1AuditSlice = {
    ruleFileContent?: Appendix1RulefileSlice | null;
    auditMetadata?: {
        appendix1SummaryText?: unknown;
        [key: string]: unknown;
    };
};

/** Läser standardtext från regelfilens appendix1.summaryText. */
export function read_rulefile_appendix1_summary_text(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): string {
    const raw = rule_file_content?.appendix1?.summaryText;
    return typeof raw === 'string' ? raw : '';
}

/** Läser sparad granskningstext (kan vara tom sträng). */
export function read_audit_appendix1_summary_text(
    audit_metadata: { appendix1SummaryText?: unknown } | null | undefined
): string {
    const raw = audit_metadata?.appendix1SummaryText;
    return typeof raw === 'string' ? raw : '';
}

/**
 * Effektiv text för export/preview: granskning om satt (även tom efter redigering),
 * annars regelfilens default.
 */
export function resolve_appendix1_summary_text(audit: Appendix1AuditSlice | null | undefined): string {
    if (!audit) return '';
    const meta = audit.auditMetadata;
    if (meta && Object.prototype.hasOwnProperty.call(meta, 'appendix1SummaryText')) {
        return read_audit_appendix1_summary_text(meta);
    }
    return read_rulefile_appendix1_summary_text(audit.ruleFileContent ?? undefined);
}

/** Sätter appendix1SummaryText från regelfil om fältet saknas helt i metadata. */
export function with_initialized_appendix1_summary_metadata<T extends Appendix1AuditSlice>(
    state: T
): T {
    const meta = state.auditMetadata ?? {};
    if (Object.prototype.hasOwnProperty.call(meta, 'appendix1SummaryText')) {
        return state;
    }
    const default_text = read_rulefile_appendix1_summary_text(state.ruleFileContent ?? undefined);
    return {
        ...state,
        auditMetadata: {
            ...meta,
            appendix1SummaryText: default_text,
        },
    };
}

/** Normaliserar appendix1 på regelfil (säkerställer objekt och sträng). */
export function normalize_rulefile_appendix1(
    rule_file_content: Record<string, unknown> | null | undefined
): Record<string, unknown> {
    const base = rule_file_content && typeof rule_file_content === 'object'
        ? { ...rule_file_content }
        : {};
    const appendix = base.appendix1;
    const appendix_obj =
        appendix && typeof appendix === 'object' && !Array.isArray(appendix)
            ? { ...(appendix as Record<string, unknown>) }
            : {};
    const summary = appendix_obj.summaryText;
    appendix_obj.summaryText = typeof summary === 'string' ? summary : '';
    base.appendix1 = appendix_obj;
    return base;
}

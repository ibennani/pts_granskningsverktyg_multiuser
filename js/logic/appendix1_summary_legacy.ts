/**
 * @fileoverview Legacy och init-hantering för Bilaga 1 kapitel 1 (sammanfattningstext).
 */
import {
    parse_body_text_to_content_sections,
    read_appendix1_body_text_from_appendix1,
    sanitize_appendix1_body_text,
} from './appendix1_body_text.js';
import {
    get_default_appendix1_body_text,
    get_default_appendix1_sections_list,
} from './appendix1_sections_defaults.js';
import { parse_appendix1_sections_raw } from './appendix1_sections_migrate.js';
import type { Appendix1AuditSlice, Appendix1RulefileSlice } from './appendix1_sections_types.js';
import { DEFAULT_WCAG_TAXONOMY_ID } from '../../shared/classification/taxonomy_grouping.js';

function read_rulefile_body_text_for_summary(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): string {
    const defaults = get_default_appendix1_sections_list();
    const appendix = rule_file_content?.appendix1;
    const from_file =
        appendix && typeof appendix === 'object'
            ? parse_appendix1_sections_raw((appendix as Record<string, unknown>).sections)
            : [];
    const grouping_taxonomy_id =
        typeof appendix === 'object'
        && appendix
        && typeof (appendix as Record<string, unknown>).groupingTaxonomyId === 'string'
        && String((appendix as Record<string, unknown>).groupingTaxonomyId).trim()
            ? String((appendix as Record<string, unknown>).groupingTaxonomyId).trim()
            : DEFAULT_WCAG_TAXONOMY_ID;
    const body_text = read_appendix1_body_text_from_appendix1(
        appendix,
        get_default_appendix1_body_text(),
        from_file.length > 0 ? from_file : defaults,
        grouping_taxonomy_id
    );
    return sanitize_appendix1_body_text(body_text, defaults);
}

export function with_initialized_appendix1_summary_metadata<T extends Appendix1AuditSlice>(
    state: T
): T {
    const meta = state.auditMetadata ?? {};
    const next_meta = { ...meta };
    let changed = false;

    if (!Object.prototype.hasOwnProperty.call(meta, 'appendix1SummaryText')) {
        const legacy = state.ruleFileContent?.appendix1?.summaryText;
        if (typeof legacy === 'string' && legacy.trim()) {
            next_meta.appendix1SummaryText = legacy;
        } else {
            const introduction = parse_body_text_to_content_sections(
                read_rulefile_body_text_for_summary(state.ruleFileContent),
                get_default_appendix1_sections_list()
            ).find((section) => section.id === 'introduction');
            next_meta.appendix1SummaryText = introduction?.content ?? '';
        }
        changed = true;
    }
    if (!Object.prototype.hasOwnProperty.call(meta, 'appendix1SectionOverrides')) {
        next_meta.appendix1SectionOverrides = {};
        changed = true;
    }
    if (!Object.prototype.hasOwnProperty.call(meta, 'appendix1PrincipleIntroOverrides')) {
        next_meta.appendix1PrincipleIntroOverrides = {};
        changed = true;
    }

    if (!changed) return state;
    return {
        ...state,
        auditMetadata: next_meta,
    };
}

/** @deprecated Använd resolve_appendix1_sections_list och introduction-innehåll. */
export function read_rulefile_appendix1_summary_text(
    rule_file_content: Appendix1RulefileSlice | null | undefined
): string {
    const introduction = parse_body_text_to_content_sections(
        read_rulefile_body_text_for_summary(rule_file_content),
        get_default_appendix1_sections_list()
    ).find((section) => section.id === 'introduction');
    if (introduction?.content?.trim()) {
        return introduction.content;
    }
    const raw = rule_file_content?.appendix1?.summaryText;
    return typeof raw === 'string' ? raw : '';
}

/** @deprecated Använd appendix1SectionOverrides. */
export function read_audit_appendix1_summary_text(
    audit_metadata: { appendix1SummaryText?: unknown } | null | undefined
): string {
    const raw = audit_metadata?.appendix1SummaryText;
    return typeof raw === 'string' ? raw : '';
}

/** @deprecated Använd resolve_appendix1_sections_list. */
export function resolve_appendix1_summary_text(audit: Appendix1AuditSlice | null | undefined): string {
    if (!audit) return '';
    const meta = audit.auditMetadata;
    if (meta && Object.prototype.hasOwnProperty.call(meta, 'appendix1SummaryText')) {
        return read_audit_appendix1_summary_text(meta);
    }
    return read_rulefile_appendix1_summary_text(audit.ruleFileContent ?? undefined);
}

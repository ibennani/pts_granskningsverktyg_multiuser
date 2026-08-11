/**
 * @fileoverview Granskningsspecifika överstyrningar av bilagornas malltexter (auditMetadata).
 */
import type { Appendix1SectionDefinition } from './appendix1_sections_types.js';
import type {
    Appendix2LocaleLabels,
    Appendix2RulefileSlice,
    Appendix2SheetKey,
} from './appendix2_excel_template.js';
import {
    APPENDIX2_DEFICIENCY_COLUMN_KEYS,
    APPENDIX2_GENERAL_INFO_KEYS,
    APPENDIX2_SHEET_KEYS,
    read_rulefile_appendix2_labels,
    resolve_appendix2_excel_labels,
} from './appendix2_excel_template.js';
import type { Appendix1AuditSlice } from './appendix1_sections_types.js';

export type Appendix1Override = {
    bodyText?: string;
    bodyTextByTaxonomy?: Record<string, string>;
    sections?: Appendix1SectionDefinition[];
};

export type AuditAppendixMetadata = {
    appendix1Override?: Appendix1Override;
    appendix1PrincipleIntroOverrides?: Record<string, string>;
    appendix2LabelsOverride?: Partial<Appendix2LocaleLabels>;
    appendix3IntroTextOverride?: string;
    appendix1SummaryText?: string;
    appendix1SectionOverrides?: unknown;
};

function is_record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function read_appendix1_override(
    audit_metadata: AuditAppendixMetadata | null | undefined
): Appendix1Override | null {
    const raw = audit_metadata?.appendix1Override;
    if (!is_record(raw)) return null;
    const result: Appendix1Override = {};
    if (typeof raw.bodyText === 'string') result.bodyText = raw.bodyText;
    if (is_record(raw.bodyTextByTaxonomy)) {
        const by_taxonomy: Record<string, string> = {};
        for (const [key, value] of Object.entries(raw.bodyTextByTaxonomy)) {
            if (typeof value === 'string') by_taxonomy[key] = value;
        }
        if (Object.keys(by_taxonomy).length > 0) result.bodyTextByTaxonomy = by_taxonomy;
    }
    if (Array.isArray(raw.sections)) {
        result.sections = raw.sections as Appendix1SectionDefinition[];
    }
    return Object.keys(result).length > 0 ? result : null;
}

export function merge_appendix1_slice_with_audit_override(
    appendix1_slice: Record<string, unknown> | null | undefined,
    override: Appendix1Override | null
): Record<string, unknown> | null | undefined {
    if (!override) return appendix1_slice;
    const base = is_record(appendix1_slice) ? { ...appendix1_slice } : {};
    if (override.bodyText !== undefined) base.bodyText = override.bodyText;
    if (override.bodyTextByTaxonomy) {
        base.bodyTextByTaxonomy = { ...override.bodyTextByTaxonomy };
    }
    if (override.sections) {
        base.sections = override.sections;
    }
    return base;
}

function normalize_partial_labels(
    stored: Partial<Appendix2LocaleLabels> | undefined,
    defaults: Appendix2LocaleLabels
): Appendix2LocaleLabels {
    const sheet_names = { ...defaults.sheetNames };
    if (stored?.sheetNames) {
        for (const key of APPENDIX2_SHEET_KEYS) {
            const value = stored.sheetNames[key];
            if (typeof value === 'string' && value.trim()) sheet_names[key] = value;
        }
    }

    const merge_entries = (
        keys: readonly string[],
        stored_entries: { key: string; label: string }[] | undefined,
        default_entries: { key: string; label: string }[]
    ) => {
        const map = new Map(default_entries.map((e) => [e.key, e.label]));
        if (stored_entries) {
            for (const entry of stored_entries) {
                if (entry?.key && typeof entry.label === 'string') {
                    map.set(entry.key, entry.label);
                }
            }
        }
        return keys.map((key) => ({ key, label: map.get(key) ?? key }));
    };

    return {
        sheetNames: sheet_names,
        generalInfo: merge_entries(
            APPENDIX2_GENERAL_INFO_KEYS,
            stored?.generalInfo,
            defaults.generalInfo
        ),
        deficiencyColumns: merge_entries(
            APPENDIX2_DEFICIENCY_COLUMN_KEYS,
            stored?.deficiencyColumns,
            defaults.deficiencyColumns
        ),
    };
}

export function read_appendix2_labels_override(
    audit_metadata: AuditAppendixMetadata | null | undefined
): Partial<Appendix2LocaleLabels> | null {
    const raw = audit_metadata?.appendix2LabelsOverride;
    if (!is_record(raw)) return null;
    return raw as Partial<Appendix2LocaleLabels>;
}

export function resolve_appendix2_excel_labels_for_audit(
    audit: Appendix1AuditSlice | null | undefined
): ReturnType<typeof resolve_appendix2_excel_labels> {
    const rule_file = audit?.ruleFileContent as Appendix2RulefileSlice | null | undefined;
    const defaults = read_rulefile_appendix2_labels(rule_file);
    const override = read_appendix2_labels_override(
        audit?.auditMetadata as AuditAppendixMetadata | null | undefined
    );
    if (!override) {
        return resolve_appendix2_excel_labels(rule_file);
    }
    const merged = normalize_partial_labels(override, defaults);
    const general_info_labels = {} as Record<string, string>;
    const deficiency_column_labels = {} as Record<string, string>;
    for (const entry of merged.generalInfo) {
        general_info_labels[entry.key] = entry.label;
    }
    for (const entry of merged.deficiencyColumns) {
        deficiency_column_labels[entry.key] = entry.label;
    }
    return {
        sheet_names: { ...merged.sheetNames } as Record<Appendix2SheetKey, string>,
        general_info_labels,
        deficiency_column_labels,
    };
}

export function read_appendix3_intro_override(
    audit_metadata: AuditAppendixMetadata | null | undefined
): string | undefined {
    if (!audit_metadata || !Object.prototype.hasOwnProperty.call(audit_metadata, 'appendix3IntroTextOverride')) {
        return undefined;
    }
    const raw = audit_metadata.appendix3IntroTextOverride;
    return typeof raw === 'string' ? raw : '';
}

export function build_appendix1_override_payload(
    body_text: string,
    body_text_by_taxonomy: Record<string, string>,
    sections: Appendix1SectionDefinition[],
    principle_intro_overrides: Record<string, string>
): Record<string, unknown> {
    return {
        appendix1Override: {
            bodyText: body_text,
            bodyTextByTaxonomy: body_text_by_taxonomy,
            sections,
        },
        appendix1PrincipleIntroOverrides: principle_intro_overrides,
    };
}

export function build_appendix2_override_payload(
    labels: Appendix2LocaleLabels
): Record<string, unknown> {
    return {
        appendix2LabelsOverride: {
            sheetNames: labels.sheetNames,
            generalInfo: labels.generalInfo,
            deficiencyColumns: labels.deficiencyColumns,
        },
    };
}

export function build_appendix3_override_payload(intro_text: string): Record<string, unknown> {
    return { appendix3IntroTextOverride: intro_text };
}

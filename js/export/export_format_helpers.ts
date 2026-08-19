/**
 * @fileoverview Delade text-/Excel-/CSV-hjälpare och bristnummer för export.
 */

import { Paragraph, TextRun } from 'docx';
import { recalculateAuditTimes, get_audit_last_updated_display_timestamp } from '../audit_logic.js';
import {
    resolve_taxonomy_concepts,
} from '../../shared/classification/taxonomy_grouping.js';
import {
    extract_deficiency_number,
} from '../logic/deficiency_id_format.js';
import {
    get_export_concept_ids_for_requirement,
    get_export_grouping_taxonomy_id,
} from './export_taxonomy_mapping.js';

export function create_paragraphs_with_line_breaks(text: unknown, options: Record<string, unknown> = {}): Paragraph[] {
    if (!text) {
        return [
            new Paragraph({
                children: [new TextRun({ text: '', ...(options as object) })]
            })
        ];
    }

    const lines = String(text).split('\n');
    const paragraphs: Paragraph[] = [];

    for (let i = 0; i < lines.length; i++) {
        paragraphs.push(
            new Paragraph({
                children: [new TextRun({ text: lines[i], ...(options as object) })]
            })
        );
    }

    return paragraphs;
}

export function create_text_runs_with_line_breaks(text: unknown, options: Record<string, unknown> = {}): TextRun[] {
    if (!text) {
        return [new TextRun({ text: '', ...(options as object) })];
    }

    return [new TextRun({ text: String(text), ...(options as object) })];
}

export function escape_for_csv(str: unknown): string {
    if (str === null || str === undefined) {
        return '';
    }
    let result = String(str);
    result = result.replace(/"/g, '""');
    if (/[",;\r\n]/.test(result)) {
        result = `"${result}"`;
    }
    return result;
}

/**
 * Tar bort vanlig Markdown-syntax men behåller radbrytningar (för Excel-export).
 */
export function strip_markdown_for_excel(text: unknown): string {
    if (text === null || text === undefined || typeof text !== 'string') {
        return '';
    }
    let s = text.replace(/\r\n/g, '\n');
    s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, '$1');
    s = s.replace(/`([^`]+)`/g, '$1');
    s = s.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
    for (let i = 0; i < 6; i++) {
        s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
        s = s.replace(/\*([^*\n]+)\*/g, '$1');
        s = s.replace(/__([^_]+)__/g, '$1');
    }
    s = s.replace(/(^|\s)_([^_\n]+)_(\s|$)/g, '$1$2$3');
    s = s.replace(/^#{1,6}\s+/gm, '');
    s = s.replace(/^\s*[-*+]\s+/gm, '');
    s = s.replace(/^\s*\d+\.\s+/gm, '');
    s = s.replace(/[`*]{1,2}/g, '');
    return s;
}

export function apply_excel_cell_alignment_top_left_wrap(sheet: {
    eachRow: (opts: { includeEmpty: boolean }, cb: (row: any) => void) => void;
}): void {
    sheet.eachRow({ includeEmpty: true }, (row: any) => {
        row.eachCell({ includeEmpty: true }, (cell: any) => {
            const prev = cell.alignment || {};
            cell.alignment = {
                ...prev,
                vertical: 'top',
                horizontal: 'left',
                wrapText: true
            };
        });
    });
}

export function get_effective_display_times_for_audit(audit: unknown): {
    startTime: unknown;
    endTime: unknown;
} {
    if (!audit) {
        return { startTime: null, endTime: null };
    }
    const merged = recalculateAuditTimes({ ...(audit as object) });
    const a = audit as Record<string, unknown>;
    return {
        startTime: a.startTime || (merged as Record<string, unknown> | null)?.startTime || null,
        endTime: a.endTime || (merged as Record<string, unknown> | null)?.endTime || null
    };
}

/** Slutdatum/-tid för export (samma logik som Bilaga 1 {{endDate}}). */
export function get_audit_ended_iso_for_export(audit: unknown): string | null {
    if (!audit) return null;
    const audit_record = audit as Record<string, unknown>;
    const meta = (audit_record.auditMetadata ?? {}) as Record<string, unknown>;
    const display_times = get_effective_display_times_for_audit(audit);
    const end_candidate =
        display_times.endTime
        ?? audit_record.endTime
        ?? meta.endTime
        ?? null;

    if (typeof end_candidate === 'string' && end_candidate.trim()) {
        return end_candidate.trim();
    }

    const status = audit_record.auditStatus;
    if (status === 'locked' || status === 'archived') {
        const updated_at = audit_record.updated_at;
        if (typeof updated_at === 'string' && updated_at.trim()) {
            return updated_at.trim();
        }
    }
    return null;
}

/** Samma tidsstämpel som granskningsöversikten (AuditInfo), inte bara updated_at. */
export function get_audit_last_updated_iso_for_export(audit: unknown): string | null {
    if (!audit) return null;
    const from_display = get_audit_last_updated_display_timestamp(
        audit as import('../logic/audit_logic_types.js').AuditStateShape
    );
    if (from_display) return from_display;
    const updated_at = (audit as { updated_at?: unknown }).updated_at;
    return typeof updated_at === 'string' && updated_at.trim() ? updated_at : null;
}

export { extract_deficiency_number as extractDeficiencyNumber };

export function formatDeficiencyForWord(deficiencyId: unknown): string {
    if (!deficiencyId) return '';
    const number = extract_deficiency_number(deficiencyId);
    return `Brist\u00A0${number}`;
}

export function norm_taxonomy_string(v: unknown): string {
    return String(v ?? '').trim().toLowerCase();
}

type TExport = (key: string, opts?: Record<string, unknown>) => string;

export type TaxonomyExportColumnDef = { header: string; key: string; width: number };

/** Prefix för dynamiska taxonomikolumner i bristexport (Excel/CSV). */
export const TAXONOMY_EXPORT_COLUMN_KEY_PREFIX = 'taxonomy_';

function taxonomy_export_column_key(concept_id: string): string {
    return `${TAXONOMY_EXPORT_COLUMN_KEY_PREFIX}${concept_id}`;
}

/**
 * Taxonomi för Bilaga 2/Excel. Se export_taxonomy_mapping.ts.
 */
export { get_export_grouping_taxonomy_id } from './export_taxonomy_mapping.js';

/** Kolumndefinitioner för grupperingstaxonomi i CSV/Excel-bristexport. */
export function get_primary_taxonomy_export_columns(
    current_audit: Record<string, unknown> | null | undefined,
    t: TExport
): TaxonomyExportColumnDef[] {
    const rule_content = current_audit?.ruleFileContent as Record<string, unknown> | undefined;
    const taxonomy_id = get_export_grouping_taxonomy_id(current_audit);
    const concepts = resolve_taxonomy_concepts(rule_content?.metadata, taxonomy_id, t);
    return concepts.map((concept) => ({
        header: concept.label,
        key: taxonomy_export_column_key(concept.id),
        width: 14,
    }));
}

/**
 * Ja/nej-värden per begrepp i grupperingstaxonomi för bristexport (Ja skrivs, Nej blir tom cell).
 */
export function get_primary_taxonomy_export_values_for_requirement(
    req_definition: Record<string, unknown> | null | undefined,
    current_audit: Record<string, unknown> | null | undefined,
    t: TExport
): Record<string, string> {
    const rule_content = current_audit?.ruleFileContent as Record<string, unknown> | undefined;
    const taxonomy_id = get_export_grouping_taxonomy_id(current_audit);
    const concepts = resolve_taxonomy_concepts(rule_content?.metadata, taxonomy_id, t);
    const concept_ids = new Set(
        get_export_concept_ids_for_requirement(
            req_definition ?? {},
            rule_content?.metadata,
            taxonomy_id,
            t
        )
    );
    const yes = t('yes');
    const no = t('no');
    const values: Record<string, string> = {};
    for (const concept of concepts) {
        values[taxonomy_export_column_key(concept.id)] = concept_ids.has(
            norm_taxonomy_string(concept.id)
        )
            ? yes
            : no;
    }
    return values;
}

/**
 * @deprecated Använd get_primary_taxonomy_export_values_for_requirement.
 * Behålls för bakåtkompatibilitet i äldre exportmallar.
 */
export function get_wcag_pour_export_values_for_requirement(
    req_definition: Record<string, unknown> | null | undefined,
    current_audit: Record<string, unknown> | null | undefined,
    t: TExport
): {
    wcagPerceivable: string;
    wcagOperable: string;
    wcagUnderstandable: string;
    wcagRobust: string;
} {
    const dynamic_values = get_primary_taxonomy_export_values_for_requirement(
        req_definition,
        current_audit,
        t
    );
    const empty = {
        wcagPerceivable: '',
        wcagOperable: '',
        wcagUnderstandable: '',
        wcagRobust: '',
    };
    const legacy_key_map: Record<string, keyof typeof empty> = {
        perceivable: 'wcagPerceivable',
        operable: 'wcagOperable',
        understandable: 'wcagUnderstandable',
        robust: 'wcagRobust',
    };
    const result = { ...empty };
    for (const [concept_id, legacy_key] of Object.entries(legacy_key_map)) {
        const dynamic_key = taxonomy_export_column_key(concept_id);
        if (dynamic_key in dynamic_values) {
            result[legacy_key] = dynamic_values[dynamic_key];
        }
    }
    return result;
}

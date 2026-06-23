/**
 * @fileoverview Gemensam rad- och kolumndata för Excel- och CSV-export av brister.
 */

import * as Helpers from '../utils/helpers.js';
import {
    extractDeficiencyNumber,
    get_wcag_pour_export_values_for_requirement,
    strip_markdown_for_excel
} from './export_format_helpers.js';
import { get_export_requirement_result } from './export_bootstrap.js';
import { for_each_failed_in_requirement_result } from './export_deficiency_traversal.js';
import { find_check_def_by_storage_id, find_pass_criterion_def_by_storage_id } from '../logic/entity_id_match.js';
import { to_wcag_yes_only_value } from './excel_export_helpers.js';
import {
    format_media_filenames_for_export,
    type ExportMediaFilenameContext
} from './export_media_naming.js';

export type DeficiencyColumnDef = { header: string; key: string; width: number };

export type DeficiencyRow = {
    id: string;
    reqTitle: string;
    reference: { text: string; hyperlink?: string };
    sampleName: string;
    sampleUrl: { text: string; hyperlink?: string } | null;
    deficiencyType: string;
    observation: string;
    screenshotReference: string;
    comment?: string;
    wcagPerceivable: string;
    wcagOperable: string;
    wcagUnderstandable: string;
    wcagRobust: string;
};

export type PreparedDeficiencyExport = {
    deficiencies_data: DeficiencyRow[];
    column_defs: DeficiencyColumnDef[];
    include_comment_column: boolean;
};

export function build_deficiency_column_defs(
    t: (key: string) => string,
    include_comment_column: boolean
): DeficiencyColumnDef[] {
    const wcag_column_defs = [
        { header: t('excel_col_wcag_perceivable'), key: 'wcagPerceivable', width: 14 },
        { header: t('excel_col_wcag_operable'), key: 'wcagOperable', width: 14 },
        { header: t('excel_col_wcag_understandable'), key: 'wcagUnderstandable', width: 14 },
        { header: t('excel_col_wcag_robust'), key: 'wcagRobust', width: 12 }
    ];
    const column_defs_before_comment = [
        { header: t('excel_col_deficiency_id'), key: 'id', width: 12 },
        { header: t('excel_col_req_title'), key: 'reqTitle', width: 45 },
        { header: t('excel_col_reference'), key: 'reference', width: 40 },
        { header: t('excel_col_sample_name'), key: 'sampleName', width: 30 },
        { header: t('excel_col_sample_url'), key: 'sampleUrl', width: 40 },
        { header: t('excel_col_deficiency_type'), key: 'deficiencyType', width: 48 },
        { header: t('excel_col_observation'), key: 'observation', width: 70 },
        { header: t('excel_col_screenshot_reference'), key: 'screenshotReference', width: 50 }
    ];
    return [
        ...column_defs_before_comment,
        ...(include_comment_column ? [{ header: t('excel_col_comment'), key: 'comment', width: 70 }] : []),
        ...wcag_column_defs
    ];
}

export function deficiency_row_to_flat_values(row: DeficiencyRow, column_keys: string[]): string[] {
    return column_keys.map((key) => {
        if (key === 'reference') {
            return row.reference?.text ?? '';
        }
        if (key === 'sampleUrl') {
            return row.sampleUrl?.text ?? '';
        }
        const value = row[key as keyof DeficiencyRow];
        return value == null ? '' : String(value);
    });
}

export async function prepare_deficiencies_for_export(
    current_audit: unknown,
    t: (key: string) => string,
    media_context?: ExportMediaFilenameContext | null
): Promise<PreparedDeficiencyExport> {
    const deficiencies_data = build_deficiencies_data(current_audit, t, media_context ?? null);
    const include_comment_column = deficiencies_data.some(
        (d) => d.comment && String(d.comment).trim().length > 0
    );
    const column_defs = build_deficiency_column_defs(t, include_comment_column);
    if (!include_comment_column) {
        deficiencies_data.forEach((row) => {
            delete row.comment;
        });
    }
    return { deficiencies_data, column_defs, include_comment_column };
}

/**
 * Läser PrimaryText från passCriteria.DeficiencyType på ett sparat godkännandekriterium.
 */
function get_deficiency_type_primary_text(pc_obj: unknown): string {
    const node = (pc_obj as { DeficiencyType?: { PrimaryText?: unknown } })?.DeficiencyType;
    const text = node?.PrimaryText;
    return typeof text === 'string' ? text.trim() : '';
}

function build_single_deficiency_row(
    current_audit: unknown,
    sample: { description?: string; url?: string },
    req_definition: {
        title?: string;
        standardReference?: { text?: string; url?: string };
        checks?: unknown[];
    },
    result: { commentToAuditor?: string },
    check_id: string,
    pc_id: string,
    pc_obj: {
        deficiencyId?: string;
        observationDetail?: string;
        attachedMediaFilenames?: unknown;
        DeficiencyType?: { PrimaryText?: unknown };
    },
    t: (key: string) => string,
    yes_label: string,
    media_context: ExportMediaFilenameContext | null
): DeficiencyRow {
    const check_def = find_check_def_by_storage_id(
        (req_definition.checks ?? []) as Array<{
            id?: unknown;
            key?: unknown;
            passCriteria?: Array<{ id?: unknown; key?: unknown }>;
        }>,
        check_id
    );
    const pc_def = find_pass_criterion_def_by_storage_id(check_def?.passCriteria, pc_id) as {
        failureStatementTemplate?: string;
        requirement?: string;
    } | undefined;
    const template_observation = pc_def?.failureStatementTemplate || '';
    const user_observation = pc_obj.observationDetail || '';
    const pass_criterion_text = pc_def?.requirement || '';

    let final_observation = user_observation;
    if (!user_observation.trim() || user_observation.trim() === template_observation.trim()) {
        final_observation = pass_criterion_text;
    }
    final_observation = strip_markdown_for_excel(final_observation);

    const ref_text_raw = req_definition.standardReference?.text || '';
    const reference_obj: { text: string; hyperlink?: string } = {
        text: strip_markdown_for_excel(ref_text_raw)
    };
    if (req_definition.standardReference?.url) {
        reference_obj.hyperlink = Helpers.add_protocol_if_missing(req_definition.standardReference.url);
    }

    const url_obj = sample.url
        ? {
              text: strip_markdown_for_excel(String(sample.url)),
              hyperlink: Helpers.add_protocol_if_missing(sample.url)
          }
        : null;

    const pour_vals = get_wcag_pour_export_values_for_requirement(req_definition, current_audit as never, t);
    const comment_text = strip_markdown_for_excel((result.commentToAuditor || '').trim());

    return {
        id: extractDeficiencyNumber(pc_obj.deficiencyId),
        reqTitle: strip_markdown_for_excel(String(req_definition.title || '')),
        reference: reference_obj,
        sampleName: strip_markdown_for_excel(String(sample.description || '')),
        sampleUrl: url_obj,
        deficiencyType: strip_markdown_for_excel(get_deficiency_type_primary_text(pc_obj)),
        observation: final_observation,
        screenshotReference: format_media_filenames_for_export(
            pc_obj.attachedMediaFilenames,
            media_context,
            { deficiency_id: pc_obj.deficiencyId }
        ),
        comment: comment_text,
        wcagPerceivable: to_wcag_yes_only_value(pour_vals.wcagPerceivable, yes_label),
        wcagOperable: to_wcag_yes_only_value(pour_vals.wcagOperable, yes_label),
        wcagUnderstandable: to_wcag_yes_only_value(pour_vals.wcagUnderstandable, yes_label),
        wcagRobust: to_wcag_yes_only_value(pour_vals.wcagRobust, yes_label)
    };
}

export function build_deficiencies_data(
    current_audit: unknown,
    t: (key: string) => string,
    media_context: ExportMediaFilenameContext | null = null
): DeficiencyRow[] {
    const deficiencies_data: DeficiencyRow[] = [];
    const yes_label = t('yes');
    const audit = current_audit as { ruleFileContent?: { requirements?: Record<string, unknown> }; samples?: unknown[] };
    const requirements_for_export = audit.ruleFileContent?.requirements || {};

    (audit.samples || []).forEach((sample) => {
        const sample_row = sample as { description?: string; url?: string };
        const all_reqs = Object.values(requirements_for_export);
        all_reqs.forEach((req_definition) => {
            const req = req_definition as Parameters<typeof build_single_deficiency_row>[2];
            const result = get_export_requirement_result(requirements_for_export, sample, req_definition);
            if (!result) return;
            for_each_failed_in_requirement_result(result, ({ check_id, pc_id, pc_obj }) => {
                deficiencies_data.push(
                    build_single_deficiency_row(
                        current_audit,
                        sample_row,
                        req,
                        result,
                        check_id,
                        pc_id,
                        pc_obj,
                        t,
                        yes_label,
                        media_context
                    )
                );
            });
        });
    });

    deficiencies_data.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
    return deficiencies_data;
}

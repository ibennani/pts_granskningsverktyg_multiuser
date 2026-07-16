/**
 * @fileoverview Gemensam rad- och kolumndata för Excel- och CSV-export av brister.
 */

import * as Helpers from '../utils/helpers.js';
import {
    extractDeficiencyNumber,
    get_primary_taxonomy_export_columns,
    get_primary_taxonomy_export_values_for_requirement,
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
import {
    get_appendix2_deficiency_column_width,
    resolve_appendix2_excel_labels,
    type Appendix2DeficiencyColumnKey,
    type Appendix2RulefileSlice,
} from '../logic/appendix2_excel_template.js';

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
    [key: string]: string | { text: string; hyperlink?: string } | null | undefined;
};

export type PreparedDeficiencyExport = {
    deficiencies_data: DeficiencyRow[];
    column_defs: DeficiencyColumnDef[];
    include_comment_column: boolean;
};

export function build_deficiency_column_defs(
    t: (key: string) => string,
    include_comment_column: boolean,
    current_audit?: Record<string, unknown> | null
): DeficiencyColumnDef[] {
    const rule_file_content = (current_audit?.ruleFileContent ?? null) as Appendix2RulefileSlice | null | undefined;
    const { deficiency_column_labels } = resolve_appendix2_excel_labels(rule_file_content ?? null);
    const header_for = (key: Appendix2DeficiencyColumnKey, i18n_key: string): string => {
        const override = deficiency_column_labels[key];
        if (override && override.trim()) return override;
        return t(i18n_key);
    };

    const column_defs_before_comment = [
        { header: header_for('id', 'excel_col_deficiency_id'), key: 'id', width: get_appendix2_deficiency_column_width('id') },
        { header: header_for('reqTitle', 'excel_col_req_title'), key: 'reqTitle', width: get_appendix2_deficiency_column_width('reqTitle') },
        { header: header_for('reference', 'excel_col_reference'), key: 'reference', width: get_appendix2_deficiency_column_width('reference') },
        { header: header_for('sampleName', 'excel_col_sample_name'), key: 'sampleName', width: get_appendix2_deficiency_column_width('sampleName') },
        { header: header_for('sampleUrl', 'excel_col_sample_url'), key: 'sampleUrl', width: get_appendix2_deficiency_column_width('sampleUrl') },
        { header: header_for('deficiencyType', 'excel_col_deficiency_type'), key: 'deficiencyType', width: get_appendix2_deficiency_column_width('deficiencyType') },
        { header: header_for('observation', 'excel_col_observation'), key: 'observation', width: get_appendix2_deficiency_column_width('observation') },
        { header: header_for('screenshotReference', 'excel_col_screenshot_reference'), key: 'screenshotReference', width: get_appendix2_deficiency_column_width('screenshotReference') }
    ];

    const taxonomy_column_defs = get_primary_taxonomy_export_columns(current_audit ?? null, t).map((col) => {
        const concept_id = col.key.replace(/^taxonomy_/, '');
        const wcag_key = WCAG_CONCEPT_TO_APPENDIX2_KEY[concept_id];
        if (!wcag_key) return col;
        const override = deficiency_column_labels[wcag_key];
        if (!override?.trim()) return col;
        return { ...col, header: override };
    });

    return [
        ...column_defs_before_comment,
        ...(include_comment_column ? [{ header: header_for('comment', 'excel_col_comment'), key: 'comment', width: get_appendix2_deficiency_column_width('comment') }] : []),
        ...taxonomy_column_defs
    ];
}

const WCAG_CONCEPT_TO_APPENDIX2_KEY: Record<string, Appendix2DeficiencyColumnKey> = {
    perceivable: 'wcagPerceivable',
    operable: 'wcagOperable',
    understandable: 'wcagUnderstandable',
    robust: 'wcagRobust',
};

export function deficiency_row_to_flat_values(row: DeficiencyRow, column_keys: string[]): string[] {
    return column_keys.map((key) => {
        if (key === 'reference') {
            return row.reference?.text ?? '';
        }
        if (key === 'sampleUrl') {
            return row.sampleUrl?.text ?? '';
        }
        const value = row[key];
        return value == null ? '' : String(value);
    });
}

export async function prepare_deficiencies_for_export(
    current_audit: unknown,
    t: (key: string) => string,
    media_context?: ExportMediaFilenameContext | null
): Promise<PreparedDeficiencyExport> {
    const audit_record = current_audit as Record<string, unknown>;
    const deficiencies_data = build_deficiencies_data(current_audit, t, media_context ?? null);
    const include_comment_column = deficiencies_data.some(
        (d) => d.comment && String(d.comment).trim().length > 0
    );
    const column_defs = build_deficiency_column_defs(t, include_comment_column, audit_record);
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

    const taxonomy_vals = get_primary_taxonomy_export_values_for_requirement(
        req_definition,
        current_audit as never,
        t
    );
    const comment_text = strip_markdown_for_excel((result.commentToAuditor || '').trim());

    const row: DeficiencyRow = {
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
    };

    for (const [column_key, cell_value] of Object.entries(taxonomy_vals)) {
        row[column_key] = to_wcag_yes_only_value(cell_value, yes_label);
    }

    return row;
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

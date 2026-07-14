/**
 * @fileoverview Word-export av alla observationstexter för handläggning före bilagor.
 */
import {
    BorderStyle,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
} from 'docx';
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';
import { collect_observation_export_deficiencies } from './export_observation_texts_collect.js';
import type { ObservationExportEntry } from './export_observation_texts_collect.js';
import { finalize_export_catch } from './export_error_handling.js';
import { build_observation_texts_word_filename } from './export_report_filename.js';
import { finalize_word_export_download } from './export_word_main_flow_document.js';
import { parse_markdown_to_text_runs } from './export_word_markdown_docx.js';
import type { ExportWordMainFlowT } from './export_word_main_flow_children.js';

const OBSERVATION_BORDER_COLOR = 'CC0000';

const red_cell_border = {
    top: { style: BorderStyle.SINGLE, size: 6, color: OBSERVATION_BORDER_COLOR },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: OBSERVATION_BORDER_COLOR },
    left: { style: BorderStyle.SINGLE, size: 6, color: OBSERVATION_BORDER_COLOR },
    right: { style: BorderStyle.SINGLE, size: 6, color: OBSERVATION_BORDER_COLOR },
};

function build_observation_cell_paragraphs(observation_text: string): Paragraph[] {
    const trimmed = String(observation_text || '').trim();
    if (!trimmed) {
        return [new Paragraph({ children: [new TextRun({ text: '' })] })];
    }

    const lines = trimmed.split('\n');
    return lines.map((line, index) => {
        const is_last = index === lines.length - 1;
        return new Paragraph({
            children: parse_markdown_to_text_runs(line),
            spacing: { after: is_last ? 0 : 60 },
        });
    });
}

function append_observation_entry_blocks(
    children: unknown[],
    entry: ObservationExportEntry,
    t: ExportWordMainFlowT
): void {
    const c = children as Array<Paragraph | Table>;
    const id_number = extractDeficiencyNumber(entry.deficiencyId);
    const id_label = t('pass_criterion_deficiency_id_label', { id: id_number });

    c.push(
        new Paragraph({
            children: [new TextRun({ text: id_label, bold: true })],
            spacing: { after: 40 },
        })
    );

    c.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            borders: red_cell_border,
                            margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            children: build_observation_cell_paragraphs(entry.observationDetail),
                        }),
                    ],
                }),
            ],
        })
    );

    c.push(
        new Paragraph({
            children: [new TextRun({ text: '' })],
            spacing: { after: 240 },
        })
    );
}

export function build_observation_texts_word_children(
    deficiencies: ObservationExportEntry[],
    t: ExportWordMainFlowT
): unknown[] {
    const children: unknown[] = [];
    for (const entry of deficiencies) {
        append_observation_entry_blocks(children, entry, t);
    }
    return children;
}

export async function export_observation_texts_word(
    current_audit: Record<string, unknown> | null | undefined
): Promise<void> {
    const t = get_t_internal() as ExportWordMainFlowT;
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    consoleManager.log('[Word Export] Starting export_observation_texts_word');

    try {
        const deficiencies = collect_observation_export_deficiencies(current_audit);
        if (deficiencies.length === 0) {
            show_global_message_internal(t('error_no_deficiencies_for_observation_export'), 'error');
            return;
        }

        const children = build_observation_texts_word_children(deficiencies, t);
        await finalize_word_export_download({
            children,
            current_audit,
            isSortByRequirements: true,
            t,
            filename: build_observation_texts_word_filename(current_audit, t),
        });
    } catch (error: unknown) {
        finalize_export_catch(error, (err) => {
            if (window.ConsoleManager?.warn) {
                window.ConsoleManager.warn('Error exporting observation texts Word:', err);
            }
            const msg = err instanceof Error ? err.message : String(err);
            show_global_message_internal(`${t('error_exporting_word')} ${msg}`.trim(), 'error');
        });
    }
}

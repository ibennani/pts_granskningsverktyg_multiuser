/**
 * @fileoverview Word-export av alla observationstexter för handläggning före bilagor.
 */
import { Paragraph, TextRun, TabStopType } from 'docx';
import { resolve_rulefile_language_for_export } from '../logic/audit_granskning_sequence.js';
import { t_for_language } from '../translation_logic.js';
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import { collect_observation_export_deficiencies } from './export_observation_texts_collect.js';
import type { ObservationExportEntry } from './export_observation_texts_collect.js';
import {
    append_observation_entry_context_blocks,
    append_observation_entry_red_frame_block,
} from './export_observation_texts_word_blocks.js';
import { finalize_export_catch } from './export_error_handling.js';
import { build_observation_texts_word_filename } from './export_report_filename.js';
import { finalize_word_export_download } from './export_word_main_flow_document.js';
import {
    build_observation_word_audit_marker_from_audit,
    embed_observation_word_audit_marker_in_docx,
} from '../../shared/export/observation_word_audit_marker.js';
import type { ExportWordMainFlowT } from './export_word_main_flow_children.js';

function apply_translation_replacements(
    text: string,
    replacements: Record<string, unknown> = {}
): string {
    return text.replace(/{([^{}]+)}/g, (match, placeholder_key: string) =>
        replacements[placeholder_key] !== undefined
            ? String(replacements[placeholder_key])
            : match
    );
}

export function create_observation_texts_export_t(rule_file_content: unknown): ExportWordMainFlowT {
    const language_tag = resolve_rulefile_language_for_export(rule_file_content);
    return (key, opts = {}) =>
        apply_translation_replacements(t_for_language(key, language_tag), opts);
}

function resolve_observation_export_metadata(
    current_audit: Record<string, unknown>,
    t: ExportWordMainFlowT
): { dnr: string; actor_name: string } {
    const metadata = current_audit.auditMetadata as {
        caseNumber?: string;
        actorName?: string;
    } | undefined;
    const dnr = String(metadata?.caseNumber ?? '').trim();
    const actor_name = String(metadata?.actorName ?? '').trim() || t('filename_fallback_actor');
    return { dnr, actor_name };
}

function append_bullet_paragraph(children: Paragraph[], text: string): void {
    children.push(
        new Paragraph({
            children: [new TextRun({ text: '•\t' }), new TextRun({ text })],
            indent: { left: 227, hanging: 227 },
            tabStops: [{ position: 227, type: TabStopType.LEFT }],
        })
    );
}

/**
 * Bygger intro-paragraf med fetstil för {dnr} och {actor_name} (med citationstecken) i mallen.
 */
export function build_bold_placeholder_intro_runs(
    intro_template: string,
    bold_values: Record<string, string>
): TextRun[] {
    const placeholder_pattern = /(\{[^{}]+\})/;
    const runs: TextRun[] = [];

    for (const part of intro_template.split(placeholder_pattern)) {
        if (!part) continue;

        const placeholder_match = part.match(/^\{([^{}]+)\}$/);
        if (placeholder_match) {
            const key = placeholder_match[1];
            const value = bold_values[key];
            if (value !== undefined) {
                runs.push(new TextRun({ text: value, bold: true }));
            } else {
                runs.push(new TextRun({ text: part }));
            }
            continue;
        }

        runs.push(new TextRun({ text: part }));
    }

    return runs;
}

function append_observation_texts_word_intro(
    children: unknown[],
    t: ExportWordMainFlowT,
    current_audit: Record<string, unknown>
): void {
    const c = children as Array<Paragraph>;
    const { dnr, actor_name } = resolve_observation_export_metadata(current_audit, t);
    const language_tag = resolve_rulefile_language_for_export(current_audit.ruleFileContent);
    const intro_template = t_for_language('export_observation_texts_word_intro', language_tag);

    c.push(
        new Paragraph({
            children: [new TextRun({ text: t('export_observation_texts_word_title') })],
            heading: 'Heading1',
        }),
        new Paragraph({
            children: build_bold_placeholder_intro_runs(intro_template, {
                dnr,
                actor_name: `"${actor_name}"`,
            }),
            spacing: { after: 120 },
        })
    );
    append_bullet_paragraph(c, t('export_observation_texts_word_bullet_edit'));
    append_bullet_paragraph(c, t('export_observation_texts_word_bullet_delete'));
    c.push(
        new Paragraph({
            children: [new TextRun({ text: t('export_observation_texts_word_return') })],
            spacing: { after: 240 },
        })
    );
}

function append_observation_entry_blocks(
    children: unknown[],
    entry: ObservationExportEntry,
    current_audit: Record<string, unknown>,
    t: ExportWordMainFlowT
): void {
    append_observation_entry_context_blocks(children, entry, current_audit, t);
    append_observation_entry_red_frame_block(children, entry, t);
}

export function build_observation_texts_word_children(
    deficiencies: ObservationExportEntry[],
    current_audit: Record<string, unknown>
): unknown[] {
    const rule_file_content = current_audit.ruleFileContent;
    const t = create_observation_texts_export_t(rule_file_content);
    const children: unknown[] = [];
    append_observation_texts_word_intro(children, t, current_audit);
    for (const entry of deficiencies) {
        append_observation_entry_blocks(children, entry, current_audit, t);
    }
    return children;
}

export async function export_observation_texts_word(
    current_audit: Record<string, unknown> | null | undefined
): Promise<void> {
    const ui_t = get_t_internal() as ExportWordMainFlowT;
    if (!current_audit) {
        show_global_message_internal(ui_t('no_audit_data_to_save'), 'error');
        return;
    }

    consoleManager.log('[Word Export] Starting export_observation_texts_word');

    try {
        const deficiencies = collect_observation_export_deficiencies(current_audit);
        if (deficiencies.length === 0) {
            show_global_message_internal(ui_t('error_no_deficiencies_for_observation_export'), 'error');
            return;
        }

        const rule_file_content = current_audit.ruleFileContent;
        const export_t = create_observation_texts_export_t(rule_file_content);
        const children = build_observation_texts_word_children(deficiencies, current_audit);
        await finalize_word_export_download({
            children,
            current_audit,
            isSortByRequirements: true,
            t: export_t,
            filename: build_observation_texts_word_filename(current_audit, export_t),
            transform_blob: async (buffer) =>
                embed_observation_word_audit_marker_in_docx(
                    buffer,
                    build_observation_word_audit_marker_from_audit(
                        current_audit as Record<string, unknown>
                    )
                ),
        });
    } catch (error: unknown) {
        finalize_export_catch(error, (err) => {
            if (window.ConsoleManager?.warn) {
                window.ConsoleManager.warn('Error exporting observation texts Word:', err);
            }
            const msg = err instanceof Error ? err.message : String(err);
            show_global_message_internal(`${ui_t('error_exporting_word')} ${msg}`.trim(), 'error');
        });
    }
}

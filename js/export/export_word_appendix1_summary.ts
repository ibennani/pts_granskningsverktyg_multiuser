/**
 * @fileoverview Word-export av Bilaga 1 Sammanfattning (text + bristtyper).
 */
import { Paragraph, TextRun, TabStopType } from 'docx';
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import { collect_deficiency_types_grouped_by_principle } from './export_deficiency_types_collect.js';
import { finalize_word_export_download } from './export_word_main_flow_document.js';
import { finalize_export_catch } from './export_error_handling.js';
import { build_appendix1_summary_word_filename } from './export_report_filename.js';
import { render_markdown_to_html } from './export_html_build_primitives.js';
import { html_to_word_paragraphs } from './export_html_to_word_paragraphs.js';
import { resolve_appendix1_summary_text } from '../logic/appendix1_summary_text.js';
import type { ExportWordMainFlowT } from './export_word_main_flow_children.js';

function append_deficiency_type_bullet_paragraph(
    children: Array<InstanceType<typeof Paragraph>>,
    primary: string,
    secondary: string
): void {
    const runs = [new TextRun({ text: '•\t' }), new TextRun({ text: primary, bold: true })];
    if (secondary) {
        runs.push(new TextRun({ text: ` ${secondary}` }));
    }
    children.push(
        new Paragraph({
            children: runs,
            indent: { left: 227, hanging: 227 },
            tabStops: [{ position: 227, type: TabStopType.LEFT }],
        })
    );
}

export function append_word_appendix1_summary_paragraphs(
    children: unknown[],
    current_audit: Record<string, unknown>,
    t: ExportWordMainFlowT
): void {
    const c = children as Array<InstanceType<typeof Paragraph>>;

    c.push(
        new Paragraph({
            children: [new TextRun({ text: t('export_appendix1_summary_title') })],
            heading: 'Heading1',
        })
    );

    const summary_text = resolve_appendix1_summary_text(current_audit).trim();
    if (summary_text) {
        const summary_html = render_markdown_to_html(summary_text);
        const summary_paragraphs = html_to_word_paragraphs(summary_html, { include_h1: false });
        c.push(...summary_paragraphs);
    }

    const groups = collect_deficiency_types_grouped_by_principle(current_audit, t);
    c.push(
        new Paragraph({
            children: [new TextRun({ text: t('export_appendix1_summary_deficiency_types_heading') })],
            heading: 'Heading2',
        })
    );

    if (groups.length === 0) {
        c.push(
            new Paragraph({
                children: [new TextRun({ text: t('export_appendix1_summary_deficiency_types_empty') })],
            })
        );
        return;
    }

    for (const group of groups) {
        c.push(
            new Paragraph({
                children: [new TextRun({ text: group.label })],
                heading: 'Heading3',
            })
        );
        for (const entry of group.types) {
            append_deficiency_type_bullet_paragraph(c, entry.primary, entry.secondary);
        }
    }
}

export async function export_to_word_appendix1_summary(
    current_audit: Record<string, unknown> | null | undefined
): Promise<void> {
    const t = get_t_internal() as ExportWordMainFlowT;
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    consoleManager.log('[Word Export] Starting export_to_word_appendix1_summary');

    try {
        const children: unknown[] = [];
        append_word_appendix1_summary_paragraphs(children, current_audit, t);
        await finalize_word_export_download({
            children,
            current_audit,
            isSortByRequirements: true,
            t,
            filename: build_appendix1_summary_word_filename(current_audit, t),
        });
    } catch (error: unknown) {
        finalize_export_catch(error, (err) => {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn('Error exporting appendix1 summary Word:', err);
            const msg = err instanceof Error ? err.message : String(err);
            show_global_message_internal(`${t('error_exporting_word')} ${msg}`.trim(), 'error');
        });
    }
}

/** @deprecated Använd export_to_word_appendix1_summary */
export async function export_to_word_deficiency_types(
    current_audit: Record<string, unknown> | null | undefined
): Promise<void> {
    return export_to_word_appendix1_summary(current_audit);
}

/** @deprecated Använd append_word_appendix1_summary_paragraphs */
export function append_word_deficiency_types_appendix_paragraphs(
    children: unknown[],
    current_audit: Record<string, unknown>,
    t: ExportWordMainFlowT
): void {
    append_word_appendix1_summary_paragraphs(children, current_audit, t);
}

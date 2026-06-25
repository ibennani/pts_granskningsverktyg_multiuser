/**
 * @fileoverview Word-export av bilaga med bristtyper per WCAG-princip.
 */
import { Paragraph, TextRun, TabStopType } from 'docx';
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import { collect_deficiency_types_grouped_by_principle } from './export_deficiency_types_collect.js';
import { finalize_word_export_download } from './export_word_main_flow_document.js';
import { finalize_export_catch } from './export_error_handling.js';
import { build_deficiency_types_appendix_word_filename } from './export_report_filename.js';
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

export function append_word_deficiency_types_appendix_paragraphs(
    children: unknown[],
    current_audit: Record<string, unknown>,
    t: ExportWordMainFlowT
): void {
    const c = children as Array<InstanceType<typeof Paragraph>>;
    c.push(
        new Paragraph({
            children: [new TextRun({ text: t('export_pdf_deficiency_types_title') })],
            heading: 'Heading1',
        }),
        new Paragraph({
            children: [new TextRun({ text: t('export_pdf_deficiency_types_intro') })],
        })
    );

    const groups = collect_deficiency_types_grouped_by_principle(current_audit, t);
    if (groups.length === 0) {
        c.push(
            new Paragraph({
                children: [new TextRun({ text: t('export_pdf_deficiency_types_empty') })],
            })
        );
        return;
    }

    for (const group of groups) {
        c.push(
            new Paragraph({
                children: [new TextRun({ text: group.label })],
                heading: 'Heading2',
            })
        );
        for (const entry of group.types) {
            append_deficiency_type_bullet_paragraph(c, entry.primary, entry.secondary);
        }
    }
}

export async function export_to_word_deficiency_types(
    current_audit: Record<string, unknown> | null | undefined
): Promise<void> {
    const t = get_t_internal() as ExportWordMainFlowT;
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    consoleManager.log('[Word Export] Starting export_to_word_deficiency_types');

    try {
        const children: unknown[] = [];
        append_word_deficiency_types_appendix_paragraphs(children, current_audit, t);
        await finalize_word_export_download({
            children,
            current_audit,
            isSortByRequirements: true,
            t,
            filename: build_deficiency_types_appendix_word_filename(current_audit, t),
        });
    } catch (error: unknown) {
        finalize_export_catch(error, (err) => {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn('Error exporting deficiency types Word:', err);
            const msg = err instanceof Error ? err.message : String(err);
            show_global_message_internal(`${t('error_exporting_word')} ${msg}`.trim(), 'error');
        });
    }
}

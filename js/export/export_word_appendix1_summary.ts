/**
 * @fileoverview Word-export av Bilaga 1 Sammanfattning (PTS-struktur).
 */
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import { finalize_word_export_download } from './export_word_main_flow_document.js';
import { finalize_export_catch } from './export_error_handling.js';
import { build_appendix1_summary_word_filename } from './export_report_filename.js';
import { append_word_appendix1_pts_paragraphs } from './export_word_appendix1_pts.js';
import type { ExportWordMainFlowT } from './export_word_main_flow_children.js';

export function append_word_appendix1_summary_paragraphs(
    children: unknown[],
    current_audit: Record<string, unknown>,
    t: ExportWordMainFlowT
): void {
    append_word_appendix1_pts_paragraphs(children, current_audit, t);
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
        append_word_appendix1_pts_paragraphs(children, current_audit, t);
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

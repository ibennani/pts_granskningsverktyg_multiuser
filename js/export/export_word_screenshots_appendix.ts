/**
 * @fileoverview Word-export av bilaga 3 med alla skärmbilder (H1 + H2/bild-block).
 */
import { ImageRun, Paragraph, TextRun } from 'docx';
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import { build_screenshots_appendix_word_filename } from './export_report_filename.js';
import { finalize_word_export_download } from './export_word_main_flow_document.js';
import { finalize_export_catch } from './export_error_handling.js';
import {
    prepare_screenshots_appendix_media,
    type PreparedScreenshotsAppendixItem,
} from './export_screenshots_appendix_media.js';
import { resolve_appendix3_screenshots_template } from '../logic/appendix3_screenshots_template.js';
import { render_markdown_to_html } from './export_html_build_primitives.js';
import { html_to_word_paragraphs } from './export_html_to_word_paragraphs.js';
import type { ExportWordMainFlowT } from './export_word_main_flow_children.js';

function append_screenshot_image_block(
    children: Array<InstanceType<typeof Paragraph>>,
    item: PreparedScreenshotsAppendixItem
): void {
    children.push(
        new Paragraph({
            children: [new TextRun({ text: item.export_filename })],
            heading: 'Heading2',
            keepNext: true,
            widowControl: true,
        })
    );
    children.push(
        new Paragraph({
            children: [
                new ImageRun({
                    type: item.docx_image_type,
                    data: new Uint8Array(item.bytes),
                    transformation: {
                        width: item.display_width_px,
                        height: item.display_height_px,
                    },
                }),
            ],
            keepLines: true,
            widowControl: true,
        })
    );
}

export function append_word_screenshots_appendix_paragraphs(
    children: unknown[],
    items: PreparedScreenshotsAppendixItem[],
    t: ExportWordMainFlowT,
    current_audit?: Record<string, unknown> | null
): void {
    const c = children as Array<InstanceType<typeof Paragraph>>;
    const resolved = resolve_appendix3_screenshots_template(current_audit as never);
    const title_text = resolved.title.trim() || t('export_screenshots_appendix_title');
    c.push(
        new Paragraph({
            children: [new TextRun({ text: title_text })],
            heading: 'Heading1',
        })
    );

    if (resolved.introText.trim()) {
        c.push(
            ...html_to_word_paragraphs(render_markdown_to_html(resolved.introText), {
                include_h1: false,
            })
        );
    }

    if (items.length === 0) {
        c.push(
            new Paragraph({
                children: [new TextRun({ text: t('export_screenshots_appendix_empty') })],
            })
        );
        return;
    }

    items.forEach((item) => {
        append_screenshot_image_block(c, item);
    });
}

export async function export_to_word_screenshots_appendix(
    current_audit: Record<string, unknown> | null | undefined
): Promise<void> {
    const t = get_t_internal() as ExportWordMainFlowT;
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    consoleManager.log('[Word Export] Starting export_to_word_screenshots_appendix');

    try {
        const { items, missing_filenames } = await prepare_screenshots_appendix_media(
            current_audit as Record<string, unknown> & { auditId?: string | null }
        );
        if (items.length === 0) {
            show_global_message_internal(t('export_screenshots_appendix_empty'), 'error');
            return;
        }

        const children: unknown[] = [];
        append_word_screenshots_appendix_paragraphs(children, items, t, current_audit);
        await finalize_word_export_download({
            children,
            current_audit,
            isSortByRequirements: true,
            t,
            filename: build_screenshots_appendix_word_filename(current_audit, t),
        });

        if (missing_filenames.length > 0) {
            show_global_message_internal(
                t('screenshots_appendix_missing_media_warning', {
                    count: String(missing_filenames.length),
                }),
                'success'
            );
        }
    } catch (error: unknown) {
        finalize_export_catch(error, (err) => {
            if (window.ConsoleManager?.warn) {
                window.ConsoleManager.warn('Error exporting screenshots appendix Word:', err);
            }
            const msg = err instanceof Error ? err.message : String(err);
            show_global_message_internal(`${t('error_exporting_screenshots_appendix')} ${msg}`.trim(), 'error');
        });
    }
}

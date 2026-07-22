/**
 * @fileoverview Omkodar serverlagrade PNG-bilder till PDF-exportdimensioner (JPEG) för mindre HTML-payload.
 * JPEG här är ett exportderivat, inte originaluppladdningen.
 */

import {
    array_buffer_to_base64_data_uri,
    type PreparedScreenshotsAppendixItem,
    type PreparedScreenshotsAppendixPdfItem,
} from './export_screenshots_appendix_media.js';
import {
    assert_pdf_export_html_within_limit,
    is_export_pdf_html_too_large_error,
    type ExportPdfHtmlTooLargeMessageKey,
} from './export_pdf_html_size_error.js';
import {
    build_screenshots_appendix_pdf_document,
    build_screenshots_appendix_pdf_document_chunks,
    type ExportScreenshotsAppendixHtmlT,
} from './export_report_html_screenshots_appendix.js';

export type { PreparedScreenshotsAppendixPdfItem };

/** JPEG-kvalitet i fallande ordning om HTML fortfarande överskrider maxgränsen. */
export const PDF_SCREENSHOT_JPEG_QUALITY_STEPS = [0.88, 0.78, 0.68, 0.58, 0.5, 0.4] as const;

const LARGE_ORIGINAL_BYTES = 300_000;

async function blob_to_jpeg_data_uri(
    blob: Blob,
    width_px: number,
    height_px: number,
    jpeg_quality: number
): Promise<string> {
    const bitmap = await createImageBitmap(blob);
    try {
        const canvas = document.createElement('canvas');
        canvas.width = width_px;
        canvas.height = height_px;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Kan inte skapa 2D-kontext för PDF-bildomkodning');
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width_px, height_px);
        ctx.drawImage(bitmap, 0, 0, width_px, height_px);

        const jpeg_blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (result) => {
                    if (result) resolve(result);
                    else reject(new Error('toBlob returnerade null vid JPEG-omkodning'));
                },
                'image/jpeg',
                jpeg_quality
            );
        });
        const jpeg_bytes = await jpeg_blob.arrayBuffer();
        return array_buffer_to_base64_data_uri(jpeg_bytes, 'image/jpeg');
    } finally {
        bitmap.close();
    }
}

function build_encode_dimensions(item: PreparedScreenshotsAppendixItem): Array<{ width_px: number; height_px: number }> {
    const primary = { width_px: item.display_width_px, height_px: item.display_height_px };
    if (item.bytes.byteLength <= LARGE_ORIGINAL_BYTES) {
        return [primary];
    }
    return [
        primary,
        {
            width_px: Math.max(1, Math.round(item.display_width_px * 0.65)),
            height_px: Math.max(1, Math.round(item.display_height_px * 0.65)),
        },
    ];
}

export async function encode_screenshot_item_for_pdf_html(
    item: PreparedScreenshotsAppendixItem,
    jpeg_quality: number
): Promise<PreparedScreenshotsAppendixPdfItem> {
    const source_blob = new Blob([item.bytes], { type: item.mime_type });
    for (const dims of build_encode_dimensions(item)) {
        try {
            const pdf_data_uri = await blob_to_jpeg_data_uri(
                source_blob,
                dims.width_px,
                dims.height_px,
                jpeg_quality
            );
            return {
                ...item,
                display_width_px: dims.width_px,
                display_height_px: dims.height_px,
                pdf_data_uri,
            };
        } catch {
            /* prova nästa dimension */
        }
    }
    return {
        ...item,
        pdf_data_uri: array_buffer_to_base64_data_uri(item.bytes, item.mime_type),
    };
}

export async function prepare_screenshots_appendix_items_for_pdf_html(
    items: PreparedScreenshotsAppendixItem[],
    jpeg_quality: number
): Promise<PreparedScreenshotsAppendixPdfItem[]> {
    const prepared: PreparedScreenshotsAppendixPdfItem[] = [];
    for (const item of items) {
        prepared.push(await encode_screenshot_item_for_pdf_html(item, jpeg_quality));
    }
    return prepared;
}

function assert_all_chunks_within_limit(
    html_chunks: string[],
    message_key: ExportPdfHtmlTooLargeMessageKey
): void {
    for (const html_chunk of html_chunks) {
        assert_pdf_export_html_within_limit(html_chunk, message_key);
    }
}

export async function build_screenshots_appendix_pdf_html_chunks_within_limit(
    current_audit: Record<string, unknown>,
    items: PreparedScreenshotsAppendixItem[],
    t: ExportScreenshotsAppendixHtmlT,
    message_key: ExportPdfHtmlTooLargeMessageKey = 'export_screenshots_appendix_too_large'
): Promise<string[]> {
    let last_too_large: unknown = null;

    for (const jpeg_quality of PDF_SCREENSHOT_JPEG_QUALITY_STEPS) {
        const pdf_items = await prepare_screenshots_appendix_items_for_pdf_html(items, jpeg_quality);
        const single_html = build_screenshots_appendix_pdf_document(current_audit, pdf_items, t);
        try {
            assert_pdf_export_html_within_limit(single_html, message_key);
            return [single_html];
        } catch (error: unknown) {
            if (!is_export_pdf_html_too_large_error(error)) {
                throw error;
            }
            last_too_large = error;
        }

        const html_chunks = build_screenshots_appendix_pdf_document_chunks(current_audit, pdf_items, t);
        try {
            assert_all_chunks_within_limit(html_chunks, message_key);
            return html_chunks;
        } catch (error: unknown) {
            if (is_export_pdf_html_too_large_error(error)) {
                last_too_large = error;
                continue;
            }
            throw error;
        }
    }

    throw last_too_large;
}

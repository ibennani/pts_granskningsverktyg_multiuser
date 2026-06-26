/**
 * @fileoverview Omkodar skärmbilder till PDF-exportdimensioner (JPEG) för mindre HTML-payload.
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
    type ExportScreenshotsAppendixHtmlT,
} from './export_report_html_screenshots_appendix.js';

export type { PreparedScreenshotsAppendixPdfItem };

/** JPEG-kvalitet i fallande ordning om HTML fortfarande överskrider maxgränsen. */
export const PDF_SCREENSHOT_JPEG_QUALITY_STEPS = [0.88, 0.78, 0.68, 0.58, 0.5] as const;

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

export async function encode_screenshot_item_for_pdf_html(
    item: PreparedScreenshotsAppendixItem,
    jpeg_quality: number
): Promise<PreparedScreenshotsAppendixPdfItem> {
    try {
        const source_blob = new Blob([item.bytes], { type: item.mime_type });
        const pdf_data_uri = await blob_to_jpeg_data_uri(
            source_blob,
            item.display_width_px,
            item.display_height_px,
            jpeg_quality
        );
        return { ...item, pdf_data_uri };
    } catch {
        return {
            ...item,
            pdf_data_uri: array_buffer_to_base64_data_uri(item.bytes, item.mime_type),
        };
    }
}

export async function prepare_screenshots_appendix_items_for_pdf_html(
    items: PreparedScreenshotsAppendixItem[],
    jpeg_quality: number
): Promise<PreparedScreenshotsAppendixPdfItem[]> {
    return Promise.all(items.map((item) => encode_screenshot_item_for_pdf_html(item, jpeg_quality)));
}

export async function build_screenshots_appendix_pdf_html_within_limit(
    current_audit: Record<string, unknown>,
    items: PreparedScreenshotsAppendixItem[],
    t: ExportScreenshotsAppendixHtmlT,
    message_key: ExportPdfHtmlTooLargeMessageKey = 'export_screenshots_appendix_too_large'
): Promise<string> {
    let last_too_large: unknown = null;

    for (const jpeg_quality of PDF_SCREENSHOT_JPEG_QUALITY_STEPS) {
        const pdf_items = await prepare_screenshots_appendix_items_for_pdf_html(items, jpeg_quality);
        const html_content = build_screenshots_appendix_pdf_document(current_audit, pdf_items, t);
        try {
            assert_pdf_export_html_within_limit(html_content, message_key);
            return html_content;
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

/**
 * @fileoverview Förbereder bilaga 3-bilder för PDF-HTML: original först, JPEG endast vid behov.
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

export type ScreenshotPdfEncodeProfile =
    | { kind: 'original' }
    | { kind: 'jpeg'; quality: number; scale: number };

/** Original först; JPEG med fallande kvalitet/skala endast om PDF/HTML blir för stor. */
export const SCREENSHOTS_APPENDIX_PDF_ENCODE_PROFILES: readonly ScreenshotPdfEncodeProfile[] = [
    { kind: 'original' },
    { kind: 'jpeg', quality: 0.98, scale: 1 },
    { kind: 'jpeg', quality: 0.95, scale: 1 },
    { kind: 'jpeg', quality: 0.92, scale: 0.92 },
    { kind: 'jpeg', quality: 0.85, scale: 0.85 },
    { kind: 'jpeg', quality: 0.75, scale: 0.75 },
    { kind: 'jpeg', quality: 0.65, scale: 0.65 },
    { kind: 'jpeg', quality: 0.55, scale: 0.55 },
] as const;

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

function build_jpeg_encode_dimensions(
    item: PreparedScreenshotsAppendixItem,
    scale: number
): { width_px: number; height_px: number } {
    return {
        width_px: Math.max(1, Math.round(item.native_width_px * scale)),
        height_px: Math.max(1, Math.round(item.native_height_px * scale)),
    };
}

export function encode_screenshot_item_as_original(
    item: PreparedScreenshotsAppendixItem
): PreparedScreenshotsAppendixPdfItem {
    return {
        ...item,
        pdf_data_uri: array_buffer_to_base64_data_uri(item.bytes, item.mime_type),
    };
}

export async function encode_screenshot_item_as_jpeg(
    item: PreparedScreenshotsAppendixItem,
    jpeg_quality: number,
    scale: number
): Promise<PreparedScreenshotsAppendixPdfItem> {
    const source_blob = new Blob([item.bytes], { type: item.mime_type });
    const dims = build_jpeg_encode_dimensions(item, scale);
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
        return encode_screenshot_item_as_original(item);
    }
}

export async function prepare_screenshots_appendix_items_for_pdf_profile(
    items: PreparedScreenshotsAppendixItem[],
    profile: ScreenshotPdfEncodeProfile
): Promise<PreparedScreenshotsAppendixPdfItem[]> {
    if (profile.kind === 'original') {
        return items.map(encode_screenshot_item_as_original);
    }

    const prepared: PreparedScreenshotsAppendixPdfItem[] = [];
    for (const item of items) {
        prepared.push(await encode_screenshot_item_as_jpeg(item, profile.quality, profile.scale));
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

export function build_screenshots_appendix_pdf_html_chunks_for_items(
    current_audit: Record<string, unknown>,
    pdf_items: PreparedScreenshotsAppendixPdfItem[],
    t: ExportScreenshotsAppendixHtmlT,
    message_key: ExportPdfHtmlTooLargeMessageKey = 'export_screenshots_appendix_too_large'
): string[] {
    const single_html = build_screenshots_appendix_pdf_document(current_audit, pdf_items, t);
    try {
        assert_pdf_export_html_within_limit(single_html, message_key);
        return [single_html];
    } catch (error: unknown) {
        if (!is_export_pdf_html_too_large_error(error)) {
            throw error;
        }
    }

    const html_chunks = build_screenshots_appendix_pdf_document_chunks(current_audit, pdf_items, t);
    assert_all_chunks_within_limit(html_chunks, message_key);
    return html_chunks;
}

/** @deprecated Använd prepare_screenshots_appendix_items_for_pdf_profile + build_screenshots_appendix_pdf_html_chunks_for_items */
export async function build_screenshots_appendix_pdf_html_chunks_within_limit(
    current_audit: Record<string, unknown>,
    items: PreparedScreenshotsAppendixItem[],
    t: ExportScreenshotsAppendixHtmlT,
    message_key: ExportPdfHtmlTooLargeMessageKey = 'export_screenshots_appendix_too_large'
): Promise<string[]> {
    const pdf_items = await prepare_screenshots_appendix_items_for_pdf_profile(items, {
        kind: 'original',
    });
    return build_screenshots_appendix_pdf_html_chunks_for_items(
        current_audit,
        pdf_items,
        t,
        message_key
    );
}

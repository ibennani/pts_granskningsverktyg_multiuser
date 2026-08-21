/**
 * @fileoverview Enhetstester för bilaga 3 PDF-bildkodning (original först).
 */
import { describe, test, expect } from '@jest/globals';
import {
    encode_screenshot_item_as_original,
    SCREENSHOTS_APPENDIX_PDF_ENCODE_PROFILES,
} from '../../js/export/export_screenshots_appendix_pdf_encode.ts';
import { SCREENSHOTS_APPENDIX_PDF_MAX_BYTES } from '../../shared/constants/pdf_export_limits.js';

describe('export_screenshots_appendix_pdf_encode', () => {
    test('första profilen är original utan JPEG-omkodning', () => {
        expect(SCREENSHOTS_APPENDIX_PDF_ENCODE_PROFILES[0]).toEqual({ kind: 'original' });
    });

    test('encode_screenshot_item_as_original behåller PNG-data', () => {
        const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
        const item = {
            export_filename: 'media/test.png',
            original_filename: 'test.png',
            bytes,
            mime_type: 'image/png',
            docx_image_type: 'png' as const,
            native_width_px: 800,
            native_height_px: 600,
            display_width_px: 800,
            display_height_px: 600,
            max_height_cm: 24.5,
            scaled_for_page_fit: false,
        };
        const encoded = encode_screenshot_item_as_original(item);
        expect(encoded.pdf_data_uri.startsWith('data:image/png;base64,')).toBe(true);
    });

    test('bilaga 3 max PDF är 20 Mbyte', () => {
        expect(SCREENSHOTS_APPENDIX_PDF_MAX_BYTES).toBe(20 * 1024 * 1024);
    });
});

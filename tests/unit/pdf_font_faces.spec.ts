/**
 * @fileoverview Enhetstester för Aeonik @font-face-injektion i PDF-HTML.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { PDF_AEONIK_FONT_FACE_PLACEHOLDER } from '../../shared/pdf/pdf_aeonik_font_faces.ts';
import {
    clear_pdf_font_face_cache_for_tests,
    inject_pdf_font_faces,
} from '../../server/services/pdf_font_faces.ts';

describe('pdf_font_faces', () => {
    beforeEach(() => {
        clear_pdf_font_face_cache_for_tests();
    });

    test('inject_pdf_font_faces ersätter platshållare med @font-face', () => {
        const html = `<style>${PDF_AEONIK_FONT_FACE_PLACEHOLDER}body{}</style>`;
        const result = inject_pdf_font_faces(html);

        expect(result).not.toContain(PDF_AEONIK_FONT_FACE_PLACEHOLDER);
        expect(result).toContain('@font-face');
        expect(result).toContain("font-family: 'Aeonik'");
        expect(result).toContain('font-weight: 400');
        expect(result).toContain('font-weight: 700');
        expect(result).toContain('data:font/woff2;base64,');
    });

    test('inject_pdf_font_faces är no-op utan platshållare', () => {
        const html = '<html><body><h1>Test</h1></body></html>';
        expect(inject_pdf_font_faces(html)).toBe(html);
    });

    test('inject_pdf_font_faces cachar @font-face CSS', () => {
        const html = `<style>${PDF_AEONIK_FONT_FACE_PLACEHOLDER}</style>`;
        const first = inject_pdf_font_faces(html);
        const second = inject_pdf_font_faces(html);
        expect(first).toBe(second);
    });
});

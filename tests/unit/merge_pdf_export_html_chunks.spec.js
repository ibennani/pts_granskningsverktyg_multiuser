/**
 * @fileoverview Enhetstester för sammanslagning av PDF-export-HTML.
 */
import { describe, test, expect } from '@jest/globals';
import {
    extract_pdf_export_html_main_inner,
    merge_pdf_export_html_chunks,
} from '../../shared/pdf/merge_pdf_export_html_chunks.js';

const wrap = (body) =>
    `<!DOCTYPE html><html lang="sv"><head><title>T</title></head><body><main>${body}</main></body></html>`;

const wrap_body = (body) =>
    `<!DOCTYPE html><html lang="sv"><head><title>T</title></head><body>${body}</body></html>`;

describe('merge_pdf_export_html_chunks', () => {
    test('extract_pdf_export_html_main_inner plockar ut main-innehåll', () => {
        expect(extract_pdf_export_html_main_inner(wrap('<h1>Rubrik</h1>'))).toBe('<h1>Rubrik</h1>');
    });

    test('merge_pdf_export_html_chunks slår ihop flera delar till ett main', () => {
        const merged = merge_pdf_export_html_chunks([
            wrap('<h1>Bilaga 3</h1>'),
            wrap('<h2>a.png</h2>'),
            wrap('<h2>b.png</h2>'),
        ]);
        expect(merged).toContain('<h1>Bilaga 3</h1>');
        expect(merged).toContain('<h2>a.png</h2>');
        expect(merged).toContain('<h2>b.png</h2>');
        expect(merged.match(/<main[^>]*>/gi)?.length).toBe(1);
    });

    test('merge_pdf_export_html_chunks slår ihop body utan main', () => {
        const merged = merge_pdf_export_html_chunks([
            wrap_body('<h1>Rubrik</h1>'),
            wrap_body('<h2>a.png</h2><img alt="a.png" src="x">'),
        ]);
        expect(merged).toContain('<body><h1>Rubrik</h1>');
        expect(merged).toContain('<h2>a.png</h2>');
        expect(merged).not.toContain('<main');
    });

    test('merge_pdf_export_html_chunks returnerar en del oförändrad', () => {
        const single = wrap('<p>En</p>');
        expect(merge_pdf_export_html_chunks([single])).toBe(single);
    });
});

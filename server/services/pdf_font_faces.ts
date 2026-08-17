/**
 * @fileoverview Injicerar @font-face för Aeonik i PDF-HTML via inbäddade WOFF2-data-URI:er.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    PDF_AEONIK_FONT_FACE_PLACEHOLDER,
    PDF_AEONIK_FONT_FAMILY,
    PDF_AEONIK_FONT_FILES,
} from '../../shared/pdf/pdf_aeonik_font_faces.js';

let cached_font_face_css: string | null = null;

function resolve_fonts_dir(): string {
    const module_dir = dirname(fileURLToPath(import.meta.url));
    return join(module_dir, '../../shared/report_assets/fonts');
}

function read_font_file(filename: string): Buffer {
    const font_path = join(resolve_fonts_dir(), filename);
    try {
        return readFileSync(font_path);
    } catch {
        throw new Error(
            `PDF-typsnitt saknas: ${font_path}. Lägg licensierade WOFF2-filer i shared/report_assets/fonts/.`
        );
    }
}

function build_font_face_css(): string {
    if (cached_font_face_css) return cached_font_face_css;

    const regular = read_font_file(PDF_AEONIK_FONT_FILES.regular);
    const bold = read_font_file(PDF_AEONIK_FONT_FILES.bold);

    cached_font_face_css = `
@font-face {
    font-family: '${PDF_AEONIK_FONT_FAMILY}';
    src: url(data:font/woff2;base64,${regular.toString('base64')}) format('woff2');
    font-weight: 400;
    font-style: normal;
}
@font-face {
    font-family: '${PDF_AEONIK_FONT_FAMILY}';
    src: url(data:font/woff2;base64,${bold.toString('base64')}) format('woff2');
    font-weight: 700;
    font-style: normal;
}`.trim();

    return cached_font_face_css;
}

export function inject_pdf_font_faces(html_content: string): string {
    if (!html_content.includes(PDF_AEONIK_FONT_FACE_PLACEHOLDER)) return html_content;
    const font_face_css = build_font_face_css();
    return html_content.split(PDF_AEONIK_FONT_FACE_PLACEHOLDER).join(font_face_css);
}

/** Nollställ cache (endast för tester). */
export function clear_pdf_font_face_cache_for_tests(): void {
    cached_font_face_css = null;
}

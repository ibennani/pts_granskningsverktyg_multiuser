/**
 * @fileoverview Maxstorlek för HTML som skickas till server-PDF-export.
 */

export {
    FILE_MAX_BYTES as PDF_EXPORT_HTML_MAX_BYTES,
    SCREENSHOTS_APPENDIX_PDF_MAX_BYTES,
    format_file_max_size_label as format_pdf_export_html_max_size_label,
} from './file_size_limits.js';

/**
 * Visningsetikett för faktisk storlek i exportfel (t.ex. "27 MByte").
 */
export function format_pdf_export_actual_size_label(byte_size) {
    const mib = byte_size / (1024 * 1024);
    const rounded = Math.round(mib * 10) / 10;
    const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
    return `${display} MByte`;
}

/**
 * Visningsetikett för maxgräns i exportfel (t.ex. "20 Mbyte").
 */
export function format_pdf_export_max_size_label(max_bytes) {
    const mib = max_bytes / (1024 * 1024);
    return `${Math.round(mib)} Mbyte`;
}

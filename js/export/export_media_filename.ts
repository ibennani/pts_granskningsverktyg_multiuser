/**
 * @fileoverview Bygger standardiserade exportfilnamn för medier kopplade till brister.
 */

import { sanitize_media_filename } from '../../shared/media/sanitize_media_filename.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';

export type RequirementMediaExportFilenameInput = {
    deficiency_id?: string | null;
    image_index: number;
    audit_type_label: 'WEBB' | 'PDF';
    granskning_sequence: number;
    capture_date: string;
    case_number: string;
    original_filename: string;
};

/** Sanerar diarienummer för filnamn (behåller bindestreck). */
export function sanitize_case_number_for_export_filename(case_number: unknown): string {
    return String(case_number ?? '')
        .trim()
        .replace(/[<>:"/\\|?*]/g, '_');
}

/** Hämtar filändelse utan punkt, lowercase. */
export function get_media_export_file_extension(original_filename: string): string {
    const sanitized = sanitize_media_filename(original_filename);
    if (!sanitized) return 'png';
    const dot = sanitized.lastIndexOf('.');
    if (dot <= 0 || dot === sanitized.length - 1) return 'png';
    return sanitized.slice(dot + 1).toLowerCase();
}

/**
 * Format: {bristId}_{bildnr}_{WEBB|PDF}_{granskningsnr}_{YYYY-MM-DD}_{diarienummer}.{ext}
 */
export function build_requirement_media_export_filename(input: RequirementMediaExportFilenameInput): string {
    const deficiency_part = extractDeficiencyNumber(input.deficiency_id) || '000';
    const image_index = Math.max(1, Math.floor(input.image_index));
    const sequence = Math.min(9, Math.max(1, Math.floor(input.granskning_sequence)));
    const capture_date = String(input.capture_date || '').trim() || '0000-00-00';
    const case_part = sanitize_case_number_for_export_filename(input.case_number);
    const ext = get_media_export_file_extension(input.original_filename);
    return `${deficiency_part}_${image_index}_${input.audit_type_label}_${sequence}_${capture_date}_${case_part}.${ext}`;
}

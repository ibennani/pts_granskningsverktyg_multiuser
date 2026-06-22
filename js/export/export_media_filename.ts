/**
 * @fileoverview Bygger standardiserade exportfilnamn för medier kopplade till brister och stickprov.
 */

import { sanitize_media_filename } from '../../shared/media/sanitize_media_filename.js';
import { format_zero_id_part_for_sample } from './export_deficiency_traversal.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';

export type MediaExportFilenameCoreInput = {
    id_part: string;
    index_part: number;
    audit_type_label: string;
    granskning_sequence: number;
    capture_date: string;
    case_number: string;
    original_filename: string;
};

export type RequirementMediaExportFilenameInput = {
    deficiency_id?: string | null;
    image_index: number;
    audit_type_label: string;
    granskning_sequence: number;
    capture_date: string;
    case_number: string;
    original_filename: string;
};

export type SampleMediaExportFilenameInput = {
    sample_sequence: number;
    deficiency_id_part_width: number;
    audit_type_label: string;
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
 * Format: {id}_{index}_{WEBB|PDF}_{granskningsnr}_{YYYY-MM-DD}_{diarienummer}.{ext}
 */
export function build_media_export_filename(input: MediaExportFilenameCoreInput): string {
    const id_part = String(input.id_part || '000').trim() || '000';
    const index_part = Math.max(1, Math.floor(input.index_part));
    const sequence = Math.min(9, Math.max(1, Math.floor(input.granskning_sequence)));
    const capture_date = String(input.capture_date || '').trim() || '0000-00-00';
    const case_part = sanitize_case_number_for_export_filename(input.case_number);
    const ext = get_media_export_file_extension(input.original_filename);
    return `${id_part}_${index_part}_${input.audit_type_label}_${sequence}_${capture_date}_${case_part}.${ext}`;
}

/**
 * Format: {bristId}_{bildnr}_{WEBB|PDF}_{granskningsnr}_{YYYY-MM-DD}_{diarienummer}.{ext}
 */
export function build_requirement_media_export_filename(input: RequirementMediaExportFilenameInput): string {
    return build_media_export_filename({
        id_part: extractDeficiencyNumber(input.deficiency_id) || '000',
        index_part: input.image_index,
        audit_type_label: input.audit_type_label,
        granskning_sequence: input.granskning_sequence,
        capture_date: input.capture_date,
        case_number: input.case_number,
        original_filename: input.original_filename
    });
}

/**
 * Format: {000…}_{stickprovsnr}_{WEBB|PDF}_{granskningsnr}_{YYYY-MM-DD}_{diarienummer}.{ext}
 */
export function build_sample_media_export_filename(input: SampleMediaExportFilenameInput): string {
    return build_media_export_filename({
        id_part: format_zero_id_part_for_sample(input.deficiency_id_part_width),
        index_part: input.sample_sequence,
        audit_type_label: input.audit_type_label,
        granskning_sequence: input.granskning_sequence,
        capture_date: input.capture_date,
        case_number: input.case_number,
        original_filename: input.original_filename
    });
}

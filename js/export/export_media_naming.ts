/**
 * @fileoverview Gemensamt API för exportfilnamn på medier — används av Excel, CSV och framtida exporttyper.
 */

import {
    build_requirement_media_export_filename,
    build_sample_media_export_filename
} from './export_media_filename.js';
import type { ExportMediaFilenameContext } from './export_media_filename_context.js';
import { resolve_sample_sequence_number } from '../logic/audit_granskning_sequence.js';

export type { ExportMediaFilenameContext } from './export_media_filename_context.js';
export type {
    RequirementMediaExportFilenameInput,
    SampleMediaExportFilenameInput
} from './export_media_filename.js';

export { build_export_media_filename_context } from './export_media_filename_context.js';
export {
    build_media_export_filename,
    build_requirement_media_export_filename,
    build_sample_media_export_filename,
    get_media_export_file_extension,
    sanitize_case_number_for_export_filename
} from './export_media_filename.js';
export {
    format_zero_id_part_for_sample,
    resolve_deficiency_id_part_width
} from './export_deficiency_traversal.js';
export { resolve_sample_sequence_number } from '../logic/audit_granskning_sequence.js';

export type MediaExportFilenameRowMeta = {
    deficiency_id?: string | null;
};

export type MediaExportFilenameSampleRowMeta = {
    sample_id?: string | null;
    sample_sequence?: number;
};

function normalize_original_filenames(filenames: unknown): string[] {
    if (!Array.isArray(filenames)) {
        return [];
    }
    return filenames
        .map((name) => String(name || '').trim())
        .filter(Boolean);
}

function resolve_export_fallback_capture_date(
    trimmed_filenames: string[],
    context: ExportMediaFilenameContext
): string {
    return trimmed_filenames.map((name) => context.capture_dates.get(name)).find(Boolean) || '0000-00-00';
}

function resolve_sample_sequence_from_meta(
    meta: MediaExportFilenameSampleRowMeta,
    samples: unknown[] | null | undefined
): number {
    if (meta.sample_sequence != null && Number.isFinite(meta.sample_sequence)) {
        return Math.max(1, Math.floor(meta.sample_sequence));
    }
    return resolve_sample_sequence_number(
        (samples || []) as Array<{ id?: string }>,
        meta.sample_id
    );
}

/**
 * Råa filnamn utan PTS-format, ett per rad (cellformat).
 */
export function format_raw_media_filenames(filenames: unknown): string {
    return normalize_original_filenames(filenames).join('\n');
}

/**
 * Ett originalfilnamn → exportfilnamn enligt PTS-regler (brist).
 */
export function resolve_media_export_filename(
    original_filename: string,
    context: ExportMediaFilenameContext,
    row_meta: MediaExportFilenameRowMeta & { image_index: number }
): string {
    const trimmed = String(original_filename || '').trim();
    const fallback_date = resolve_export_fallback_capture_date([trimmed], context);

    return build_requirement_media_export_filename({
        deficiency_id: row_meta.deficiency_id,
        image_index: row_meta.image_index,
        audit_type_label: context.audit_type_label,
        granskning_sequence: context.granskning_sequence,
        capture_date: context.capture_dates.get(trimmed) || fallback_date,
        case_number: context.case_number,
        original_filename: trimmed
    });
}

/**
 * Ett originalfilnamn → exportfilnamn enligt PTS-regler (granskningsdel).
 */
export function resolve_sample_media_export_filename(
    original_filename: string,
    context: ExportMediaFilenameContext,
    row_meta: MediaExportFilenameSampleRowMeta,
    samples: unknown[] | null | undefined = null
): string {
    const trimmed = String(original_filename || '').trim();
    const fallback_date = resolve_export_fallback_capture_date([trimmed], context);
    const sample_sequence = resolve_sample_sequence_from_meta(row_meta, samples);

    return build_sample_media_export_filename({
        sample_sequence,
        deficiency_id_part_width: context.deficiency_id_part_width,
        audit_type_label: context.audit_type_label,
        granskning_sequence: context.granskning_sequence,
        capture_date: context.capture_dates.get(trimmed) || fallback_date,
        case_number: context.case_number,
        original_filename: trimmed
    });
}

/**
 * Lista originalfilnamn → lista exportfilnamn enligt PTS-regler (brist).
 */
export function resolve_media_export_filenames(
    filenames: unknown,
    context: ExportMediaFilenameContext,
    row_meta: MediaExportFilenameRowMeta
): string[] {
    const trimmed = normalize_original_filenames(filenames);
    if (trimmed.length === 0) {
        return [];
    }

    const fallback_date = resolve_export_fallback_capture_date(trimmed, context);

    return trimmed.map((original_filename, index) =>
        build_requirement_media_export_filename({
            deficiency_id: row_meta.deficiency_id,
            image_index: index + 1,
            audit_type_label: context.audit_type_label,
            granskning_sequence: context.granskning_sequence,
            capture_date: context.capture_dates.get(original_filename) || fallback_date,
            case_number: context.case_number,
            original_filename
        })
    );
}

/**
 * Lista originalfilnamn → lista exportfilnamn enligt PTS-regler (granskningsdel, högst en bild).
 */
export function resolve_sample_media_export_filenames(
    filenames: unknown,
    context: ExportMediaFilenameContext,
    row_meta: MediaExportFilenameSampleRowMeta,
    samples: unknown[] | null | undefined = null
): string[] {
    const trimmed = normalize_original_filenames(filenames);
    if (trimmed.length === 0) {
        return [];
    }

    const first_filename = trimmed[0];
    return [
        resolve_sample_media_export_filename(first_filename, context, row_meta, samples)
    ];
}

/**
 * Formatering för celler (Excel/CSV): ett exportfilnamn per rad (brist).
 */
export function format_media_export_filenames_for_cell(
    filenames: unknown,
    context: ExportMediaFilenameContext,
    row_meta: MediaExportFilenameRowMeta
): string {
    return resolve_media_export_filenames(filenames, context, row_meta).join('\n');
}

/**
 * Formatering för celler: granskningsdelsfilnamn (högst en bild).
 */
export function format_sample_media_filenames_for_export(
    filenames: unknown,
    context: ExportMediaFilenameContext,
    row_meta: MediaExportFilenameSampleRowMeta,
    samples: unknown[] | null | undefined = null
): string {
    return resolve_sample_media_export_filenames(filenames, context, row_meta, samples).join('\n');
}

/**
 * Väljer PTS-exportfilnamn när kontext finns, annars råa filnamn (brist).
 */
export function format_media_filenames_for_export(
    filenames: unknown,
    context: ExportMediaFilenameContext | null,
    row_meta: MediaExportFilenameRowMeta
): string {
    if (context) {
        return format_media_export_filenames_for_cell(filenames, context, row_meta);
    }
    return format_raw_media_filenames(filenames);
}

/**
 * Väljer PTS-exportfilnamn när kontext finns, annars råa filnamn (granskningsdel).
 */
export function format_sample_media_filenames_for_export_or_raw(
    filenames: unknown,
    context: ExportMediaFilenameContext | null,
    row_meta: MediaExportFilenameSampleRowMeta,
    samples: unknown[] | null | undefined = null
): string {
    if (context) {
        return format_sample_media_filenames_for_export(filenames, context, row_meta, samples);
    }
    return format_raw_media_filenames(filenames);
}

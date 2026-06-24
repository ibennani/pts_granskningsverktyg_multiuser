/**
 * @fileoverview Gemensam filnamnslogik för Word- och PDF-rapporter.
 */
import {
    get_download_filename_date,
    get_download_filename_datetime,
    sanitize_filename_segment,
} from '../utils/download_filename_utils.js';
import { sanitize_excel_download_filename_segment } from './excel_export_helpers.js';

export type ExportReportFilenameT = (key: string, opts?: Record<string, unknown>) => string;

export function build_report_export_filename(
    current_audit: {
        auditMetadata?: { caseNumber?: string; actorName?: string };
        updated_at?: string | null;
    },
    is_sort_by_requirements: boolean,
    extension: 'docx' | 'pdf',
    t: ExportReportFilenameT
): string {
    const actor_name = sanitize_filename_segment(
        current_audit.auditMetadata?.actorName || t('filename_fallback_actor')
    );
    const case_number = (current_audit.auditMetadata?.caseNumber || '').trim();
    const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
    const sort_suffix = is_sort_by_requirements ? '_sorterat_på_krav' : '_sorterat_på_stickprov';
    const date_str = get_download_filename_datetime(null);

    if (sanitized_case_number) {
        return `${sanitized_case_number}_${actor_name}_${date_str}${sort_suffix}.${extension}`;
    }
    return `${actor_name}_${date_str}${sort_suffix}.${extension}`;
}

/** Tidsstämpelsegment för övriga exportformat (HTML, ZIP, m.m.). */
export function get_audit_export_filename_datetime_segment(): string {
    return get_download_filename_datetime(null);
}

export function build_deficiency_types_appendix_pdf_filename(
    current_audit: {
        auditMetadata?: { caseNumber?: string; actorName?: string };
        updated_at?: string | null;
    },
    t: ExportReportFilenameT
): string {
    return build_deficiency_types_appendix_filename(current_audit, 'pdf', t);
}

export function build_deficiency_types_appendix_word_filename(
    current_audit: {
        auditMetadata?: { caseNumber?: string; actorName?: string };
        updated_at?: string | null;
    },
    t: ExportReportFilenameT
): string {
    return build_deficiency_types_appendix_filename(current_audit, 'docx', t);
}

function build_deficiency_types_appendix_filename(
    current_audit: {
        auditMetadata?: { caseNumber?: string; actorName?: string };
        updated_at?: string | null;
    },
    extension: 'docx' | 'pdf',
    t: ExportReportFilenameT
): string {
    const base = build_report_export_filename(current_audit, true, extension, t);
    return base.replace(new RegExp(`\\.${extension}$`, 'i'), `_bilaga_1_bristtyper.${extension}`);
}

export function build_screenshots_appendix_word_filename(
    current_audit: {
        auditMetadata?: { caseNumber?: string; actorName?: string };
        updated_at?: string | null;
    },
    t: ExportReportFilenameT
): string {
    return build_screenshots_appendix_filename(current_audit, 'docx', t);
}

export function build_screenshots_appendix_pdf_filename(
    current_audit: {
        auditMetadata?: { caseNumber?: string; actorName?: string };
        updated_at?: string | null;
    },
    t: ExportReportFilenameT
): string {
    return build_screenshots_appendix_filename(current_audit, 'pdf', t);
}

function build_screenshots_appendix_filename(
    current_audit: {
        auditMetadata?: { caseNumber?: string; actorName?: string };
        updated_at?: string | null;
    },
    extension: 'docx' | 'pdf',
    t: ExportReportFilenameT
): string {
    const case_number = sanitize_excel_download_filename_segment(
        current_audit.auditMetadata?.caseNumber || ''
    );
    const actor = sanitize_excel_download_filename_segment(
        current_audit.auditMetadata?.actorName || t('filename_fallback_actor')
    );
    const label = t('screenshots_appendix_export_filename_label');
    const date_label = get_download_filename_date(null, '-');
    const parts: string[] = [];
    if (case_number) {
        parts.push(case_number);
    }
    parts.push(actor, label, date_label);
    return `${parts.join(' ')}.${extension}`;
}

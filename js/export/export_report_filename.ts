/**
 * @fileoverview Gemensam filnamnslogik för Word- och PDF-rapporter.
 */
import {
    get_download_filename_datetime,
    sanitize_filename_segment,
} from '../utils/download_filename_utils.js';

export type ExportReportFilenameT = (key: string, opts?: Record<string, unknown>) => string;

/** Bilagans korta typ i filnamn (fast svenska slug, utan datum). */
export const APPENDIX_EXPORT_TYPE_SUMMARY = 'sammanfattning';
export const APPENDIX_EXPORT_TYPE_PROTOCOL = 'protokoll';
export const APPENDIX_EXPORT_TYPE_SCREENSHOTS = 'skarmbilder';
export const APPENDIX_EXPORT_TYPE_ALL_ZIP = 'alla_bilagor';

type AppendixAuditMetadata = {
    auditMetadata?: {
        caseNumber?: string;
        actorName?: string;
        auditTypeId?: string;
        auditTypeLabel?: string;
    };
    updated_at?: string | null;
};

function sanitize_case_number_for_filename(case_number: string): string {
    return case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
}

function resolve_audit_type_slug_for_filename(current_audit: AppendixAuditMetadata): string {
    const label = sanitize_filename_segment(
        String(current_audit.auditMetadata?.auditTypeLabel ?? '').trim()
    );
    if (label) return label;
    return sanitize_filename_segment(String(current_audit.auditMetadata?.auditTypeId ?? '').trim());
}

function build_export_name_prefix(
    current_audit: AppendixAuditMetadata,
    t: ExportReportFilenameT
): string {
    const actor_name = sanitize_filename_segment(
        current_audit.auditMetadata?.actorName || t('filename_fallback_actor')
    );
    const sanitized_case_number = sanitize_case_number_for_filename(
        (current_audit.auditMetadata?.caseNumber || '').trim()
    );
    const audit_type_slug = resolve_audit_type_slug_for_filename(current_audit);
    const parts = sanitized_case_number ? [sanitized_case_number, actor_name] : [actor_name];
    if (audit_type_slug) {
        parts.push(audit_type_slug);
    }
    return parts.join('_');
}

function build_appendix_export_filename(
    current_audit: AppendixAuditMetadata,
    appendix_number: 1 | 2 | 3,
    appendix_type: string,
    extension: string,
    t: ExportReportFilenameT
): string {
    const type_slug = sanitize_filename_segment(appendix_type);
    const safe_extension = String(extension || '').replace(/^\./, '');
    const bilaga_part = `bilaga_${appendix_number}_${type_slug}`;
    return `${build_export_name_prefix(current_audit, t)}_${bilaga_part}.${safe_extension}`;
}

export function build_report_export_filename(
    current_audit: AppendixAuditMetadata,
    is_sort_by_requirements: boolean,
    extension: 'docx' | 'pdf',
    t: ExportReportFilenameT
): string {
    const actor_name = sanitize_filename_segment(
        current_audit.auditMetadata?.actorName || t('filename_fallback_actor')
    );
    const sanitized_case_number = sanitize_case_number_for_filename(
        (current_audit.auditMetadata?.caseNumber || '').trim()
    );
    const sort_suffix = is_sort_by_requirements ? '_sorterat_på_krav' : '_sorterat_på_granskningsdel';
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

export function build_appendix1_summary_pdf_filename(
    current_audit: AppendixAuditMetadata,
    t: ExportReportFilenameT
): string {
    return build_appendix_export_filename(
        current_audit,
        1,
        APPENDIX_EXPORT_TYPE_SUMMARY,
        'pdf',
        t
    );
}

export function build_appendix1_summary_word_filename(
    current_audit: AppendixAuditMetadata,
    t: ExportReportFilenameT
): string {
    return build_appendix_export_filename(
        current_audit,
        1,
        APPENDIX_EXPORT_TYPE_SUMMARY,
        'docx',
        t
    );
}

/** @deprecated Använd build_appendix1_summary_pdf_filename */
export function build_deficiency_types_appendix_pdf_filename(
    current_audit: AppendixAuditMetadata,
    t: ExportReportFilenameT
): string {
    return build_appendix1_summary_pdf_filename(current_audit, t);
}

/** @deprecated Använd build_appendix1_summary_word_filename */
export function build_deficiency_types_appendix_word_filename(
    current_audit: AppendixAuditMetadata,
    t: ExportReportFilenameT
): string {
    return build_appendix1_summary_word_filename(current_audit, t);
}

export function build_appendix2_export_filename(
    current_audit: AppendixAuditMetadata,
    extension: 'xlsx' | 'csv',
    t: ExportReportFilenameT
): string {
    return build_appendix_export_filename(
        current_audit,
        2,
        APPENDIX_EXPORT_TYPE_PROTOCOL,
        extension,
        t
    );
}

export function build_observation_texts_word_filename(
    current_audit: AppendixAuditMetadata,
    t: ExportReportFilenameT
): string {
    const base = build_report_export_filename(current_audit, true, 'docx', t);
    return base.replace(/\.docx$/i, '_observationstexter.docx');
}

export function build_screenshots_appendix_word_filename(
    current_audit: AppendixAuditMetadata,
    t: ExportReportFilenameT
): string {
    return build_appendix_export_filename(
        current_audit,
        3,
        APPENDIX_EXPORT_TYPE_SCREENSHOTS,
        'docx',
        t
    );
}

export function build_screenshots_appendix_pdf_filename(
    current_audit: AppendixAuditMetadata,
    t: ExportReportFilenameT
): string {
    return build_appendix_export_filename(
        current_audit,
        3,
        APPENDIX_EXPORT_TYPE_SCREENSHOTS,
        'pdf',
        t
    );
}

/** Zip med bilaga 1–3: [diarienummer]_[aktör]_alla_bilagor.zip */
export function build_all_appendices_zip_filename(
    current_audit: AppendixAuditMetadata,
    t: ExportReportFilenameT
): string {
    const suffix = APPENDIX_EXPORT_TYPE_ALL_ZIP;
    return `${build_export_name_prefix(current_audit, t)}_${suffix}.zip`;
}

/**
 * @fileoverview Gemensam filnamnslogik för Word- och PDF-rapporter.
 */
import { format_local_date_for_filename } from '../utils/filename_utils.js';
import { get_server_filename_datetime, sanitize_filename_segment } from '../utils/download_filename_utils.js';

export type ExportReportFilenameT = (key: string, opts?: Record<string, unknown>) => string;

export async function build_report_export_filename(
    current_audit: {
        auditMetadata?: { caseNumber?: string; actorName?: string };
        updated_at?: string | null;
    },
    is_sort_by_requirements: boolean,
    extension: 'docx' | 'pdf',
    t: ExportReportFilenameT
): Promise<string> {
    const actor_name = sanitize_filename_segment(
        current_audit.auditMetadata?.actorName || t('filename_fallback_actor')
    );
    const case_number = (current_audit.auditMetadata?.caseNumber || '').trim();
    const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
    const sort_suffix = is_sort_by_requirements ? '_sorterat_på_krav' : '_sorterat_på_stickprov';
    const last_updated_iso = current_audit?.updated_at || null;
    const server_dt = await get_server_filename_datetime(last_updated_iso);
    const fallback_now = server_dt ? null : await get_server_filename_datetime(null);
    const date_str = server_dt || fallback_now || format_local_date_for_filename(new Date(), '');

    if (sanitized_case_number) {
        return `${sanitized_case_number}_${actor_name}_${date_str}${sort_suffix}.${extension}`;
    }
    return `${actor_name}_${date_str}${sort_suffix}.${extension}`;
}

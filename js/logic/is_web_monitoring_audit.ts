/**
 * @fileoverview Avgör om granskningen är webb utifrån «Vad som ska granskas» i regelfilen.
 */
import { resolve_rulefile_monitoring_kind } from '../../shared/rulefile/content_type_detection_pattern_rulefile_apply.js';

/**
 * Sant när monitoringType indikerar webb (case-insensitive delsträng «web» m.m.).
 */
export function is_web_monitoring_audit(rule_file_content: unknown): boolean {
    const metadata = (rule_file_content as { metadata?: unknown } | null)?.metadata;
    return resolve_rulefile_monitoring_kind(metadata) === 'web';
}

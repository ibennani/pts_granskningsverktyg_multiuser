/**
 * @fileoverview Klientlogik för innehållstypdetektering från inklistrad HTML.
 */

import { resolve_content_types } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import {
    apply_detection_patterns_to_content_types,
    resolve_rulefile_monitoring_kind,
} from '../../../shared/rulefile/content_type_detection_pattern_rulefile_apply.js';
import {
    collect_child_detection_patterns_from_groups,
    detect_content_type_ids_from_html,
    MAX_PASTE_HTML_LENGTH,
    type ContentTypeDetectionPatternRule,
} from '../../../shared/rulefile/content_type_detection_pattern.js';

export { MAX_PASTE_HTML_LENGTH };

type RuleFileLike = {
    metadata?: Record<string, unknown>;
};

type ContentTypeGroupLike = {
    types?: Array<{ id?: string; text?: string; detectionPattern?: string }>;
};

function resolve_content_type_groups_for_detection(
    rule_file: RuleFileLike | null | undefined
): ContentTypeGroupLike[] {
    const metadata = rule_file?.metadata;
    const groups = resolve_content_types(metadata) as ContentTypeGroupLike[];
    const monitoring_kind = resolve_rulefile_monitoring_kind(metadata);

    if (monitoring_kind === 'pdf') {
        return groups;
    }

    // Inbäddad regelfil i granskning kan sakna detectionPattern tills regelfilen sparats om.
    // Webbkatalogen används då vid körning (samma mönster som vid persist för webb).
    return apply_detection_patterns_to_content_types(groups, 'web');
}

export function collect_child_detection_patterns(
    rule_file: RuleFileLike | null | undefined
): ContentTypeDetectionPatternRule[] {
    if (resolve_rulefile_monitoring_kind(rule_file?.metadata) === 'pdf') {
        return [];
    }

    const groups = resolve_content_type_groups_for_detection(rule_file);
    return collect_child_detection_patterns_from_groups(groups);
}

export function detect_content_types_from_html(
    html: string,
    rules: ContentTypeDetectionPatternRule[]
): string[] {
    return detect_content_type_ids_from_html(html, rules);
}

export function is_paste_html_within_limit(html: string): boolean {
    return String(html || '').length <= MAX_PASTE_HTML_LENGTH;
}

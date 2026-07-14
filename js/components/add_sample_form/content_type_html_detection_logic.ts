/**
 * @fileoverview Klientlogik för innehållstypdetektering från inklistrad HTML.
 */

import { resolve_content_types } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
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

export function collect_child_detection_patterns(
    rule_file: RuleFileLike | null | undefined
): ContentTypeDetectionPatternRule[] {
    const groups = resolve_content_types(rule_file?.metadata) as Array<{
        types?: Array<{ id?: string; detectionPattern?: string }>;
    }>;
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

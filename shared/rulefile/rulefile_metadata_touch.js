/**
 * @file Uppdaterar metadata.version och metadata.dateModified för regelfilsinnehåll.
 */

import { compute_next_rulefile_metadata_version } from './rulefile_metadata_version.js';

/**
 * @param {Date} reference_date
 * @returns {string}
 */
export function format_rulefile_date_modified(reference_date) {
    const ref = reference_date instanceof Date ? reference_date : new Date();
    return ref.toISOString().split('T')[0];
}

/**
 * @param {unknown} draft_metadata_version
 * @param {unknown} published_metadata_version
 * @param {Date} reference_date
 * @returns {string}
 */
export function resolve_publish_production_version(
    draft_metadata_version,
    published_metadata_version,
    reference_date
) {
    const draft = draft_metadata_version != null ? String(draft_metadata_version).trim() : '';
    if (draft) return draft;
    return compute_next_rulefile_metadata_version(published_metadata_version, reference_date);
}

/**
 * @param {unknown} content
 * @param {{ bump_version?: boolean, reference_date?: Date }} [options]
 * @returns {Record<string, unknown>|null}
 */
export function touch_rulefile_metadata(content, options = {}) {
    if (!content || typeof content !== 'object') return null;

    const { bump_version = false, reference_date = new Date() } = options;
    const ref = reference_date instanceof Date ? reference_date : new Date();
    const current_metadata =
        content.metadata && typeof content.metadata === 'object' ? content.metadata : {};

    const next_metadata = {
        ...current_metadata,
        dateModified: format_rulefile_date_modified(ref)
    };

    if (bump_version) {
        next_metadata.version = compute_next_rulefile_metadata_version(
            current_metadata.version,
            ref
        );
    }

    return {
        ...content,
        metadata: next_metadata
    };
}

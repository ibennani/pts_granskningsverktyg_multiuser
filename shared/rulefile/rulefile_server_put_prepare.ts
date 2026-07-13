/**
 * @file Förbereder regelfilsinnehåll vid PUT till servern (arbetskopior).
 * Versionsbump utgår från befintlig rad i databasen — klienten kan inte lämna version oförändrad.
 */

import { compute_next_rulefile_metadata_version } from './rulefile_metadata_version.js';
import { touch_rulefile_metadata } from './rulefile_metadata_touch.js';
import { normalize_rulefile_content_vocabularies_for_persist } from './rulefile_metadata_vocabularies.js';

export function prepare_rulefile_content_for_server_put(
    existing_metadata_version: unknown,
    incoming_content: unknown,
    options: { reference_date?: Date } = {}
): Record<string, unknown> | null {
    const normalized = normalize_rulefile_content_vocabularies_for_persist(incoming_content);
    if (!normalized) return null;

    const ref = options.reference_date instanceof Date ? options.reference_date : new Date();
    const metadata =
        normalized.metadata && typeof normalized.metadata === 'object' && !Array.isArray(normalized.metadata)
            ? (normalized.metadata as Record<string, unknown>)
            : {};
    const next_version = compute_next_rulefile_metadata_version(existing_metadata_version, ref);

    return touch_rulefile_metadata(
        {
            ...normalized,
            metadata: {
                ...metadata,
                version: next_version
            }
        },
        { bump_version: false, reference_date: ref }
    );
}

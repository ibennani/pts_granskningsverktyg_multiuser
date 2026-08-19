/**
 * @file Förbereder regelfilsinnehåll vid PUT till servern (arbetskopior).
 * Versionsbump utgår från befintlig rad i databasen — klienten kan inte lämna version oförändrad.
 */

import { compute_next_rulefile_metadata_version } from './rulefile_metadata_version.js';
import { touch_rulefile_metadata } from './rulefile_metadata_touch.js';
import { normalize_rulefile_content_vocabularies_for_persist } from './rulefile_metadata_vocabularies.js';

function resolve_metadata_version_for_put(
    existing_metadata_version: unknown,
    incoming_metadata_version: unknown,
    reference_date: Date,
    bump_version: boolean
): string {
    if (bump_version) {
        return compute_next_rulefile_metadata_version(existing_metadata_version, reference_date);
    }
    const from_db =
        existing_metadata_version != null ? String(existing_metadata_version).trim() : '';
    if (from_db) return from_db;
    const from_client =
        incoming_metadata_version != null ? String(incoming_metadata_version).trim() : '';
    if (from_client) return from_client;
    return compute_next_rulefile_metadata_version(null, reference_date);
}

export function prepare_rulefile_content_for_server_put(
    existing_metadata_version: unknown,
    incoming_content: unknown,
    options: { reference_date?: Date; bump_version?: boolean } = {}
): Record<string, unknown> | null {
    const normalized = normalize_rulefile_content_vocabularies_for_persist(incoming_content);
    if (!normalized) return null;

    const ref = options.reference_date instanceof Date ? options.reference_date : new Date();
    const bump_version = options.bump_version === true;
    const metadata =
        normalized.metadata && typeof normalized.metadata === 'object' && !Array.isArray(normalized.metadata)
            ? (normalized.metadata as Record<string, unknown>)
            : {};
    const version_to_store = resolve_metadata_version_for_put(
        existing_metadata_version,
        metadata.version,
        ref,
        bump_version
    );

    return touch_rulefile_metadata(
        {
            ...normalized,
            metadata: {
                ...metadata,
                version: version_to_store
            }
        },
        { bump_version: false, reference_date: ref }
    );
}

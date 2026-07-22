/**
 * @fileoverview Hjälpfunktioner för filnamnsbyten vid PNG-migrering av audit media.
 */

export type { AuditMediaFilenameMigration } from '../../shared/media/audit_media_filename_migrations.js';
export {
    build_audit_media_filename_migration_map,
    resolve_migrated_media_filename,
    resolve_migrated_media_filename_chain
} from '../../shared/media/audit_media_filename_migrations.js';

import {
    build_audit_media_filename_migration_map,
    resolve_migrated_media_filename,
    type AuditMediaFilenameMigration
} from '../../shared/media/audit_media_filename_migrations.js';

/**
 * Byter ut migrerade filnamn i en filnamnslista.
 */
export function apply_audit_media_filename_migrations(
    filenames: string[],
    migrations: AuditMediaFilenameMigration[]
): string[] {
    if (!migrations.length) return filenames;
    const migration_map = build_audit_media_filename_migration_map(migrations);
    return filenames.map((name) => resolve_migrated_media_filename(name, migration_map));
}

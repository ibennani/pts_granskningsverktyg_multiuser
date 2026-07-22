/**
 * @fileoverview Hjälpfunktioner för filnamnsbyten vid PNG-migrering av audit media.
 */

export type AuditMediaFilenameMigration = {
    from: string;
    to: string;
};

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

/**
 * Bygger lookup-karta från migreringslista.
 */
export function build_audit_media_filename_migration_map(
    migrations: AuditMediaFilenameMigration[]
): Map<string, string> {
    return new Map(migrations.map((entry) => [entry.from, entry.to]));
}

/**
 * Returnerar migrerat filnamn om det finns, annars originalet.
 */
export function resolve_migrated_media_filename(
    filename: string,
    migration_map: Map<string, string>
): string {
    const trimmed = String(filename || '').trim();
    if (!trimmed) return trimmed;
    return migration_map.get(trimmed) ?? trimmed;
}

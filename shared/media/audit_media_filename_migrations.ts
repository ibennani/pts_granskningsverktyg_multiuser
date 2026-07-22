/**
 * @fileoverview Migreringskedjor för audit media-filnamn (PNG m.m.).
 */

export type AuditMediaFilenameMigration = {
    from: string;
    to: string;
};

/**
 * Bygger lookup-karta från migreringslista.
 */
export function build_audit_media_filename_migration_map(
    migrations: AuditMediaFilenameMigration[]
): Map<string, string> {
    return new Map(migrations.map((entry) => [entry.from, entry.to]));
}

/**
 * Följer migreringskedjor tills inget fler steg finns (t.ex. A→B→C).
 */
export function resolve_migrated_media_filename_chain(
    filename: string,
    migration_map: Map<string, string>
): string {
    let current = String(filename || '').trim();
    if (!current || migration_map.size === 0) {
        return current;
    }
    const seen = new Set<string>();
    while (migration_map.has(current) && !seen.has(current)) {
        seen.add(current);
        current = migration_map.get(current)!;
    }
    return current;
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

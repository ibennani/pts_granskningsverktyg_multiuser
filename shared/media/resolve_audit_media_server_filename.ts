/**
 * @fileoverview Löser visat filnamn till faktiskt serverfilnamn (migration, skiftläge).
 */

import {
    resolve_migrated_media_filename_chain,
    type AuditMediaFilenameMigration
} from './audit_media_filename_migrations.js';
import { is_image_filename } from './sanitize_media_filename.js';
import { normalize_image_filename_to_png } from './image_png_upload.js';

/**
 * Normaliserar filnamn för jämförelse (trim, NFC, gemener).
 */
export function normalize_media_filename_key(name: string): string {
    return String(name || '').trim().normalize('NFC').toLowerCase();
}

/**
 * Normaliserar filnamn för lös matchning (ignorerar bindestreck och understreck).
 */
export function normalize_media_filename_loose_key(name: string): string {
    return normalize_media_filename_key(name).replace(/[-_]/g, '');
}

/**
 * Hittar serverfil vid lös matchning när exakt en fil matchar (t.ex. cookie-banner vs cookiebanner).
 */
export function find_server_media_filename_loose_match(
    referenced_filename: string,
    server_filenames: Set<string> | readonly string[] | null | undefined
): string | null {
    const trimmed = String(referenced_filename || '').trim();
    if (!trimmed || !server_filenames) {
        return null;
    }
    const names = server_filenames instanceof Set ? server_filenames : new Set(server_filenames);
    if (names.size === 0) {
        return null;
    }
    const ref_loose = normalize_media_filename_loose_key(trimmed);
    if (!ref_loose) {
        return null;
    }
    let match: string | null = null;
    for (const server_name of names) {
        if (normalize_media_filename_loose_key(server_name) !== ref_loose) {
            continue;
        }
        if (match !== null) {
            return null;
        }
        match = server_name;
    }
    return match;
}

/**
 * Hittar motsvarande serverfil vid exakt träff eller skiftläges-/normaliseringsmatch.
 */
export function find_server_media_filename_match(
    referenced_filename: string,
    server_filenames: Set<string> | readonly string[] | null | undefined
): string | null {
    const trimmed = String(referenced_filename || '').trim();
    if (!trimmed || !server_filenames) {
        return null;
    }
    const names = server_filenames instanceof Set ? server_filenames : new Set(server_filenames);
    if (names.size === 0) {
        return null;
    }
    if (names.has(trimmed)) {
        return trimmed;
    }
    const ref_key = normalize_media_filename_key(trimmed);
    for (const server_name of names) {
        if (normalize_media_filename_key(server_name) === ref_key) {
            return server_name;
        }
    }
    return find_server_media_filename_loose_match(trimmed, names);
}

/**
 * Löser filnamn för API-anrop utifrån listpost, migrationer och serverindex.
 */
export function resolve_server_media_fetch_filename(
    filename: string,
    server_filenames: Set<string> | readonly string[] | null | undefined,
    migration_map?: Map<string, string> | null
): string {
    const trimmed = String(filename || '').trim();
    if (!trimmed) {
        return trimmed;
    }

    const candidates: string[] = [];
    const add_candidate = (name: string) => {
        const candidate = String(name || '').trim();
        if (candidate && !candidates.includes(candidate)) {
            candidates.push(candidate);
        }
    };

    add_candidate(trimmed);
    if (migration_map && migration_map.size > 0) {
        add_candidate(resolve_migrated_media_filename_chain(trimmed, migration_map));
    }

    for (const candidate of candidates) {
        const match = find_server_media_filename_match(candidate, server_filenames);
        if (match) {
            return match;
        }
    }

    if (server_filenames) {
        return trimmed;
    }

    return candidates.length > 1 ? candidates[candidates.length - 1]! : trimmed;
}

/**
 * Löser PATCH/DELETE-filnamn mot aktuell fillista och migreringar på servern.
 */
export function resolve_audit_media_filename_on_server(
    referenced_filename: string,
    server_filenames: readonly string[],
    migrations: AuditMediaFilenameMigration[] = []
): string | null {
    const migration_map = migrations.length
        ? new Map(migrations.map((entry) => [entry.from, entry.to]))
        : null;
    return resolve_media_rename_source_filename(
        referenced_filename,
        server_filenames,
        migration_map
    );
}

/**
 * Löser källfilnamn för omdöpning mot serverindex och migreringar.
 * Returnerar null om filen inte finns på servern.
 */
export function resolve_media_rename_source_filename(
    referenced_filename: string,
    server_filenames: Set<string> | readonly string[] | null | undefined,
    migration_map?: Map<string, string> | null
): string | null {
    if (!server_filenames) {
        return null;
    }
    const names = server_filenames instanceof Set ? server_filenames : new Set(server_filenames);
    if (names.size === 0) {
        return null;
    }

    const trimmed = String(referenced_filename || '').trim();
    const candidates: string[] = [];
    const add_candidate = (name: string) => {
        const candidate = String(name || '').trim();
        if (candidate && !candidates.includes(candidate)) {
            candidates.push(candidate);
        }
    };

    add_candidate(trimmed);
    if (migration_map && migration_map.size > 0) {
        add_candidate(resolve_migrated_media_filename_chain(trimmed, migration_map));
    }
    if (is_image_filename(trimmed)) {
        add_candidate(normalize_image_filename_to_png(trimmed));
    }

    for (const candidate of candidates) {
        const match = find_server_media_filename_match(candidate, names);
        if (match) {
            return match;
        }
    }

    return null;
}

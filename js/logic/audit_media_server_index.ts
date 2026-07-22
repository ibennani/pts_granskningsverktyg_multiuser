/**
 * @fileoverview Håller reda på vilka bifogade filnamn som faktiskt finns på servern.
 */

import { list_audit_media, type AuditMediaFilenameMigration } from '../api/audit_media_api.js';
import { build_audit_media_filename_migration_map } from './audit_media_filename_migrations.js';
import {
    find_server_media_filename_match,
    normalize_media_filename_key,
    resolve_server_media_fetch_filename
} from '../../shared/media/resolve_audit_media_server_filename.js';

export { find_server_media_filename_match, normalize_media_filename_key, resolve_server_media_fetch_filename };

/**
 * Basnamn utan unikt suffix, t.ex. "bild (2).png" -> "bild.png" (normaliserat).
 */
export function get_media_conflict_basename(filename: string): string {
    const trimmed = String(filename || '').trim();
    const dot = trimmed.lastIndexOf('.');
    const ext = dot > 0 ? trimmed.slice(dot) : '';
    const base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
    const without_suffix = base.replace(/\s+\(\d+\)$/, '');
    return normalize_media_filename_key(`${without_suffix}${ext}`);
}

/**
 * Ersätter lokalt filnamn och äldre varianter med samma bas efter uppladdning.
 */
export function merge_uploaded_media_filenames(
    filenames: string[],
    local_name: string,
    server_name: string
): string[] {
    const local_trimmed = String(local_name || '').trim();
    const server_trimmed = String(server_name || '').trim();
    if (!server_trimmed) {
        return filenames;
    }
    const local_base = local_trimmed ? get_media_conflict_basename(local_trimmed) : '';
    const next = filenames.filter((name) => {
        const trimmed = String(name || '').trim();
        if (!trimmed || trimmed === server_trimmed || trimmed === local_trimmed) {
            return false;
        }
        if (local_base && get_media_conflict_basename(trimmed) === local_base) {
            return false;
        }
        return true;
    });
    if (!next.includes(server_trimmed)) {
        next.push(server_trimmed);
    }
    return next;
}

/**
 * Returnerar true om filnamnet redan finns i listan och blockera uppladdning.
 * Okänt serverindex behandlar listposter som äldre filnamnsreferenser (ej blockerande).
 */
export function is_upload_duplicate_filename(
    filename: string,
    working_filenames: string[],
    server_filenames: Set<string> | null | undefined
): boolean {
    const trimmed = String(filename || '').trim();
    if (!trimmed || !working_filenames.includes(trimmed)) {
        return false;
    }
    if (server_filenames === null || server_filenames === undefined) {
        return false;
    }
    return server_filenames.has(trimmed);
}

/**
 * Delar upp filer i nya, dubbletter och filer som ersätter äldre filnamnsreferenser.
 */
export function partition_files_for_upload(
    files: File[],
    working_filenames: string[],
    server_filenames: Set<string> | null | undefined
): { new_files: File[]; duplicate_names: string[] } {
    const new_files: File[] = [];
    const duplicate_names: string[] = [];

    files.forEach((file) => {
        const name = String(file.name || '').trim();
        if (!name) return;
        if (is_upload_duplicate_filename(name, working_filenames, server_filenames)) {
            duplicate_names.push(name);
            return;
        }
        new_files.push(file);
    });

    return { new_files, duplicate_names };
}

/**
 * Filnamn som ska raderas fysiskt på servern (hoppar över äldre filnamnsreferenser).
 */
export function filenames_existing_on_server(
    filenames: string[],
    server_filenames: Set<string> | null | undefined
): string[] {
    if (server_filenames === null || server_filenames === undefined) {
        return filenames
            .map((name) => String(name || '').trim())
            .filter(Boolean);
    }
    return filenames.filter((name) => {
        const trimmed = String(name || '').trim();
        return trimmed.length > 0 && server_filenames.has(trimmed);
    });
}

export type AuditMediaServerIndex = {
    load: () => Promise<AuditMediaFilenameMigration[]>;
    ensure_loaded: () => Promise<AuditMediaFilenameMigration[]>;
    get_server_filenames: () => Set<string> | null;
    resolve_fetch_filename: (filename: string) => string;
    mark_on_server: (filename: string) => void;
    mark_removed_from_server: (filename: string) => void;
    mark_renamed_on_server: (from_filename: string, to_filename: string) => void;
};

/**
 * Skapar ett index över serverfiler för en granskning (laddas asynkront vid modalöppning).
 */
export function create_audit_media_server_index(
    audit_id: string | null | undefined
): AuditMediaServerIndex {
    let server_filenames: Set<string> | null = null;
    let filename_migration_map = new Map<string, string>();
    let load_promise: Promise<AuditMediaFilenameMigration[]> | null = null;
    let load_completed = false;
    const id = String(audit_id || '').trim();

    const merge_filename_migrations = (migrations: AuditMediaFilenameMigration[]): void => {
        if (!migrations.length) {
            return;
        }
        const loaded_map = build_audit_media_filename_migration_map(migrations);
        loaded_map.forEach((to: string, from: string) => {
            filename_migration_map.set(from, to);
        });
    };

    const load = async (): Promise<AuditMediaFilenameMigration[]> => {
        if (!id) {
            server_filenames = new Set();
            load_completed = true;
            return [];
        }
        try {
            const result = await list_audit_media(id);
            const loaded = new Set(result.files.map((entry) => entry.filename));
            if (server_filenames) {
                server_filenames.forEach((name) => loaded.add(name));
            }
            server_filenames = loaded;
            merge_filename_migrations(result.filename_migrations);
            load_completed = true;
            return result.filename_migrations;
        } catch {
            server_filenames = server_filenames ?? new Set();
            load_completed = true;
            return [];
        }
    };

    const ensure_loaded = async (): Promise<AuditMediaFilenameMigration[]> => {
        if (load_completed) {
            return [];
        }
        if (!load_promise) {
            load_promise = load().finally(() => {
                load_promise = null;
            });
        }
        return load_promise;
    };

    const resolve_fetch_filename = (filename: string): string =>
        resolve_server_media_fetch_filename(filename, server_filenames, filename_migration_map);

    const mark_on_server = (filename: string): void => {
        const trimmed = String(filename || '').trim();
        if (!trimmed) return;
        if (!server_filenames) {
            server_filenames = new Set();
        }
        server_filenames.add(trimmed);
    };

    const mark_removed_from_server = (filename: string): void => {
        const trimmed = String(filename || '').trim();
        if (!trimmed) return;
        server_filenames?.delete(trimmed);
    };

    const mark_renamed_on_server = (from_filename: string, to_filename: string): void => {
        mark_removed_from_server(from_filename);
        mark_on_server(to_filename);
    };

    return {
        load,
        ensure_loaded,
        get_server_filenames: () => server_filenames,
        resolve_fetch_filename,
        mark_on_server,
        mark_removed_from_server,
        mark_renamed_on_server
    };
}

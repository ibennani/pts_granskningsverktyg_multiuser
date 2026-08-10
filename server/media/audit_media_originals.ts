/**
 * @fileoverview Lagring av uppladdade originalbilder under orginalbilder/ per granskning.
 */

import fs from 'fs/promises';
import path from 'path';
import {
    resolve_upload_media_filename,
    resolve_unique_media_filename,
    sanitize_media_filename
} from '../../shared/media/sanitize_media_filename.js';
import { get_audit_media_dir } from './audit_media_storage.js';

const ORIGINALS_SUBDIR = 'orginalbilder';
const INDEX_FILENAME = '_index.json';

type OriginalIndexEntry = {
    stored_filename: string;
};

type OriginalIndex = Record<string, OriginalIndexEntry>;

function get_originals_dir(audit_id: string): string {
    return path.join(get_audit_media_dir(audit_id), ORIGINALS_SUBDIR);
}

export function get_audit_media_originals_dir(audit_id: string): string {
    return get_originals_dir(audit_id);
}

function index_file_path(audit_id: string): string {
    return path.join(get_originals_dir(audit_id), INDEX_FILENAME);
}

/**
 * Resolverar sökväg till en fil i orginalbilder/ med path-säkerhet.
 */
export function resolve_audit_media_original_path(audit_id: string, stored_filename: string): string {
    const sanitized = sanitize_media_filename(stored_filename);
    if (!sanitized) {
        throw new Error('Ogiltigt filnamn');
    }
    const dir = path.resolve(get_originals_dir(audit_id));
    const full = path.resolve(dir, sanitized);
    if (!full.startsWith(dir + path.sep) && full !== dir) {
        throw new Error('Ogiltig sökväg');
    }
    return full;
}

async function list_original_stored_filenames(audit_id: string): Promise<Set<string>> {
    const dir = get_originals_dir(audit_id);
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const names = new Set<string>();
        for (const entry of entries) {
            if (entry.isFile() && entry.name !== INDEX_FILENAME) {
                names.add(entry.name);
            }
        }
        return names;
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
            return new Set();
        }
        throw err;
    }
}

async function read_index(audit_id: string): Promise<OriginalIndex> {
    const index_path = index_file_path(audit_id);
    try {
        const raw = await fs.readFile(index_path, 'utf8');
        const parsed = JSON.parse(raw) as OriginalIndex;
        if (!parsed || typeof parsed !== 'object') {
            return {};
        }
        return parsed;
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
            return {};
        }
        throw err;
    }
}

async function write_index(audit_id: string, index: OriginalIndex): Promise<void> {
    const dir = get_originals_dir(audit_id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(index_file_path(audit_id), JSON.stringify(index, null, 2), 'utf8');
}

/**
 * Returnerar kanonisk filnamn → filnamn i orginalbilder/.
 */
export async function get_audit_media_original_index(audit_id: string): Promise<Record<string, string>> {
    const index = await read_index(audit_id);
    const result: Record<string, string> = {};
    for (const [canonical, entry] of Object.entries(index)) {
        if (entry?.stored_filename) {
            result[canonical] = entry.stored_filename;
        }
    }
    return result;
}

/**
 * Kopierar källfil till orginalbilder/ och indexerar mot kanonisk filnamn.
 */
export async function save_audit_media_original(
    audit_id: string,
    canonical_filename: string,
    source_path: string,
    upload_display_name: string
): Promise<string> {
    const sanitized_canonical = sanitize_media_filename(canonical_filename);
    if (!sanitized_canonical) {
        throw new Error('Ogiltigt kanoniskt filnamn');
    }

    const originals_dir = get_originals_dir(audit_id);
    await fs.mkdir(originals_dir, { recursive: true });

    const requested = resolve_upload_media_filename(upload_display_name);
    const existing = await list_original_stored_filenames(audit_id);
    const stored_filename = resolve_unique_media_filename(requested, (name) => existing.has(name));
    const dest_path = resolve_audit_media_original_path(audit_id, stored_filename);

    await fs.copyFile(source_path, dest_path);

    const index = await read_index(audit_id);
    index[sanitized_canonical] = { stored_filename };
    await write_index(audit_id, index);

    return stored_filename;
}

/**
 * Tar bort originalfil och indexpost för kanonisk filnamn.
 */
export async function remove_audit_media_original(audit_id: string, canonical_filename: string): Promise<void> {
    const sanitized_canonical = sanitize_media_filename(canonical_filename);
    if (!sanitized_canonical) {
        return;
    }

    const index = await read_index(audit_id);
    const entry = index[sanitized_canonical];
    if (!entry?.stored_filename) {
        return;
    }

    delete index[sanitized_canonical];
    await write_index(audit_id, index);

    try {
        await fs.unlink(resolve_audit_media_original_path(audit_id, entry.stored_filename));
    } catch (err: unknown) {
        if (!err || typeof err !== 'object' || !('code' in err) || err.code !== 'ENOENT') {
            throw err;
        }
    }
}

/**
 * Uppdaterar index när kanonisk fil byter namn (originalfilens namn i orginalbilder/ oförändrat).
 */
export async function remap_audit_media_original_index(
    audit_id: string,
    from_canonical: string,
    to_canonical: string
): Promise<void> {
    const from = sanitize_media_filename(from_canonical);
    const to = sanitize_media_filename(to_canonical);
    if (!from || !to || from === to) {
        return;
    }

    const index = await read_index(audit_id);
    const entry = index[from];
    if (!entry) {
        return;
    }

    delete index[from];
    index[to] = entry;
    await write_index(audit_id, index);
}

/**
 * Hämtar sökväg till originalfil för kanonisk filnamn, eller null om index saknas.
 */
export async function resolve_audit_media_original_file_path(
    audit_id: string,
    canonical_filename: string
): Promise<string | null> {
    const sanitized_canonical = sanitize_media_filename(canonical_filename);
    if (!sanitized_canonical) {
        return null;
    }

    const index = await read_index(audit_id);
    const entry = index[sanitized_canonical];
    if (!entry?.stored_filename) {
        return null;
    }

    const full = resolve_audit_media_original_path(audit_id, entry.stored_filename);
    try {
        const stat = await fs.stat(full);
        if (!stat.isFile()) {
            return null;
        }
    } catch {
        return null;
    }

    return full;
}

/**
 * @fileoverview Fillagring för tekniska snapshot-arkiv per granskning.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function get_audit_snapshot_root_dir(): string {
    const base = process.env.GV_AUDIT_SNAPSHOT_DIR || path.join(process.cwd(), 'audit-snapshots');
    return path.resolve(base);
}

function assert_safe_uuid(value: string, label: string): string {
    const trimmed = String(value || '').trim();
    if (!UUID_RE.test(trimmed)) {
        throw new Error(`Ogiltigt ${label}`);
    }
    return trimmed;
}

export function get_audit_snapshot_dir(audit_id: string): string {
    const safe_id = assert_safe_uuid(audit_id, 'gransknings-id');
    return path.join(get_audit_snapshot_root_dir(), safe_id);
}

export function get_snapshot_archive_path(audit_id: string, capture_id: string): string {
    const dir = get_audit_snapshot_dir(audit_id);
    const safe_capture = assert_safe_uuid(capture_id, 'capture-id');
    const full = path.resolve(dir, `${safe_capture}.zip`);
    if (!full.startsWith(dir + path.sep)) {
        throw new Error('Ogiltig sökväg');
    }
    return full;
}

export function get_snapshot_temp_archive_path(audit_id: string, capture_id: string): string {
    return `${get_snapshot_archive_path(audit_id, capture_id)}.tmp`;
}

export function get_snapshot_temp_capture_dir(audit_id: string, capture_id: string): string {
    const dir = get_audit_snapshot_dir(audit_id);
    const safe_capture = assert_safe_uuid(capture_id, 'capture-id');
    const full = path.resolve(dir, `.capture-${safe_capture}`);
    if (!full.startsWith(dir + path.sep)) {
        throw new Error('Ogiltig temp-sökväg');
    }
    return full;
}

export async function ensure_audit_snapshot_dir(audit_id: string): Promise<string> {
    const dir = get_audit_snapshot_dir(audit_id);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

export async function remove_snapshot_files_best_effort(
    audit_id: string,
    capture_id: string
): Promise<void> {
    const paths = [
        get_snapshot_archive_path(audit_id, capture_id),
        get_snapshot_temp_archive_path(audit_id, capture_id),
        get_snapshot_temp_capture_dir(audit_id, capture_id),
    ];
    for (const p of paths) {
        try {
            await fs.rm(p, { recursive: true, force: true });
        } catch {
            // best-effort
        }
    }
}

export async function remove_audit_snapshot_dir_best_effort(audit_id: string): Promise<void> {
    try {
        const dir = get_audit_snapshot_dir(audit_id);
        await fs.rm(dir, { recursive: true, force: true });
    } catch {
        // best-effort
    }
}

export async function cleanup_stale_temp_files_best_effort(audit_id: string): Promise<void> {
    try {
        const dir = get_audit_snapshot_dir(audit_id);
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.endsWith('.tmp') || entry.name.startsWith('.capture-')) {
                await fs.rm(path.join(dir, entry.name), { recursive: true, force: true });
            }
        }
    } catch {
        // best-effort
    }
}

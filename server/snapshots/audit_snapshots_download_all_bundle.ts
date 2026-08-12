/**
 * @fileoverview Platt zip-struktur för nedladdning av alla sidrapporter.
 */
import path from 'path';
import JSZip from 'jszip';
import { sanitize_filename_segment } from '../../js/logic/backup_download_filename.js';

export function build_snapshot_export_folder_name(
    sample_id: string,
    description: string | null | undefined
): string {
    const desc = sanitize_filename_segment(description?.trim() || sample_id);
    const id_suffix = sanitize_filename_segment(sample_id);
    return `${desc}__${id_suffix}`;
}

export function is_safe_zip_entry_path(entry_path: string): boolean {
    const normalized = path.posix.normalize(entry_path.replace(/\\/g, '/'));
    if (!normalized || normalized === '.' || normalized.startsWith('..')) {
        return false;
    }
    return !normalized.split('/').some((part) => part === '..');
}

export async function append_snapshot_archive_to_zip(
    target_zip: JSZip,
    archive_buffer: Buffer,
    folder_prefix: string
): Promise<string[]> {
    const inner = await JSZip.loadAsync(archive_buffer);
    const prefix = folder_prefix.replace(/\/+$/, '');
    const added_paths: string[] = [];

    for (const [entry_path, entry] of Object.entries(inner.files)) {
        if (entry.dir || !is_safe_zip_entry_path(entry_path)) {
            continue;
        }
        const rel = entry_path.replace(/^\/+/, '');
        const dest = `${prefix}/${rel}`;
        if (!is_safe_zip_entry_path(dest)) {
            continue;
        }
        const data = await entry.async('nodebuffer');
        target_zip.file(dest, data);
        added_paths.push(dest);
    }

    added_paths.sort();
    return added_paths;
}

export type SnapshotsDownloadAllIndexEntry = {
    folder: string | null;
    snapshotId: string;
    sampleId: string;
    description: string | null;
    url: string | null | undefined;
    capturedAt: string | null;
    included: boolean;
    files?: string[];
    reason?: string;
};

export type SnapshotsDownloadAllIndex = {
    formatVersion: 2;
    auditId: string;
    exportedAt: string;
    snapshots: SnapshotsDownloadAllIndexEntry[];
};

export function build_snapshots_download_all_index(
    audit_id: string,
    entries: SnapshotsDownloadAllIndexEntry[]
): SnapshotsDownloadAllIndex {
    return {
        formatVersion: 2,
        auditId: audit_id,
        exportedAt: new Date().toISOString(),
        snapshots: entries,
    };
}

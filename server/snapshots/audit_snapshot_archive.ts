/**
 * @fileoverview Zip-paketering av tekniska snapshots med manifest och SHA-256.
 */
import { createHash } from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import { get_snapshot_max_bytes } from './audit_snapshot_config.js';
import {
    get_snapshot_temp_archive_path,
    get_snapshot_archive_path,
} from './audit_snapshot_storage.js';

export type ManifestMember = {
    path: string;
    sizeBytes: number;
    sha256: string;
    originalUrl?: string;
    mimeType?: string | null;
    resourceType?: string;
    bodyCaptured?: boolean;
    warning?: string | null;
};

export type BuildArchiveInput = {
    audit_id: string;
    capture_id: string;
    temp_dir: string;
    metadata: Record<string, unknown>;
    warnings: Array<{ code: string; message: string }>;
    network_resources: ManifestMember[];
};

async function hash_file(file_path: string): Promise<{ size: number; sha256: string; data: Buffer }> {
    const data = await fs.readFile(file_path);
    const sha256 = createHash('sha256').update(data).digest('hex');
    return { size: data.length, sha256, data };
}

async function collect_files_recursive(dir: string, base = ''): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const rel = base ? `${base}/${entry.name}` : entry.name;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collect_files_recursive(full, rel)));
        } else {
            files.push(rel.replace(/\\/g, '/'));
        }
    }
    return files;
}

export async function build_snapshot_archive(input: BuildArchiveInput): Promise<{
    archive_path: string;
    size_bytes: number;
    warning_count: number;
}> {
    const members: ManifestMember[] = [];
    const zip = new JSZip();
    const rel_files = await collect_files_recursive(input.temp_dir);

    for (const rel of rel_files.sort()) {
        const full = path.join(input.temp_dir, rel);
        const { size, sha256, data } = await hash_file(full);
        zip.file(rel, data);
        members.push({ path: rel, sizeBytes: size, sha256 });
    }

    const metadata_json = JSON.stringify(input.metadata, null, 2);
    zip.file('metadata.json', metadata_json);
    members.push({
        path: 'metadata.json',
        sizeBytes: Buffer.byteLength(metadata_json, 'utf8'),
        sha256: createHash('sha256').update(metadata_json, 'utf8').digest('hex'),
    });

    for (const nr of input.network_resources) {
        if (nr.path && !members.find((m) => m.path === nr.path)) {
            members.push(nr);
        }
    }

    const manifest = {
        formatVersion: 1,
        captureId: input.capture_id,
        warnings: input.warnings,
        members,
    };
    const manifest_json = JSON.stringify(manifest, null, 2);
    zip.file('manifest.json', manifest_json);

    const zip_buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });

    const max_bytes = get_snapshot_max_bytes();
    if (zip_buffer.length > max_bytes) {
        throw new Error('Snapshot archive exceeds maximum allowed size');
    }

    const tmp_path = get_snapshot_temp_archive_path(input.audit_id, input.capture_id);
    const final_path = get_snapshot_archive_path(input.audit_id, input.capture_id);
    await fs.writeFile(tmp_path, zip_buffer);
    await fs.rename(tmp_path, final_path);

    return {
        archive_path: final_path,
        size_bytes: zip_buffer.length,
        warning_count: input.warnings.length,
    };
}

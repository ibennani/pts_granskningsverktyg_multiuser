/**
 * @fileoverview Skapar utklippt skärmdump för återkommande block från sidrapport.
 */
import fs from 'fs/promises';
import JSZip from 'jszip';
import sharp from 'sharp';
import { get_snapshot_archive_path } from '../snapshots/audit_snapshot_storage.js';
import { open_snapshot_archive_entry } from '../snapshots/audit_snapshot_archive_read.js';
import { save_png_buffer_to_audit_media } from '../media/save_audit_media_png_buffer.js';
import {
    compute_device_crop_region,
    find_page_block_candidate,
    type PageBlockCandidateLike,
} from './recurring_block_screenshot_logic.js';
import type { RecurringBlockScreenshotBody } from '../schemas/recurring_block_screenshot.js';

type CreateRecurringBlockScreenshotInput = RecurringBlockScreenshotBody & {
    audit_id: string;
};

async function read_page_block_candidates(
    audit_id: string,
    capture_id: string
): Promise<PageBlockCandidateLike[]> {
    const archive_path = get_snapshot_archive_path(audit_id, capture_id);
    try {
        const buffer = await fs.readFile(archive_path);
        const zip = await JSZip.loadAsync(buffer);
        const entry = zip.file('analysis/phase1/page-blocks.json');
        if (!entry) return [];
        const envelope = JSON.parse(await entry.async('string')) as {
            data?: { candidates?: PageBlockCandidateLike[] };
        };
        return Array.isArray(envelope.data?.candidates) ? envelope.data.candidates : [];
    } catch {
        return [];
    }
}

async function read_snapshot_png_buffer(
    audit_id: string,
    capture_id: string
): Promise<Buffer | null> {
    const archive_path = get_snapshot_archive_path(audit_id, capture_id);
    const from_archive = await open_snapshot_archive_entry(archive_path, 'screenshot.png');
    return from_archive;
}

async function crop_block_png(
    png_buffer: Buffer,
    bbox: NonNullable<PageBlockCandidateLike['boundingBox']>
): Promise<Buffer | null> {
    const image = sharp(png_buffer);
    const metadata = await image.metadata();
    const image_width = metadata.width ?? 0;
    const image_height = metadata.height ?? 0;
    if (image_width < 1 || image_height < 1) return null;

    const region = compute_device_crop_region(bbox, image_width, image_height);
    if (!region) return null;

    return image.extract(region).png().toBuffer();
}

export async function create_recurring_block_screenshot(
    input: CreateRecurringBlockScreenshotInput
): Promise<{ filename: string | null; skipped: boolean; skipReason: string | null }> {
    const candidates = await read_page_block_candidates(input.audit_id, input.captureId);
    const match = find_page_block_candidate(candidates, {
        candidateType: input.candidateType,
        structureFingerprint: input.structureFingerprint,
        rootIdentity: input.rootIdentity,
    });

    if (!match?.boundingBox) {
        return { filename: null, skipped: true, skipReason: 'saknar-avgränsning' };
    }

    const source_png = await read_snapshot_png_buffer(input.audit_id, input.captureId);
    if (!source_png) {
        return { filename: null, skipped: true, skipReason: 'saknar-skärmdump' };
    }

    const cropped_png = await crop_block_png(source_png, match.boundingBox);
    if (!cropped_png) {
        return { filename: null, skipped: true, skipReason: 'utklipp-misslyckades' };
    }

    const saved = await save_png_buffer_to_audit_media(
        input.audit_id,
        cropped_png,
        input.label,
        'aterkommande'
    );

    return {
        filename: saved.filename,
        skipped: saved.skipped,
        skipReason: saved.filename ? null : 'sparning-misslyckades',
    };
}

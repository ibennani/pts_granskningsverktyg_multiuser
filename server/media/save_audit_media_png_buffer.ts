/**
 * @fileoverview Sparar PNG-buffer till granskningens media-mapp.
 */
import fs from 'fs/promises';
import path from 'path';
import { ensure_audit_media_dir, pick_upload_media_filename } from './audit_media_storage.js';
import { save_audit_media_original } from './audit_media_originals.js';
import { build_sample_screenshot_filename } from '../utils/sample_screenshot_filename.js';

export async function save_png_buffer_to_audit_media(
    audit_id: string,
    png_buffer: Buffer,
    page_title: string,
    filename_suffix?: string
): Promise<{ filename: string | null; skipped: boolean }> {
    const requested_filename = build_sample_screenshot_filename(page_title, filename_suffix ?? '');
    const pick = await pick_upload_media_filename(audit_id, requested_filename);
    const dir = await ensure_audit_media_dir(audit_id);
    const full_path = path.join(dir, pick.filename);
    await fs.writeFile(full_path, png_buffer);
    await save_audit_media_original(audit_id, pick.filename, full_path, pick.filename);
    return { filename: pick.filename, skipped: false };
}

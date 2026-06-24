/**
 * @fileoverview Samlar bildposter med PTS-exportfilnamn för bilaga 3 (skärmbilder).
 */

import { is_previewable_image_filename } from '../../shared/media/sanitize_media_filename.js';
import { build_export_media_filename_context } from './export_media_filename_context.js';
import {
    collect_html_export_zip_entries,
    flatten_html_export_zip_entries,
} from './export_html_media.js';
import type { ExportMediaFilenameContext } from './export_media_filename_context.js';

export type ScreenshotsAppendixEntry = {
    original_filename: string;
    export_filename: string;
};

/** Synkront: samlar previewable bilder med exportfilnamn (PTS eller rått om kontext saknas). */
export function collect_screenshots_appendix_entries_sync(
    audit: unknown,
    media_context: ExportMediaFilenameContext | null
): ScreenshotsAppendixEntry[] {
    const zip_entries = collect_html_export_zip_entries(audit, media_context);
    const flat_entries = flatten_html_export_zip_entries(zip_entries);
    return flat_entries
        .filter((entry) => is_previewable_image_filename(entry.original_filename))
        .map((entry) => ({
            original_filename: entry.original_filename,
            export_filename: entry.zip_path,
        }));
}

/** Asynkront: bygger PTS-kontext och returnerar alla bilagans bildposter. */
export async function collect_screenshots_appendix_entries(
    audit: Record<string, unknown>
): Promise<ScreenshotsAppendixEntry[]> {
    const media_context = await build_export_media_filename_context(audit);
    return collect_screenshots_appendix_entries_sync(audit, media_context);
}

/** True om granskningen har minst en förhandsvisningsbar bild för bilaga 3. */
export function has_screenshots_appendix_images(audit: unknown): boolean {
    return collect_screenshots_appendix_entries_sync(audit, null).length > 0;
}

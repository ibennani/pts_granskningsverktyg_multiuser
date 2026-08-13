/**
 * @fileoverview Läser enskilda filer från snapshot-zip-arkiv.
 */
import fs from 'fs/promises';
import JSZip from 'jszip';

/**
 * Hämtar en fil från snapshot-arkiv som buffer, eller null om den saknas.
 */
export async function open_snapshot_archive_entry(
    archive_path: string,
    entry_path: string
): Promise<Buffer | null> {
    const data = await fs.readFile(archive_path);
    const zip = await JSZip.loadAsync(data);
    const normalized = entry_path.replace(/\\/g, '/');
    const file = zip.file(normalized);
    if (!file) {
        return null;
    }
    return await file.async('nodebuffer');
}

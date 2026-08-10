/**
 * @fileoverview Enhetstester för lagring av originalbilder under orginalbilder/.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
    get_audit_media_original_index,
    remove_audit_media_original,
    remap_audit_media_original_index,
    resolve_audit_media_original_file_path,
    save_audit_media_original
} from '../../server/media/audit_media_originals.ts';

describe('audit_media_originals', () => {
    let temp_root = '';
    let audit_id = '';
    let previous_media_dir = '';

    beforeEach(async () => {
        temp_root = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-media-originals-'));
        audit_id = 'audit-originals-1';
        previous_media_dir = process.env.GV_AUDIT_MEDIA_DIR || '';
        process.env.GV_AUDIT_MEDIA_DIR = temp_root;
        await fs.mkdir(path.join(temp_root, audit_id), { recursive: true });
    });

    afterEach(async () => {
        process.env.GV_AUDIT_MEDIA_DIR = previous_media_dir;
        await fs.rm(temp_root, { recursive: true, force: true });
    });

    test('sparar original och indexerar mot kanonisk filnamn', async () => {
        const canonical_path = path.join(temp_root, audit_id, 'bild.png');
        await fs.writeFile(canonical_path, Buffer.from('jpeg-bytes'));

        const stored = await save_audit_media_original(
            audit_id,
            'bild.png',
            canonical_path,
            'bild.jpg'
        );

        expect(stored).toBe('bild.jpg');
        const index = await get_audit_media_original_index(audit_id);
        expect(index).toEqual({ 'bild.png': 'bild.jpg' });

        const original_path = await resolve_audit_media_original_file_path(audit_id, 'bild.png');
        expect(original_path).not.toBeNull();
        const bytes = await fs.readFile(original_path!);
        expect(bytes.toString()).toBe('jpeg-bytes');
    });

    test('remap uppdaterar index utan att byta originalfilnamn', async () => {
        const canonical_path = path.join(temp_root, audit_id, 'gammal.png');
        await fs.writeFile(canonical_path, Buffer.from('bytes'));
        await save_audit_media_original(audit_id, 'gammal.png', canonical_path, 'foto.jpg');

        await remap_audit_media_original_index(audit_id, 'gammal.png', 'ny.png');

        const index = await get_audit_media_original_index(audit_id);
        expect(index).toEqual({ 'ny.png': 'foto.jpg' });
        expect(await resolve_audit_media_original_file_path(audit_id, 'gammal.png')).toBeNull();
        expect(await resolve_audit_media_original_file_path(audit_id, 'ny.png')).not.toBeNull();
    });

    test('remove tar bort index och originalfil', async () => {
        const canonical_path = path.join(temp_root, audit_id, 'ta-bort.png');
        await fs.writeFile(canonical_path, Buffer.from('bytes'));
        await save_audit_media_original(audit_id, 'ta-bort.png', canonical_path, 'ta-bort.jpg');

        await remove_audit_media_original(audit_id, 'ta-bort.png');

        expect(await get_audit_media_original_index(audit_id)).toEqual({});
        const originals_dir = path.join(temp_root, audit_id, 'orginalbilder');
        await expect(fs.stat(path.join(originals_dir, 'ta-bort.jpg'))).rejects.toThrow();
    });
});

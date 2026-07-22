import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { ensure_audit_media_files_png } from '../../server/services/ensure_audit_media_png.js';

describe('ensure_audit_media_files_png', () => {
    let temp_root = '';
    let audit_id = '';
    let previous_media_dir = '';

    beforeEach(async () => {
        temp_root = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-media-png-'));
        audit_id = 'audit-test-1';
        previous_media_dir = process.env.GV_AUDIT_MEDIA_DIR || '';
        process.env.GV_AUDIT_MEDIA_DIR = temp_root;
        await fs.mkdir(path.join(temp_root, audit_id), { recursive: true });
    });

    afterEach(async () => {
        process.env.GV_AUDIT_MEDIA_DIR = previous_media_dir;
        await fs.rm(temp_root, { recursive: true, force: true });
    });

    test('konverterar gammal jpg-fil till png och returnerar migration', async () => {
        const jpg_path = path.join(temp_root, audit_id, 'foto.jpg');
        const jpeg_buffer = await sharp({
            create: {
                width: 4,
                height: 4,
                channels: 3,
                background: { r: 200, g: 20, b: 20 }
            }
        })
            .jpeg()
            .toBuffer();
        await fs.writeFile(jpg_path, jpeg_buffer);

        const result = await ensure_audit_media_files_png(audit_id);

        expect(result.migrations).toEqual([{ from: 'foto.jpg', to: 'foto.png' }]);
        expect(result.files.map((entry) => entry.filename)).toEqual(['foto.png']);
        const png_bytes = await fs.readFile(path.join(temp_root, audit_id, 'foto.png'));
        expect(png_bytes.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
        await expect(fs.stat(jpg_path)).rejects.toThrow();
    });

    test('lämnar videor oförändrade', async () => {
        const mp4_path = path.join(temp_root, audit_id, 'film.mp4');
        await fs.writeFile(mp4_path, Buffer.from([0x00, 0x00, 0x00, 0x18]));

        const result = await ensure_audit_media_files_png(audit_id);

        expect(result.migrations).toEqual([]);
        expect(result.files.map((entry) => entry.filename)).toEqual(['film.mp4']);
    });
});

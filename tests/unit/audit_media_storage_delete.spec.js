/**
 * @fileoverview Tester för fillagring av granskningsmedia på servern.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
    delete_audit_media_file,
    ensure_audit_media_dir,
    list_audit_media_files,
    pick_upload_media_filename
} from '../../server/media/audit_media_storage.js';

describe('audit_media_storage delete', () => {
    let temp_root = '';

    beforeEach(async () => {
        temp_root = await fs.mkdtemp(path.join(os.tmpdir(), 'gv-audit-media-'));
        process.env.GV_AUDIT_MEDIA_DIR = temp_root;
    });

    afterEach(async () => {
        delete process.env.GV_AUDIT_MEDIA_DIR;
        if (temp_root) {
            await fs.rm(temp_root, { recursive: true, force: true });
        }
    });

    test('delete_audit_media_file tar bort filen fysiskt', async () => {
        const audit_id = 'audit-1';
        const dir = await ensure_audit_media_dir(audit_id);
        const file_path = path.join(dir, 'bild.png');
        await fs.writeFile(file_path, 'test');

        await delete_audit_media_file(audit_id, 'bild.png');

        await expect(fs.stat(file_path)).rejects.toMatchObject({ code: 'ENOENT' });
        const listed = await list_audit_media_files(audit_id);
        expect(listed).toEqual([]);
    });

    test('pick_upload_media_filename ger suffix vid kollision', async () => {
        const audit_id = 'audit-2';
        const dir = await ensure_audit_media_dir(audit_id);
        await fs.writeFile(path.join(dir, 'bild.png'), 'existing');

        const pick = await pick_upload_media_filename(audit_id, 'bild.png');

        expect(pick.filename).toBe('bild (2).png');
        expect(pick.renamed_due_to_conflict).toBe(true);
        expect(pick.requested_filename).toBe('bild.png');
    });
});

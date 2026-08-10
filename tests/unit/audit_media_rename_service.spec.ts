/**
 * @fileoverview Enhetstester för omdöpning av mediefiler på servern.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execute_audit_media_rename } from '../../server/media/audit_media_rename_service.ts';
import {
    get_audit_media_original_index,
    save_audit_media_original
} from '../../server/media/audit_media_originals.ts';

describe('execute_audit_media_rename', () => {
    let temp_root = '';
    let previous_media_dir = process.env.GV_AUDIT_MEDIA_DIR;

    beforeEach(async () => {
        temp_root = await fs.mkdtemp(path.join(os.tmpdir(), 'gv-media-rename-'));
        process.env.GV_AUDIT_MEDIA_DIR = temp_root;
    });

    afterEach(async () => {
        process.env.GV_AUDIT_MEDIA_DIR = previous_media_dir;
        await fs.rm(temp_root, { recursive: true, force: true });
    });

    test('byter namn när källfilen finns på disk', async () => {
        const audit_id = 'audit-rename-ok';
        const dir = path.join(temp_root, audit_id);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, 'gammal.png'), Buffer.from('png'));
        await save_audit_media_original(audit_id, 'gammal.png', path.join(dir, 'gammal.png'), 'foto.jpg');

        const outcome = await execute_audit_media_rename(audit_id, 'gammal.png', 'ny.png');

        expect(outcome.ok).toBe(true);
        if (outcome.ok) {
            expect(outcome.result.filename).toBe('ny.png');
        }
        await expect(fs.stat(path.join(dir, 'ny.png'))).resolves.toBeDefined();
        expect(await get_audit_media_original_index(audit_id)).toEqual({ 'ny.png': 'foto.jpg' });
    });

    test('byter namn på video utan png-normalisering', async () => {
        const audit_id = 'audit-rename-video';
        const dir = path.join(temp_root, audit_id);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, 'gammal.mp4'), Buffer.from('mp4'));

        const outcome = await execute_audit_media_rename(audit_id, 'gammal.mp4', 'ny.mp4');

        expect(outcome.ok).toBe(true);
        if (outcome.ok) {
            expect(outcome.result.filename).toBe('ny.mp4');
        }
        await expect(fs.stat(path.join(dir, 'ny.mp4'))).resolves.toBeDefined();
    });

    test('returnerar detaljerat 404 när källfil saknas', async () => {
        const audit_id = 'audit-rename-miss';
        const dir = path.join(temp_root, audit_id);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, 'kvar.png'), Buffer.from('png'));

        const outcome = await execute_audit_media_rename(audit_id, 'saknas.png', 'ny.png');

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) {
            expect(outcome.failure.status).toBe(404);
            expect(outcome.failure.error).toBe('Filen hittades inte');
            expect(outcome.failure.detail).toContain('saknas.png');
            expect(outcome.failure.detail).toContain(audit_id);
        }
    });
});

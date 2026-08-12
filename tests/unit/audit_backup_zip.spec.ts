/**
 * @fileoverview Enhetstester för gransknings-säkerhetskopia (manifest, ZIP, import).
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import JSZip from 'jszip';
import {
    AUDIT_BACKUP_JSON_ENTRY,
    AUDIT_BACKUP_MANIFEST_ENTRY,
    AUDIT_BACKUP_MEDIA_DIR,
} from '../../shared/audit_backup/audit_backup_constants.ts';
import { is_safe_zip_entry_path } from '../../shared/audit_backup/audit_backup_zip_safety.ts';
import { AuditBackupManifestSchema } from '../../shared/audit_backup/audit_backup_manifest_schema.ts';
import { audit_backup_download_filename } from '../../shared/audit_backup/audit_backup_filename.ts';
import { parse_audit_backup_zip, is_probably_zip_file } from '../../js/logic/audit_backup_zip_import.ts';

describe('audit_backup_zip_safety', () => {
    test('accepterar relativa sökvägar under media', () => {
        expect(is_safe_zip_entry_path('media/bild.png')).toBe(true);
    });

    test('avvisar zip-slip', () => {
        expect(is_safe_zip_entry_path('../secret.txt')).toBe(false);
        expect(is_safe_zip_entry_path('media/../../etc/passwd')).toBe(false);
    });
});

describe('audit_backup_download_filename', () => {
    test('byter .json till .zip', () => {
        expect(audit_backup_download_filename('granskning_aktör_20260101_120000.json')).toBe(
            'granskning_aktör_20260101_120000.zip'
        );
    });
});

describe('parse_audit_backup_zip', () => {
    async function build_sample_zip(options: { with_manifest?: boolean; with_image?: boolean } = {}) {
        const zip = new JSZip();
        const audit_json = { auditStatus: 'in_progress', samples: [], auditMetadata: { actorName: 'Test' } };
        const manifest = {
            formatVersion: 1,
            createdAt: '2026-01-01T12:00:00.000Z',
            auditJsonEntry: AUDIT_BACKUP_JSON_ENTRY,
            mediaDir: AUDIT_BACKUP_MEDIA_DIR,
            referencedMedia: [{ filename: 'bild.png', path: 'media/bild.png' }],
            includedMedia: options.with_image ? [{ filename: 'bild.png', path: 'media/bild.png' }] : [],
            missingMedia: options.with_image ? [] : ['bild.png'],
        };

        if (options.with_manifest !== false) {
            zip.file(AUDIT_BACKUP_MANIFEST_ENTRY, JSON.stringify(manifest, null, 2));
        }
        zip.file(AUDIT_BACKUP_JSON_ENTRY, JSON.stringify(audit_json, null, 2));
        if (options.with_image) {
            zip.file('media/bild.png', new Uint8Array([137, 80, 78, 71]));
        }
        return zip.generateAsync({ type: 'arraybuffer' });
    }

    test('läser manifest, json och media', async () => {
        const buffer = await build_sample_zip({ with_image: true });
        const parsed = await parse_audit_backup_zip(buffer);
        expect(parsed.used_manifest).toBe(true);
        expect(parsed.audit_json).toMatchObject({ auditStatus: 'in_progress' });
        expect(parsed.media_files).toHaveLength(1);
        expect(parsed.media_files[0].filename).toBe('bild.png');
        expect(parsed.missing_media).toEqual([]);
    });

    test('fallback utan manifest läser granskning.json', async () => {
        const buffer = await build_sample_zip({ with_manifest: false, with_image: false });
        const parsed = await parse_audit_backup_zip(buffer);
        expect(parsed.used_manifest).toBe(false);
        expect(parsed.audit_json).toMatchObject({ auditMetadata: { actorName: 'Test' } });
    });

    test('manifest valideras med schema', () => {
        const result = AuditBackupManifestSchema.safeParse({
            formatVersion: 1,
            createdAt: '2026-01-01T12:00:00.000Z',
            auditJsonEntry: AUDIT_BACKUP_JSON_ENTRY,
            mediaDir: AUDIT_BACKUP_MEDIA_DIR,
            referencedMedia: [],
            includedMedia: [],
            missingMedia: [],
        });
        expect(result.success).toBe(true);
    });
});

describe('is_probably_zip_file', () => {
    test('känner igen zip på filändelse', () => {
        const file = { name: 'backup.zip', type: '' };
        expect(is_probably_zip_file(file)).toBe(true);
    });
});

import { describe, test, expect } from '@jest/globals';
import JSZip from 'jszip';
import {
    append_snapshot_archive_to_zip,
    build_snapshot_export_folder_name,
    build_snapshots_download_all_index,
    is_safe_zip_entry_path,
} from '../../server/snapshots/audit_snapshots_download_all_bundle.ts';

describe('audit_snapshots_download_all_bundle', () => {
    test('build_snapshot_export_folder_name inkluderar granskningsdel och id', () => {
        expect(
            build_snapshot_export_folder_name('sample-uuid-1', 'Startsida')
        ).toBe('Startsida__sample-uuid-1');
    });

    test('is_safe_zip_entry_path blockerar path traversal', () => {
        expect(is_safe_zip_entry_path('manifest.json')).toBe(true);
        expect(is_safe_zip_entry_path('../secret.txt')).toBe(false);
        expect(is_safe_zip_entry_path('resources/../../etc/passwd')).toBe(false);
    });

    test('append_snapshot_archive_to_zip packar upp innehåll utan nästlade zip-filer', async () => {
        const inner = new JSZip();
        inner.file('manifest.json', '{"formatVersion":1}');
        inner.file('screenshot.png', Buffer.from('png'));
        const inner_buffer = await inner.generateAsync({ type: 'nodebuffer' });

        const outer = new JSZip();
        const files = await append_snapshot_archive_to_zip(
            outer,
            inner_buffer,
            'snapshots/Startsida__sample-1'
        );

        expect(files).toEqual([
            'snapshots/Startsida__sample-1/manifest.json',
            'snapshots/Startsida__sample-1/screenshot.png',
        ]);
        expect(Object.keys(outer.files).some((name) => name.endsWith('.zip'))).toBe(false);

        const outer_buffer = await outer.generateAsync({ type: 'nodebuffer' });
        const loaded = await JSZip.loadAsync(outer_buffer);
        const manifest = await loaded
            .file('snapshots/Startsida__sample-1/manifest.json')!
            .async('string');
        expect(manifest).toContain('formatVersion');
    });

    test('build_snapshots_download_all_index har formatVersion 2', () => {
        const index = build_snapshots_download_all_index('audit-1', [
            {
                folder: 'snapshots/Startsida__s1',
                snapshotId: 'snap-1',
                sampleId: 's1',
                description: 'Startsida',
                url: 'https://example.com',
                capturedAt: '2026-08-12T09:00:00.000Z',
                included: true,
                files: ['snapshots/Startsida__s1/manifest.json'],
            },
        ]);

        expect(index.formatVersion).toBe(2);
        expect(index.auditId).toBe('audit-1');
        expect(index.snapshots[0].folder).toBe('snapshots/Startsida__s1');
    });
});

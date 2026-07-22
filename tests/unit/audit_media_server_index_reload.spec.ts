/**
 * @fileoverview Enhetstester för omladdning av serverindex vid omdöpning.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mocked_list_audit_media = jest.fn();

jest.unstable_mockModule('../../js/api/audit_media_api.js', () => ({
    list_audit_media: mocked_list_audit_media
}));

const { create_audit_media_server_index } = await import('../../js/logic/audit_media_server_index.ts');

describe('create_audit_media_server_index reload', () => {
    beforeEach(() => {
        mocked_list_audit_media.mockReset();
    });

    it('ersätter borttagna filer vid reload i stället för att behålla cache', async () => {
        mocked_list_audit_media
            .mockResolvedValueOnce({
                files: [{ filename: 'kvar.png', size: 1, mime: 'image/png' }],
                filename_migrations: []
            })
            .mockResolvedValueOnce({
                files: [{ filename: 'kvar.png', size: 1, mime: 'image/png' }],
                filename_migrations: []
            });

        const index = create_audit_media_server_index('audit-1');
        await index.ensure_loaded();
        index.mark_on_server('borttagen.png');

        expect(index.get_server_filenames()?.has('borttagen.png')).toBe(true);

        await index.reload();

        expect(index.get_server_filenames()?.has('borttagen.png')).toBe(false);
        expect(index.get_server_filenames()?.has('kvar.png')).toBe(true);
    });

    it('löser omdöpningskälla efter migrering', async () => {
        mocked_list_audit_media.mockResolvedValue({
            files: [{ filename: 'bild.png', size: 1, mime: 'image/png' }],
            filename_migrations: [{ from: 'bild.jpg', to: 'bild.png' }]
        });

        const index = create_audit_media_server_index('audit-1');
        await index.reload();

        expect(index.resolve_rename_source_filename('bild.jpg')).toBe('bild.png');
        expect(index.resolve_rename_source_filename('saknas.png')).toBeNull();
    });
});

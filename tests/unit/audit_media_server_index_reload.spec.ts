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

        const reload_result = await index.reload();

        expect(reload_result.ok).toBe(true);
        expect(index.get_server_filenames()?.has('borttagen.png')).toBe(false);
        expect(index.get_server_filenames()?.has('kvar.png')).toBe(true);
    });

    it('rapporterar misslyckad reload och rensar serverindex', async () => {
        mocked_list_audit_media
            .mockResolvedValueOnce({
                files: [{ filename: 'kvar.png', size: 1, mime: 'image/png' }],
                filename_migrations: []
            })
            .mockRejectedValueOnce(new Error('nätverksfel'));

        const index = create_audit_media_server_index('audit-1');
        await index.ensure_loaded();

        const reload_result = await index.reload();

        expect(reload_result.ok).toBe(false);
        expect(index.get_server_filenames()?.size).toBe(0);
    });

    it('löser omdöpningskälla efter migrering', async () => {
        mocked_list_audit_media.mockResolvedValue({
            files: [{ filename: 'bild.png', size: 1, mime: 'image/png' }],
            filename_migrations: [{ from: 'bild.jpg', to: 'bild.png' }]
        });

        const index = create_audit_media_server_index('audit-1');
        const reload_result = await index.reload();

        expect(reload_result.ok).toBe(true);
        expect(index.resolve_rename_source_filename('bild.jpg')).toBe('bild.png');
        expect(index.resolve_rename_source_filename('saknas.png')).toBeNull();
    });

    it('ignorerar föråldrad load när reload startar under pågående ensure_loaded', async () => {
        let resolve_first: ((value: unknown) => void) | null = null;
        const first_promise = new Promise((resolve) => {
            resolve_first = resolve;
        });

        mocked_list_audit_media
            .mockReturnValueOnce(first_promise as Promise<never>)
            .mockResolvedValueOnce({
                files: [{ filename: 'cookiebanner_oversikt.png', size: 1, mime: 'image/png' }],
                filename_migrations: []
            });

        const index = create_audit_media_server_index('audit-1');
        void index.ensure_loaded();
        const reload_result = await index.reload();

        expect(reload_result.ok).toBe(true);
        expect(index.resolve_rename_source_filename('cookiebanner_oversikt.png')).toBe(
            'cookiebanner_oversikt.png'
        );

        resolve_first?.({
            files: [{ filename: 'gammal.png', size: 1, mime: 'image/png' }],
            filename_migrations: []
        });
        await first_promise;

        expect(index.resolve_rename_source_filename('cookiebanner_oversikt.png')).toBe(
            'cookiebanner_oversikt.png'
        );
    });
});

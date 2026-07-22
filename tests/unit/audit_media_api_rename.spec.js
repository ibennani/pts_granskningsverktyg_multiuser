/**
 * @fileoverview Enhetstester för omdöpning av granskningsmedia via API-klienten.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { get_audit_media_rename_url, rename_audit_media } from '../../js/api/audit_media_api.js';

describe('rename_audit_media', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
        sessionStorage.clear();
        sessionStorage.setItem('auth_token', 'test-token');
    });

    test('lyckas när servern svarar med nytt filnamn', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ filename: 'ny.png' })
        });

        await expect(rename_audit_media('audit-1', 'gammal.png', 'ny.png')).resolves.toEqual({
            filename: 'ny.png'
        });

        expect(fetch).toHaveBeenCalledWith(
            get_audit_media_rename_url('audit-1'),
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({ fromFilename: 'gammal.png', newFilename: 'ny.png' })
            })
        );
    });

    test('returnerar konfliktinformation från servern', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                filename: 'bild (2).png',
                renamedDueToConflict: true,
                requestedFilename: 'bild.png'
            })
        });

        await expect(rename_audit_media('audit-1', 'annan.png', 'bild.png')).resolves.toEqual({
            filename: 'bild (2).png',
            renamedDueToConflict: true,
            requestedFilename: 'bild.png'
        });
    });

    test('kastar vid valideringsfel', async () => {
        fetch.mockResolvedValue({
            ok: false,
            status: 400,
            headers: { get: () => 'application/json' },
            json: async () => ({ error: 'Filtypen stöds inte' })
        });

        await expect(rename_audit_media('audit-1', 'bild.png', 'dok.pdf')).rejects.toThrow(
            'Filtypen stöds inte'
        );
    });

    test('mappar 404 utan JSON-kropp till Filen hittades inte', async () => {
        fetch.mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            headers: { get: () => 'text/html' },
            text: async () => '<html>Not Found</html>'
        });

        await expect(rename_audit_media('audit-1', 'bild.png', 'ny.png')).rejects.toThrow(
            'Filen hittades inte'
        );
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('kastar vid JSON 404 utan PATCH-fallback', async () => {
        fetch.mockResolvedValue({
            ok: false,
            status: 404,
            headers: { get: () => 'application/json' },
            json: async () => ({
                error: 'Filen hittades inte',
                detail: 'Sökte efter «saknas.png» bland 0 filer i granskning audit-1.'
            })
        });

        await expect(rename_audit_media('audit-1', 'saknas.png', 'ny.png')).rejects.toThrow(
            'Sökte efter «saknas.png»'
        );
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('försöker PATCH när POST /media/rename saknas på servern', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: { get: () => 'text/html' },
                text: async () => '<html>Not Found</html>'
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ filename: 'ny.png' })
            });

        await expect(rename_audit_media('audit-1', 'bild.png', 'ny.png')).resolves.toEqual({
            filename: 'ny.png'
        });

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({
                method: 'POST'
            })
        );
        expect(fetch.mock.calls[1]?.[1]).toEqual(
            expect.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ newFilename: 'ny.png' })
            })
        );
    });
});

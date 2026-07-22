/**
 * @fileoverview Enhetstester för PATCH-omdöpning av granskningsmedia via API-klienten.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { get_audit_media_url, rename_audit_media } from '../../js/api/audit_media_api.js';

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
            get_audit_media_url('audit-1', 'gammal.png'),
            expect.objectContaining({
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({ newFilename: 'ny.png' })
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

    test('kastar vid fel', async () => {
        fetch.mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: 'Filtypen stöds inte' })
        });

        await expect(rename_audit_media('audit-1', 'bild.png', 'dok.pdf')).rejects.toThrow(
            'Filtypen stöds inte'
        );
    });
});

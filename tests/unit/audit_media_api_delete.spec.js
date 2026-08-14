/**
 * @fileoverview Enhetstester för DELETE av granskningsmedia via API-klienten.
 */

import { app_session_storage } from '../helpers/scoped_session_storage.ts';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { delete_audit_media, get_audit_media_url } from '../../js/api/audit_media_api.js';

describe('delete_audit_media', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
        sessionStorage.clear();
        app_session_storage.setItem('auth_token', 'test-token');
    });

    test('lyckas när servern svarar 204', async () => {
        fetch.mockResolvedValue({ ok: true, status: 204 });

        await expect(delete_audit_media('audit-1', 'bild.png')).resolves.toBeUndefined();

        expect(fetch).toHaveBeenCalledWith(
            get_audit_media_url('audit-1', 'bild.png'),
            expect.objectContaining({ method: 'DELETE' })
        );
    });

    test('lyckas när filen saknas på servern (404)', async () => {
        fetch.mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({ error: 'Filen hittades inte' })
        });

        await expect(delete_audit_media('audit-1', 'utfälld_meny.png')).resolves.toBeUndefined();
    });

    test('kastar vid andra fel', async () => {
        fetch.mockResolvedValue({
            ok: false,
            status: 500,
            headers: { get: () => 'application/json' },
            json: async () => ({ error: 'Kunde inte ta bort fil' })
        });

        await expect(delete_audit_media('audit-1', 'bild.png')).rejects.toThrow('Kunde inte ta bort fil');
    });
});

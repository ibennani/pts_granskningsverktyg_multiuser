/**
 * @fileoverview Verifierar att blob-URL:er kan flyttas vid server-omdöpning utan att ogiltigförklaras.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
    get_audit_media_cached_blob_url,
    move_audit_media_local_preview_blob_url,
    revoke_audit_media_blob_urls,
    set_audit_media_local_preview_blob_url
} from '../../js/components/media/render_audit_media_list_item.ts';

describe('move_audit_media_local_preview_blob_url', () => {
    const audit_id = 'audit-test-1';
    const local_name = 'bild.png';
    const server_name = 'bild (2).png';
    const blob_url = 'blob:http://localhost/test-preview-1';

    /** @type {typeof URL.createObjectURL | undefined} */
    let saved_url_create;
    /** @type {typeof URL.revokeObjectURL | undefined} */
    let saved_url_revoke;

    beforeEach(() => {
        saved_url_create = global.URL.createObjectURL;
        saved_url_revoke = global.URL.revokeObjectURL;
        global.URL.createObjectURL = jest.fn(() => blob_url);
        global.URL.revokeObjectURL = jest.fn();
        revoke_audit_media_blob_urls(audit_id);
    });

    afterEach(() => {
        revoke_audit_media_blob_urls(audit_id);
        if (saved_url_create) global.URL.createObjectURL = saved_url_create;
        if (saved_url_revoke) global.URL.revokeObjectURL = saved_url_revoke;
    });

    it('flyttar cachad blob-URL till nytt filnamn utan revoke', () => {
        set_audit_media_local_preview_blob_url(audit_id, local_name, blob_url);

        move_audit_media_local_preview_blob_url(audit_id, local_name, server_name);

        expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
        expect(get_audit_media_cached_blob_url(audit_id, local_name)).toBeUndefined();
        expect(get_audit_media_cached_blob_url(audit_id, server_name)).toBe(blob_url);
    });

    it('revoke före återanvändning ogiltigförklarar blob-URL (regression)', () => {
        set_audit_media_local_preview_blob_url(audit_id, local_name, blob_url);
        revoke_audit_media_blob_urls(audit_id);
        set_audit_media_local_preview_blob_url(audit_id, server_name, blob_url);

        expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(blob_url);
        expect(get_audit_media_cached_blob_url(audit_id, server_name)).toBe(blob_url);
    });
});

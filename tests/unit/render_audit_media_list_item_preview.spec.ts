/**
 * @fileoverview Preview visas bara när fil finns på servern eller som lokal blob.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
    is_media_available_for_preview,
    set_audit_media_local_preview_blob_url,
    revoke_audit_media_blob_urls
} from '../../js/components/media/render_audit_media_list_item.ts';
import { is_media_file_on_server } from '../../js/logic/audit_media_server_index.ts';

describe('is_media_file_on_server', () => {
    it('returnerar false för äldre filnamnsreferens utan serverfil', () => {
        expect(is_media_file_on_server('legacy.png', new Set())).toBe(false);
    });

    it('returnerar true när filnamnet finns på servern', () => {
        expect(is_media_file_on_server('bild.png', new Set(['bild.png']))).toBe(true);
    });
});

describe('is_media_available_for_preview', () => {
    const audit_id = 'audit-preview-test';

    /** @type {typeof URL.revokeObjectURL | undefined} */
    let saved_url_revoke;

    beforeEach(() => {
        saved_url_revoke = global.URL.revokeObjectURL;
        global.URL.revokeObjectURL = jest.fn();
        revoke_audit_media_blob_urls(audit_id);
    });

    afterEach(() => {
        revoke_audit_media_blob_urls(audit_id);
        if (saved_url_revoke) global.URL.revokeObjectURL = saved_url_revoke;
    });

    it('returnerar false för filnamnsreferens utan serverfil', () => {
        expect(is_media_available_for_preview(audit_id, 'legacy.png', new Set())).toBe(false);
    });

    it('returnerar true när serverfil finns', () => {
        expect(is_media_available_for_preview(audit_id, 'bild.png', new Set(['bild.png']))).toBe(true);
    });

    it('returnerar true för lokal blob under uppladdning även utan serverfil', () => {
        set_audit_media_local_preview_blob_url(audit_id, 'pending.png', 'blob:http://localhost/pending');
        expect(is_media_available_for_preview(audit_id, 'pending.png', new Set())).toBe(true);
    });

    it('returnerar false innan serverindex laddats', () => {
        expect(is_media_available_for_preview(audit_id, 'bild.png', null)).toBe(false);
    });
});

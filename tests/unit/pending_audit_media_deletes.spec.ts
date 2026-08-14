/**
 * @fileoverview Enhetstester för kö av uppskjuten media-DELETE.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { scope_storage_key } from '../helpers/scoped_session_storage.ts';

jest.unstable_mockModule('../../js/api/audit_media_api.js', () => ({
    delete_audit_media: jest.fn()
}));

jest.unstable_mockModule('../../js/utils/browser_online.js', () => ({
    is_browser_online: () => true
}));

jest.unstable_mockModule('../../js/components/media/render_audit_media_list_item.js', () => ({
    revoke_audit_media_blob_url: jest.fn()
}));

const { delete_audit_media } = await import('../../js/api/audit_media_api.js');
const {
    enqueue_pending_media_deletes,
    flush_pending_media_deletes_for_audit
} = await import('../../js/sync/pending_audit_media_deletes.js');

const STORAGE_KEY = 'gv_pending_audit_media_deletes';

describe('pending_audit_media_deletes', () => {
    beforeEach(() => {
        sessionStorage.clear();
        jest.mocked(delete_audit_media).mockReset();
        jest.mocked(delete_audit_media).mockResolvedValue(undefined);
    });

    test('enqueue_pending_media_deletes sparar unika filnamn per granskning', () => {
        enqueue_pending_media_deletes('audit-1', ['a.png', 'b.jpg']);
        enqueue_pending_media_deletes('audit-1', ['a.png', 'c.gif']);

        const raw = sessionStorage.getItem(scope_storage_key(STORAGE_KEY));
        expect(raw).toBeTruthy();
        const map = JSON.parse(raw!);
        expect(map['audit-1'].sort()).toEqual(['a.png', 'b.jpg', 'c.gif']);
    });

    test('flush_pending_media_deletes_for_audit raderar endast filer utan referens', async () => {
        enqueue_pending_media_deletes('audit-2', ['gone.png', 'kept.jpg']);

        await flush_pending_media_deletes_for_audit('audit-2', () => new Set(['kept.jpg']));

        expect(delete_audit_media).toHaveBeenCalledTimes(1);
        expect(delete_audit_media).toHaveBeenCalledWith('audit-2', 'gone.png');

        const map_after = JSON.parse(sessionStorage.getItem(scope_storage_key(STORAGE_KEY)) || '{}');
        expect(map_after['audit-2']).toEqual(['kept.jpg']);
    });
});

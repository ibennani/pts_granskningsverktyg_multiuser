/**
 * Tester för sync_broadcast.js
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const post_message = jest.fn();
const close = jest.fn();

class MockBroadcastChannel {
    constructor(name) {
        this.name = name;
    }

    postMessage(data) {
        post_message(data);
    }

    close() {
        close();
    }
}

describe('sync_broadcast', () => {
    beforeEach(() => {
        post_message.mockClear();
        close.mockClear();
        global.BroadcastChannel = MockBroadcastChannel;
        sessionStorage.clear();
    });

    test('broadcast_audit_updated skickar originId från samma flik', async () => {
        const { broadcast_audit_updated } = await import('../../js/sync/sync_broadcast.js');
        const { get_tab_origin_id } = await import('../../js/utils/tab_origin_id.js');

        broadcast_audit_updated('audit-42');

        expect(post_message).toHaveBeenCalledWith({
            type: 'audit-updated',
            auditId: 'audit-42',
            originId: get_tab_origin_id()
        });
        expect(close).toHaveBeenCalled();
    });
});

/**
 * @fileoverview Enhetstester för WebSocket-push av enskild granskning (audits:changed med auditId).
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const client_path = path.join(spec_dir, '../../js/api/client.js');

jest.unstable_mockModule(client_path, () => ({
    get_websocket_url: jest.fn(() => 'ws://localhost/ws')
}));

const ws_instances = [];

class MockWebSocket {
    static OPEN = 1;
    readyState = MockWebSocket.OPEN;
    onmessage = null;
    onopen = null;
    onclose = null;
    onerror = null;

    constructor() {
        ws_instances.push(this);
        queueMicrotask(() => {
            if (typeof this.onopen === 'function') this.onopen();
        });
    }

    close() {
        this.readyState = 3;
    }

    send() {}
}

describe('list_push_service subscribe_audit_updates', () => {
    beforeEach(async () => {
        ws_instances.length = 0;
        global.WebSocket = MockWebSocket;
        jest.resetModules();
    });

    test('audits:changed med auditId triggar audit-update-callback', async () => {
        const { subscribe_audit_updates } = await import('../../js/logic/list_push_service.js');
        const callback = jest.fn();
        const unsubscribe = subscribe_audit_updates(callback);

        const ws = ws_instances[ws_instances.length - 1];
        expect(ws).toBeTruthy();

        ws.onmessage({
            data: JSON.stringify({
                type: 'audits:changed',
                auditId: 'audit-42',
                version: 7,
                changeKind: 'full'
            })
        });

        expect(callback).toHaveBeenCalledWith({
            auditId: 'audit-42',
            version: 7,
            changeKind: 'full'
        });

        unsubscribe();
    });

    test('audit:snapshots_changed triggar snapshot-callback', async () => {
        const { subscribe_audit_snapshots } = await import('../../js/logic/list_push_service.js');
        const callback = jest.fn();
        const unsubscribe = subscribe_audit_snapshots(callback);

        const ws = ws_instances[ws_instances.length - 1];
        expect(ws).toBeTruthy();

        ws.onmessage({
            data: JSON.stringify({
                type: 'audit:snapshots_changed',
                auditId: 'audit-99',
                snapshotId: 'snap-1',
                sampleId: 'sample-1',
                status: 'ready',
            }),
        });

        expect(callback).toHaveBeenCalledWith({
            auditId: 'audit-99',
            snapshotId: 'snap-1',
            sampleId: 'sample-1',
            status: 'ready',
        });

        unsubscribe();
    });
});

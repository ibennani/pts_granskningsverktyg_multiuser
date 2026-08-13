/**
 * @fileoverview Enhetstester för väntan på klar sidrapport.
 */
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const snapshot_api_path = path.join(spec_dir, '../../js/api/audit_snapshot_api.js');
const list_push_path = path.join(spec_dir, '../../js/logic/list_push_service.js');

const list_mock = jest.fn<() => Promise<{ items: unknown[] }>>();
const subscribe_mock = jest.fn(() => () => {});

jest.unstable_mockModule(snapshot_api_path, () => ({
    list_audit_snapshots: list_mock,
}));

jest.unstable_mockModule(list_push_path, () => ({
    subscribe_audit_snapshots: subscribe_mock,
}));

const { wait_for_audit_snapshot_ready } = await import('../../js/logic/wait_for_audit_snapshot_ready.ts');

describe('wait_for_audit_snapshot_ready', () => {
    beforeEach(() => {
        list_mock.mockReset();
        subscribe_mock.mockReset();
        subscribe_mock.mockImplementation(() => () => {});
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('löser true när poll hittar ready', async () => {
        list_mock.mockResolvedValue({
            items: [
                {
                    sampleId: 'sample-1',
                    currentReady: { snapshotId: 'capture-1', status: 'ready' },
                    pendingAttempt: null,
                },
            ],
        });

        const promise = wait_for_audit_snapshot_ready('audit-1', 'capture-1', 30_000, 1000);
        await jest.advanceTimersByTimeAsync(0);
        await expect(promise).resolves.toBe(true);
    });

    test('löser false vid timeout om sidrapporten inte blir klar', async () => {
        list_mock.mockResolvedValue({
            items: [
                {
                    sampleId: 'sample-1',
                    currentReady: null,
                    pendingAttempt: { snapshotId: 'capture-1', status: 'capturing' },
                },
            ],
        });

        const promise = wait_for_audit_snapshot_ready('audit-1', 'capture-1', 5000, 1000);
        await jest.advanceTimersByTimeAsync(6000);
        await expect(promise).resolves.toBe(false);
    });
});

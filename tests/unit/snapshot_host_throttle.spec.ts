import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    normalize_snapshot_capture_hostname,
    acquire_snapshot_host_slot,
    reset_snapshot_host_throttle_for_tests,
} from '../../server/snapshots/snapshot_host_throttle.ts';

describe('snapshot_host_throttle', () => {
    beforeEach(() => {
        reset_snapshot_host_throttle_for_tests();
        delete process.env.GV_SNAPSHOT_HOST_COOLDOWN_MS;
        delete process.env.GV_SNAPSHOT_HOST_MAX_CONCURRENCY;
    });

    test('normalize_snapshot_capture_hostname returnerar hostname', () => {
        expect(normalize_snapshot_capture_hostname('https://www.Apohem.se/sida')).toBe('www.apohem.se');
    });

    test('acquire_snapshot_host_slot tillåter sekventiella besök utan cooldown', async () => {
        process.env.GV_SNAPSHOT_HOST_COOLDOWN_MS = '0';
        const first = await acquire_snapshot_host_slot('https://example.com/a');
        first.release();
        const second = await acquire_snapshot_host_slot('https://example.com/b');
        second.release();
    });
});

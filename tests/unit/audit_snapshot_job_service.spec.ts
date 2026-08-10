import { describe, test, expect } from '@jest/globals';
import { Semaphore } from '../../server/snapshots/semaphore.ts';
import {
    is_blocked_network_header,
    sanitize_response_headers,
} from '../../server/snapshots/network_redaction.ts';

describe('audit_snapshot_job_service helpers', () => {
    test('Semaphore begränsar parallella slots', async () => {
        const sem = new Semaphore(1);
        let active = 0;
        let max_active = 0;

        const run = async () => {
            await sem.acquire();
            active += 1;
            max_active = Math.max(max_active, active);
            await new Promise((resolve) => setTimeout(resolve, 10));
            active -= 1;
            sem.release();
        };

        await Promise.all([run(), run()]);
        expect(max_active).toBe(1);
    });
});

describe('snapshot cancellation state', () => {
    test('is_blocked_network_header används i snapshot-metadata', () => {
        expect(is_blocked_network_header('authorization')).toBe(true);
        expect(sanitize_response_headers({ Accept: 'text/html' })).toEqual({ Accept: 'text/html' });
    });
});

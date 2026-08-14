import { describe, test, expect } from '@jest/globals';
import { pick_fair_queue_job } from '../../server/services/snapshot_fair_queue_pick.ts';

describe('pick_fair_queue_job', () => {
    test('hoppar över granskning som redan har aktiv capture', () => {
        const queue = [
            { audit_id: 'audit-a', id: 'job-1' },
            { audit_id: 'audit-b', id: 'job-2' },
        ];
        const picked = pick_fair_queue_job({
            queue,
            active_audit_ids: new Set(['audit-a']),
            last_served_audit_id: null,
        });
        expect(picked.job?.id).toBe('job-2');
        expect(queue.length).toBe(1);
    });

    test('round-robin mellan granskningar i kön', () => {
        const queue = [
            { audit_id: 'audit-a', id: 'job-1' },
            { audit_id: 'audit-b', id: 'job-2' },
            { audit_id: 'audit-a', id: 'job-3' },
        ];
        const first = pick_fair_queue_job({
            queue,
            active_audit_ids: new Set(),
            last_served_audit_id: null,
        });
        expect(first.job?.audit_id).toBe('audit-a');

        const second = pick_fair_queue_job({
            queue,
            active_audit_ids: new Set(),
            last_served_audit_id: first.last_served_audit_id,
        });
        expect(second.job?.audit_id).toBe('audit-b');
    });
});

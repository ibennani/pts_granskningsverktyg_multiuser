/**
 * @fileoverview Väntar på klar sidrapport via push och API-pollning som reserv.
 */
import { list_audit_snapshots } from '../api/audit_snapshot_api.js';
import { subscribe_audit_snapshots } from './list_push_service.js';

const DEFAULT_POLL_INTERVAL_MS = 5000;

type SnapshotWaitOutcome = 'ready' | 'failed' | 'pending';

async function poll_snapshot_wait_outcome(
    audit_id: string,
    capture_id: string
): Promise<SnapshotWaitOutcome> {
    const list = await list_audit_snapshots(audit_id);
    for (const item of list.items) {
        if (item.currentReady?.snapshotId === capture_id) {
            return 'ready';
        }
        const pending = item.pendingAttempt;
        if (pending?.snapshotId === capture_id) {
            if (pending.status === 'failed' || pending.status === 'cancelled') {
                return 'failed';
            }
            return 'pending';
        }
    }
    return 'pending';
}

/**
 * Väntar tills angiven capture är ready eller failed, eller timeout.
 */
export async function wait_for_audit_snapshot_ready(
    audit_id: string,
    capture_id: string,
    timeout_ms: number,
    poll_interval_ms = DEFAULT_POLL_INTERVAL_MS
): Promise<boolean> {
    let settled = false;

    return new Promise((resolve) => {
        const finish = (ready: boolean) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout_timer);
            window.clearInterval(poll_timer);
            unsub();
            resolve(ready);
        };

        const timeout_timer = window.setTimeout(() => finish(false), timeout_ms);

        const unsub = subscribe_audit_snapshots((payload) => {
            if (String(payload.auditId) !== String(audit_id)) return;
            if (String(payload.snapshotId) !== String(capture_id)) return;
            if (payload.status === 'ready') finish(true);
            if (payload.status === 'failed' || payload.status === 'cancelled') finish(false);
        });

        const poll_timer = window.setInterval(() => {
            void poll_snapshot_wait_outcome(audit_id, capture_id)
                .then((outcome) => {
                    if (outcome === 'ready') finish(true);
                    if (outcome === 'failed') finish(false);
                })
                .catch(() => {
                    // Nästa poll försöker igen
                });
        }, poll_interval_ms);

        void poll_snapshot_wait_outcome(audit_id, capture_id)
            .then((outcome) => {
                if (outcome === 'ready') finish(true);
                if (outcome === 'failed') finish(false);
            })
            .catch(() => {
                // Vänta på push eller nästa poll
            });
    });
}

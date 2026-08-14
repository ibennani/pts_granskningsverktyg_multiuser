/**
 * @fileoverview Rättvis val av nästa snapshot-jobb (max en aktiv per granskning, round-robin).
 */

export type FairQueueJob = {
    audit_id: string;
};

export type PickFairQueueJobOptions<T extends FairQueueJob> = {
    queue: T[];
    active_audit_ids: ReadonlySet<string>;
    last_served_audit_id: string | null;
};

/**
 * Väljer nästa jobb och tar bort det från kö-arrayen.
 * @returns valt jobb eller null om inget lämpligt jobb finns
 */
export function pick_fair_queue_job<T extends FairQueueJob>(
    options: PickFairQueueJobOptions<T>
): { job: T | null; last_served_audit_id: string | null } {
    const { queue, active_audit_ids } = options;
    let last_served_audit_id = options.last_served_audit_id;

    const candidate_indexes: number[] = [];
    for (let i = 0; i < queue.length; i += 1) {
        if (!active_audit_ids.has(queue[i].audit_id)) {
            candidate_indexes.push(i);
        }
    }

    if (candidate_indexes.length === 0) {
        if (queue.length === 0) {
            return { job: null, last_served_audit_id };
        }
        const job = queue.shift() ?? null;
        if (job) {
            last_served_audit_id = job.audit_id;
        }
        return { job, last_served_audit_id };
    }

    let pick_index = candidate_indexes[0];
    for (const index of candidate_indexes) {
        if (queue[index].audit_id !== last_served_audit_id) {
            pick_index = index;
            break;
        }
    }

    const job = queue[pick_index];
    queue.splice(pick_index, 1);
    last_served_audit_id = job.audit_id;
    return { job, last_served_audit_id };
}

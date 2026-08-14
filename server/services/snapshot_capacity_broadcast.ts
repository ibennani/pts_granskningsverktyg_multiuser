/**
 * @fileoverview WebSocket-notis när global snapshot-kapacitet ändras.
 */
import { broadcast } from '../ws.js';
import { build_snapshot_capacity } from './snapshot_capacity_service.js';

let debounce_timer: ReturnType<typeof setTimeout> | null = null;

export function schedule_snapshot_capacity_broadcast(): void {
    if (debounce_timer) return;
    debounce_timer = setTimeout(() => {
        debounce_timer = null;
        void flush_snapshot_capacity_broadcast();
    }, 400);
}

export async function flush_snapshot_capacity_broadcast(): Promise<void> {
    const capacity = await build_snapshot_capacity();
    broadcast({
        type: 'snapshot:capacity_changed',
        ...capacity,
    });
}

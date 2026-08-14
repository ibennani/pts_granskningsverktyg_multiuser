/**
 * @fileoverview Visar global snapshot-kö och elapsed-timer under långa väntor.
 */
import { fetch_snapshot_capacity, type SnapshotCapacity } from '../api/snapshot_capacity_api.js';
import { subscribe_snapshot_capacity } from './list_push_service.js';
import { format_snapshot_capacity_line } from './snapshot_capacity_line_format.js';

const POLL_INTERVAL_MS = 5000;

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

export type SnapshotQueueStatusController = {
    start: () => void;
    stop: () => void;
    refresh: () => Promise<void>;
    set_queue_position: (position: number | null) => void;
    start_elapsed_hint: () => void;
    stop_elapsed_hint: () => void;
};

function format_capacity_line(
    t: TranslationFn,
    capacity: SnapshotCapacity,
    queue_position: number | null
): string {
    return format_snapshot_capacity_line(t, capacity, queue_position);
}

function format_elapsed_seconds(total_seconds: number): string {
    const minutes = Math.floor(total_seconds / 60);
    const seconds = total_seconds % 60;
    if (minutes > 0) {
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    return `${seconds} s`;
}

export function create_snapshot_queue_status_controller(options: {
    t: TranslationFn;
    capacity_el: HTMLElement;
    elapsed_el?: HTMLElement | null;
}): SnapshotQueueStatusController {
    const { t, capacity_el, elapsed_el } = options;
    let poll_timer: ReturnType<typeof setInterval> | null = null;
    let elapsed_timer: ReturnType<typeof setInterval> | null = null;
    let elapsed_started_at: number | null = null;
    let unsubscribe_ws: (() => void) | null = null;
    let last_capacity: SnapshotCapacity | null = null;
    let queue_position: number | null = null;
    let running = false;

    const render = () => {
        if (!last_capacity) {
            capacity_el.textContent = '';
            return;
        }
        capacity_el.textContent = format_capacity_line(t, last_capacity, queue_position);
    };

    const apply_capacity = (capacity: SnapshotCapacity) => {
        last_capacity = capacity;
        render();
    };

    const refresh = async (): Promise<void> => {
        try {
            const capacity = await fetch_snapshot_capacity();
            apply_capacity(capacity);
        } catch {
            // tyst vid poll-fel
        }
    };

    const start = () => {
        if (running) return;
        running = true;
        capacity_el.hidden = false;
        void refresh();
        poll_timer = setInterval(() => {
            void refresh();
        }, POLL_INTERVAL_MS);
        unsubscribe_ws = subscribe_snapshot_capacity((payload) => {
            if (!payload || typeof payload !== 'object') return;
            apply_capacity(payload as SnapshotCapacity);
        });
    };

    const stop = () => {
        running = false;
        if (poll_timer) {
            clearInterval(poll_timer);
            poll_timer = null;
        }
        if (unsubscribe_ws) {
            unsubscribe_ws();
            unsubscribe_ws = null;
        }
        stop_elapsed_hint();
        last_capacity = null;
        queue_position = null;
        capacity_el.textContent = '';
        capacity_el.hidden = true;
        if (elapsed_el) {
            elapsed_el.textContent = '';
            elapsed_el.hidden = true;
        }
    };

    const set_queue_position = (position: number | null) => {
        queue_position = position;
        render();
    };

    const stop_elapsed_hint = () => {
        if (elapsed_timer) {
            clearInterval(elapsed_timer);
            elapsed_timer = null;
        }
        elapsed_started_at = null;
        if (elapsed_el) {
            elapsed_el.textContent = '';
            elapsed_el.hidden = true;
        }
    };

    const start_elapsed_hint = () => {
        if (!elapsed_el) return;
        elapsed_started_at = Date.now();
        elapsed_el.hidden = false;
        const tick = () => {
            if (!elapsed_started_at) return;
            const seconds = Math.max(0, Math.floor((Date.now() - elapsed_started_at) / 1000));
            elapsed_el.textContent = t('snapshot_capacity_still_active', {
                elapsed: format_elapsed_seconds(seconds),
            });
        };
        tick();
        if (elapsed_timer) clearInterval(elapsed_timer);
        elapsed_timer = setInterval(tick, 5000);
    };

    return {
        start,
        stop,
        refresh,
        set_queue_position,
        start_elapsed_hint,
        stop_elapsed_hint,
    };
}

/**
 * @fileoverview Brygga för in-memory snapshot-kö (undviker cirkulära imports).
 */

let queue_length_reader: () => number = () => 0;
let queue_position_reader: (capture_id: string) => number | null = () => null;

export function set_snapshot_queue_metric_readers(readers: {
    get_queue_length: () => number;
    get_queue_position: (capture_id: string) => number | null;
}): void {
    queue_length_reader = readers.get_queue_length;
    queue_position_reader = readers.get_queue_position;
}

export function get_in_memory_queue_length(): number {
    return queue_length_reader();
}

export function get_memory_queue_position(capture_id: string): number | null {
    return queue_position_reader(capture_id);
}

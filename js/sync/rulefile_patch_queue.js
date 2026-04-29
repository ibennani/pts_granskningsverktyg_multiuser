const GLOBAL_QUEUE_KEY = '__gv_rulefile_part_patch_queue__';

function get_global_queue() {
    if (typeof window === 'undefined') return null;
    return window[GLOBAL_QUEUE_KEY];
}

function set_global_queue(value) {
    if (typeof window === 'undefined') return;
    window[GLOBAL_QUEUE_KEY] = value;
}

export function ensure_rulefile_patch_queue() {
    const q = get_global_queue();
    if (Array.isArray(q)) return q;
    const next = [];
    set_global_queue(next);
    return next;
}

export function enqueue_rulefile_part_patch(patch) {
    const q = ensure_rulefile_patch_queue();
    q.push(patch);
}

/**
 * Returnerar och tömmer kön (atomärt ur konsumentperspektiv).
 * @returns {Array}
 */
export function drain_rulefile_patch_queue() {
    const q = ensure_rulefile_patch_queue();
    if (q.length === 0) return [];
    const to_send = q.splice(0, q.length);
    set_global_queue(q);
    return to_send;
}


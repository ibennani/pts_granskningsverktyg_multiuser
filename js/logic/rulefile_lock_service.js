// js/logic/rulefile_lock_service.js
// Enkel klientservice för fältlås (lease) i regelfilsredigering.

import {
    acquire_rule_lock,
    heartbeat_rule_lock,
    release_rule_lock,
    get_rule_locks
} from '../api/client.js';
import { generate_uuid_v4 } from '../utils/helpers.js';

const DEFAULT_TTL_SECONDS = 30;
const HEARTBEAT_EVERY_MS = 15000;

let current_rule_set_id = null;
let heartbeat_timer = null;
let active_locks_by_part = new Map(); // part_key -> { client_lock_id, lease_until }
let known_remote_locks_by_part = new Map(); // part_key -> lock row

export function ensure_client_lock_id_for_part(part_key) {
    // window.name bevaras vid sidomladdning, men är tomt när en flik dupliceras.
    if (typeof window !== 'undefined') {
        if (!window.name || !window.name.startsWith('gv_tab_')) {
            window.name = `gv_tab_${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(16).slice(2)}`;
        }
    }
    const tab_id = typeof window !== 'undefined' ? window.name : 'fallback';
    const key = `gv_rule_lock_id\0${String(part_key)}\0${tab_id}`;

    const existing = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
    if (existing) {
        // Om ett gammalt ogiltigt lock-id ligger kvar (innan vi tvingade UUID v4), kasta det
        if (!existing.startsWith('lock-')) return existing;
    }

    const id = generate_uuid_v4();
    try {
        sessionStorage.setItem(key, id);
    } catch (_) {
        // ignoreras
    }
    return id;
}

async function refresh_remote_locks(rule_set_id) {
    try {
        const data = await get_rule_locks(rule_set_id);
        const locks = Array.isArray(data?.locks) ? data.locks : [];
        const next = new Map();
        locks.forEach((l) => {
            if (!l?.part_key) return;
            next.set(String(l.part_key), l);
        });
        known_remote_locks_by_part = next;
        return next;
    } catch (_) {
        return known_remote_locks_by_part;
    }
}

function get_remote_lock(part_key) {
    return known_remote_locks_by_part.get(String(part_key)) || null;
}

function start_heartbeat() {
    if (heartbeat_timer) return;
    heartbeat_timer = setInterval(async () => {
        const rule_set_id = current_rule_set_id;
        if (!rule_set_id) return;
        const parts = Array.from(active_locks_by_part.keys());
        for (const part_key of parts) {
            const client_lock_id = active_locks_by_part.get(part_key)?.client_lock_id;
            if (!client_lock_id) continue;
            try {
                await heartbeat_rule_lock(rule_set_id, part_key, { client_lock_id, ttl_seconds: DEFAULT_TTL_SECONDS });
            } catch (_) {
                // Om heartbeat misslyckas försöker vi hämta om låslistan så UI kan reagera.
                await refresh_remote_locks(rule_set_id);
            }
        }
    }, HEARTBEAT_EVERY_MS);
}

function stop_heartbeat_if_idle() {
    if (active_locks_by_part.size > 0) return;
    if (!heartbeat_timer) return;
    clearInterval(heartbeat_timer);
    heartbeat_timer = null;
}

export async function init_rulefile_lock_service(rule_set_id) {
    current_rule_set_id = rule_set_id ? String(rule_set_id) : null;
    await refresh_remote_locks(current_rule_set_id);
}

export function get_current_rulefile_remote_lock(part_key) {
    return get_remote_lock(part_key);
}

export async function try_acquire_rulefile_part_lock({ rule_set_id, part_key }) {
    const rsid = rule_set_id ? String(rule_set_id) : current_rule_set_id;
    if (!rsid) throw new Error('rule_set_id saknas');
    const pk = String(part_key || '');
    const client_lock_id = ensure_client_lock_id_for_part(pk);
    try {
        const r = await acquire_rule_lock(rsid, { part_key: pk, client_lock_id, ttl_seconds: DEFAULT_TTL_SECONDS });
        const lock = r?.lock;
        active_locks_by_part.set(pk, { client_lock_id, lease_until: lock?.lease_until || null });
        await refresh_remote_locks(rsid);
        start_heartbeat();
        return { ok: true, lock, client_lock_id };
    } catch (err) {
        await refresh_remote_locks(rsid);
        return { ok: false, error: err, lock: err?.lock || err?.response?.lock || null };
    }
}

export async function release_rulefile_part_lock({ rule_set_id, part_key }) {
    const rsid = rule_set_id ? String(rule_set_id) : current_rule_set_id;
    if (!rsid) return { ok: false };
    const pk = String(part_key || '');
    const client_lock_id = active_locks_by_part.get(pk)?.client_lock_id || ensure_client_lock_id_for_part(pk);
    try {
        await release_rule_lock(rsid, pk, client_lock_id);
    } catch (_) {
        // ignoreras; lease TTL hanterar städning
    } finally {
        active_locks_by_part.delete(pk);
        await refresh_remote_locks(rsid);
        stop_heartbeat_if_idle();
    }
    return { ok: true };
}


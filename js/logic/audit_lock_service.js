// js/logic/audit_lock_service.js
// Enkel klientservice för fältlås (lease) i granskningar.

import { api_get, api_post, api_delete } from '../api/client.js';

const DEFAULT_TTL_SECONDS = 30;
const HEARTBEAT_EVERY_MS = 15000;

let current_audit_id = null;
let heartbeat_timer = null;
let active_locks_by_part = new Map(); // part_key -> { client_lock_id, lease_until }
let known_remote_locks_by_part = new Map(); // part_key -> lock row

function ensure_client_lock_id_for_part(part_key) {
    const key = `gv_audit_lock_id\0${String(part_key)}`;
    const existing = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
    if (existing) return existing;
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `lock-${Math.random().toString(16).slice(2)}-${Date.now()}`;
    try {
        sessionStorage.setItem(key, id);
    } catch (_) {
        // ignoreras medvetet
    }
    return id;
}

async function refresh_remote_locks(audit_id) {
    try {
        const data = await api_get(`/audits/${encodeURIComponent(audit_id)}/locks`);
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

function start_heartbeat() {
    if (heartbeat_timer) return;
    heartbeat_timer = setInterval(async () => {
        const audit_id = current_audit_id;
        if (!audit_id) return;
        const parts = Array.from(active_locks_by_part.keys());
        for (const part_key of parts) {
            const client_lock_id = active_locks_by_part.get(part_key)?.client_lock_id;
            if (!client_lock_id) continue;
            try {
                await api_post(`/audits/${encodeURIComponent(audit_id)}/locks/${encodeURIComponent(part_key)}/heartbeat`, {
                    client_lock_id,
                    ttl_seconds: DEFAULT_TTL_SECONDS
                });
            } catch (_) {
                await refresh_remote_locks(audit_id);
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

export async function init_audit_lock_service(audit_id) {
    current_audit_id = audit_id ? String(audit_id) : null;
    if (current_audit_id) {
        await refresh_remote_locks(current_audit_id);
    }
}

export function get_current_audit_remote_lock(part_key) {
    return known_remote_locks_by_part.get(String(part_key)) || null;
}

export async function try_acquire_audit_part_lock({ audit_id, part_key }) {
    const aid = audit_id ? String(audit_id) : current_audit_id;
    if (!aid) throw new Error('audit_id saknas');
    const pk = String(part_key || '');
    const client_lock_id = ensure_client_lock_id_for_part(pk);
    try {
        const r = await api_post(`/audits/${encodeURIComponent(aid)}/locks`, {
            part_key: pk,
            client_lock_id,
            ttl_seconds: DEFAULT_TTL_SECONDS
        });
        const lock = r?.lock;
        active_locks_by_part.set(pk, { client_lock_id, lease_until: lock?.lease_until || null });
        await refresh_remote_locks(aid);
        start_heartbeat();
        return { ok: true, lock, client_lock_id };
    } catch (err) {
        await refresh_remote_locks(aid);
        return { ok: false, error: err, lock: err?.responseBody?.lock || null };
    }
}

export async function release_audit_part_lock({ audit_id, part_key }) {
    const aid = audit_id ? String(audit_id) : current_audit_id;
    if (!aid) return { ok: false };
    const pk = String(part_key || '');
    const client_lock_id = active_locks_by_part.get(pk)?.client_lock_id || ensure_client_lock_id_for_part(pk);
    try {
        await api_delete(`/audits/${encodeURIComponent(aid)}/locks/${encodeURIComponent(pk)}?client_lock_id=${encodeURIComponent(client_lock_id)}`);
    } catch (_) {
        // ignoreras; TTL städar
    } finally {
        active_locks_by_part.delete(pk);
        await refresh_remote_locks(aid);
        stop_heartbeat_if_idle();
    }
    return { ok: true };
}


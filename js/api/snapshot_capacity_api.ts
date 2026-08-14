/**
 * @fileoverview API för global snapshot-kapacitet.
 */

import { get_auth_token, get_base_url, refresh_auth_token } from './client.js';

export type SnapshotCapacity = {
    max_browser_slots: number;
    active_count: number;
    capturing_count: number;
    packaging_count: number;
    queued_count: number;
    active_audit_count: number;
    active_user_count: number;
    memory_queue_length: number;
    updated_at: string;
};

async function authorized_fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const token = get_auth_token();
    const headers = new Headers(init.headers || {});
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    let res = await fetch(url, { ...init, headers });
    if (res.status === 401) {
        const refreshed = await refresh_auth_token();
        if (refreshed) {
            const retry_headers = new Headers(init.headers || {});
            retry_headers.set('Authorization', `Bearer ${get_auth_token()}`);
            res = await fetch(url, { ...init, headers: retry_headers });
        }
    }
    return res;
}

export async function fetch_snapshot_capacity(): Promise<SnapshotCapacity> {
    const base = get_base_url();
    const res = await authorized_fetch(`${base}/snapshots/capacity`);
    if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<SnapshotCapacity>;
}

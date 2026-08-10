/**
 * @fileoverview API-anrop för tekniska audit-snapshots.
 */

import { get_auth_token, get_base_url, refresh_auth_token } from './client.js';

export type AuditSnapshotTaskOutcome = 'success' | 'failed' | 'skipped';

export type AuditSnapshotCaptureResponse = {
    captureId: string;
    snapshotStatus: string;
    pageTitle: {
        outcome: AuditSnapshotTaskOutcome;
        value?: string;
        error?: string;
    };
    screenshot: {
        outcome: AuditSnapshotTaskOutcome;
        filename?: string;
        size?: number;
        mime?: string;
        error?: string;
    };
};

export type AuditSnapshotListItem = {
    sampleId: string;
    sampleDescription?: string;
    requestedUrl: string;
    pageTitle: string | null;
    currentReady: {
        snapshotId: string;
        capturedAt: string;
        status: 'ready';
        warningCount: number;
        sizeBytes: number | null;
    } | null;
    pendingAttempt: {
        snapshotId: string;
        status: string;
        error: string | null;
        warningCount: number;
    } | null;
};

async function authorized_fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const token = get_auth_token();
    const headers = new Headers(init.headers || {});
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    let res = await fetch(url, { ...init, headers });
    if (res.status === 401) {
        const refreshed = await refresh_auth_token();
        if (refreshed) {
            const retry_headers = new Headers(init.headers || {});
            retry_headers.set('Authorization', `Bearer ${get_auth_token()}`);
            if (init.body && !retry_headers.has('Content-Type')) {
                retry_headers.set('Content-Type', 'application/json');
            }
            res = await fetch(url, { ...init, headers: retry_headers });
        }
    }
    return res;
}

export async function start_audit_snapshot_capture(
    audit_id: string,
    body: {
        captureId: string;
        sampleId: string;
        url: string;
        filenameSuffix?: string;
        attachScreenshotToSample?: boolean;
    },
    signal?: AbortSignal
): Promise<AuditSnapshotCaptureResponse> {
    const base = get_base_url();
    const res = await authorized_fetch(`${base}audits/${encodeURIComponent(audit_id)}/snapshots/capture`, {
        method: 'POST',
        body: JSON.stringify(body),
        signal,
    });
    if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || payload.detail || `HTTP ${res.status}`);
    }
    return res.json() as Promise<AuditSnapshotCaptureResponse>;
}

export async function cancel_audit_snapshot_capture(
    audit_id: string,
    capture_id: string
): Promise<void> {
    const base = get_base_url();
    const res = await authorized_fetch(
        `${base}audits/${encodeURIComponent(audit_id)}/snapshots/${encodeURIComponent(capture_id)}`,
        { method: 'DELETE' }
    );
    if (!res.ok && res.status !== 404) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${res.status}`);
    }
}

export async function list_audit_snapshots(
    audit_id: string
): Promise<{ items: AuditSnapshotListItem[] }> {
    const base = get_base_url();
    const res = await authorized_fetch(`${base}audits/${encodeURIComponent(audit_id)}/snapshots`);
    if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<{ items: AuditSnapshotListItem[] }>;
}

export function get_audit_snapshot_download_url(audit_id: string, snapshot_id: string): string {
    const base = get_base_url();
    return `${base}audits/${encodeURIComponent(audit_id)}/snapshots/${encodeURIComponent(snapshot_id)}/download`;
}

export function get_audit_snapshots_download_all_url(audit_id: string): string {
    const base = get_base_url();
    return `${base}audits/${encodeURIComponent(audit_id)}/snapshots/download-all`;
}

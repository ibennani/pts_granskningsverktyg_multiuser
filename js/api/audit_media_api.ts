/**
 * @fileoverview API-anrop för uppladdning och hantering av mediefiler per granskning.
 */

import { get_auth_token, get_base_url, refresh_auth_token } from './client.js';

export type AuditMediaFileInfo = {
    filename: string;
    size: number;
    mime: string | null;
    uploadedAt?: string | null;
};

export type AuditMediaFilenameMigration = {
    from: string;
    to: string;
};

export type ListAuditMediaResult = {
    files: AuditMediaFileInfo[];
    filename_migrations: AuditMediaFilenameMigration[];
};

type UploadResponse = {
    filename: string;
    size: number;
    mime: string;
    renamedDueToConflict?: boolean;
    requestedFilename?: string;
};

async function parse_error_payload(res: Response): Promise<{ error?: string; detail?: string }> {
    return res.json().catch(() => ({ error: res.statusText || `HTTP ${res.status}` }));
}

function build_auth_headers_without_content_type(): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = get_auth_token();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

async function fetch_with_auth_retry(url: string, init: RequestInit): Promise<Response> {
    const run_fetch = () =>
        fetch(url, {
            ...init,
            headers: {
                ...build_auth_headers_without_content_type(),
                ...(init.headers || {})
            }
        });

    let res = await run_fetch();
    if (res.status === 401 && get_auth_token()) {
        const refreshed = await refresh_auth_token();
        if (refreshed) {
            res = await run_fetch();
        }
    }
    return res;
}

/**
 * Bygger URL för att hämta en uppladdad mediefil (kräver auth via fetch; img src fungerar med cookie-less Bearer endast via samma origin om proxy skickar token — här används URL med token i query EJ — vi använder img med samma session: fetch blob eller public GET with auth).
 * För img src: API kräver Bearer — browser img tag can't send Authorization.
 * Need to fix: GET media must work for img src without Bearer OR use blob URLs.
 */
export function get_audit_media_path(audit_id: string, filename: string): string {
    const safe_audit = encodeURIComponent(String(audit_id));
    const safe_name = encodeURIComponent(String(filename));
    return `/audits/${safe_audit}/media/${safe_name}`;
}

/** Full URL inklusive API-bas för img src (kräver att anropet autentiseras). */
export function get_audit_media_url(audit_id: string, filename: string): string {
    return `${get_base_url()}${get_audit_media_path(audit_id, filename)}`;
}

/**
 * Hämtar en mediefil som blob-URL (för img src med auth).
 */
export async function fetch_audit_media_blob_url(audit_id: string, filename: string): Promise<string | null> {
    const url = get_audit_media_url(audit_id, filename);
    const res = await fetch_with_auth_retry(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}

/**
 * Hämtar en mediefil som råa bytes (för zip-export).
 */
export async function fetch_audit_media_bytes(audit_id: string, filename: string): Promise<ArrayBuffer | null> {
    const url = get_audit_media_url(audit_id, filename);
    const res = await fetch_with_auth_retry(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    return res.arrayBuffer();
}

export function get_audit_media_list_url(audit_id: string): string {
    return `${get_base_url()}/audits/${encodeURIComponent(String(audit_id))}/media`;
}

export async function list_audit_media(audit_id: string): Promise<ListAuditMediaResult> {
    const url = get_audit_media_list_url(audit_id);
    const res = await fetch_with_auth_retry(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
        const err = await parse_error_payload(res);
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
        files?: AuditMediaFileInfo[];
        filenameMigrations?: AuditMediaFilenameMigration[];
    };
    return {
        files: Array.isArray(data.files) ? data.files : [],
        filename_migrations: Array.isArray(data.filenameMigrations) ? data.filenameMigrations : []
    };
}

export async function upload_audit_media(audit_id: string, file: File): Promise<UploadResponse> {
    const form_data = new FormData();
    form_data.append('file', file);
    const url = `${get_base_url()}/audits/${encodeURIComponent(String(audit_id))}/media`;
    const res = await fetch_with_auth_retry(url, {
        method: 'POST',
        body: form_data
    });
    if (!res.ok) {
        const err = await parse_error_payload(res);
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as UploadResponse;
}

export async function delete_audit_media(audit_id: string, filename: string): Promise<void> {
    const url = get_audit_media_url(audit_id, filename);
    const res = await fetch_with_auth_retry(url, { method: 'DELETE' });
    // 404 = fil fanns aldrig på servern (t.ex. äldre granskningar med enbart filnamn i text).
    if (res.status === 204 || res.status === 404) {
        return;
    }
    if (!res.ok) {
        const err = await parse_error_payload(res);
        throw new Error(err.error || `HTTP ${res.status}`);
    }
}

export type CaptureUrlScreenshotResponse = {
    filename: string;
    pageTitle: string;
    size: number;
    mime: string;
    renamedDueToConflict?: boolean;
    requestedFilename?: string;
};

export type FetchUrlPageTitleResponse = {
    pageTitle: string;
};

export async function fetch_audit_url_page_title(
    audit_id: string,
    url: string
): Promise<FetchUrlPageTitleResponse> {
    const api_url = `${get_base_url()}/audits/${encodeURIComponent(String(audit_id))}/fetch-page-title`;
    const res = await fetch_with_auth_retry(api_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ url })
    });
    if (!res.ok) {
        const err = await parse_error_payload(res);
        const message = err.detail || err.error || `HTTP ${res.status}`;
        throw new Error(message);
    }
    return (await res.json()) as FetchUrlPageTitleResponse;
}

export async function capture_audit_url_screenshot(
    audit_id: string,
    url: string,
    filename_suffix: string
): Promise<CaptureUrlScreenshotResponse> {
    const api_url = `${get_base_url()}/audits/${encodeURIComponent(String(audit_id))}/media/capture-screenshot`;
    const res = await fetch_with_auth_retry(api_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ url, filenameSuffix: filename_suffix })
    });
    if (!res.ok) {
        const err = await parse_error_payload(res);
        const message = err.detail || err.error || `HTTP ${res.status}`;
        throw new Error(message);
    }
    return (await res.json()) as CaptureUrlScreenshotResponse;
}

export type DetectContentTypesResponse = {
    detectedContentTypeIds: string[];
    triggeredSignals?: string[];
};

export async function detect_content_types_from_url(
    audit_id: string,
    url: string,
    allowed_content_type_ids: string[]
): Promise<DetectContentTypesResponse> {
    const api_url = `${get_base_url()}/audits/${encodeURIComponent(String(audit_id))}/detect-content-types`;
    const res = await fetch_with_auth_retry(api_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ url, allowedContentTypeIds: allowed_content_type_ids })
    });
    if (!res.ok) {
        const err = await parse_error_payload(res);
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as DetectContentTypesResponse;
}

export function can_upload_audit_media(audit_id: string | null | undefined): boolean {
    return Boolean(audit_id && get_auth_token());
}

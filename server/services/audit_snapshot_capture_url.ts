/**
 * @fileoverview Kanonisk capture-URL från granskningsdel i audit (inte klientens body.url).
 */
import { query } from '../db.js';
import { assert_public_http_url, SsrfUrlRejectedError } from '../utils/ssrf_url_guard.js';

type SampleLike = {
    id?: string;
    url?: string;
};

export class SnapshotSampleNotFoundError extends Error {
    constructor() {
        super('Granskningsdelen hittades inte');
        this.name = 'SnapshotSampleNotFoundError';
    }
}

export class SnapshotSampleMissingUrlError extends Error {
    constructor() {
        super('Granskningsdelen saknar webbadress');
        this.name = 'SnapshotSampleMissingUrlError';
    }
}

function find_sample_url(samples: unknown, sample_id: string): string | null | undefined {
    if (!Array.isArray(samples)) return undefined;
    const sample = samples.find(
        (entry: SampleLike) => String(entry?.id ?? '') === String(sample_id)
    ) as SampleLike | undefined;
    if (!sample) return undefined;
    const url = (sample.url ?? '').trim();
    return url || null;
}

export async function get_audit_sample_url(
    audit_id: string,
    sample_id: string
): Promise<string | null | undefined> {
    const result = await query('SELECT samples FROM audits WHERE id = $1', [audit_id]);
    if (result.rows.length === 0) return undefined;
    return find_sample_url(result.rows[0].samples, sample_id);
}

function safe_public_href(url: string): string {
    try {
        return assert_public_http_url(url).href;
    } catch (err) {
        if (err instanceof SsrfUrlRejectedError) throw err;
        throw new SnapshotSampleMissingUrlError();
    }
}

export async function resolve_snapshot_capture_url_for_audit(
    audit_id: string,
    sample_id: string,
    client_url: string
): Promise<{ url: string; client_url_ignored: boolean }> {
    const sample_url = await get_audit_sample_url(audit_id, sample_id);
    if (sample_url === undefined) {
        throw new SnapshotSampleNotFoundError();
    }
    if (!sample_url) {
        throw new SnapshotSampleMissingUrlError();
    }

    const canonical_href = safe_public_href(sample_url);
    const client_trimmed = (client_url ?? '').trim();
    let client_url_ignored = false;

    if (client_trimmed) {
        try {
            const client_href = safe_public_href(client_trimmed);
            client_url_ignored = client_href !== canonical_href;
        } catch {
            client_url_ignored = true;
        }
    }

    return { url: canonical_href, client_url_ignored };
}

export function resolve_snapshot_list_requested_url(
    sample: SampleLike | undefined,
    pending_requested_url: string | null | undefined,
    ready_requested_url: string | null | undefined
): string {
    const from_sample = (sample?.url ?? '').trim();
    if (from_sample) return from_sample;
    return (pending_requested_url ?? ready_requested_url ?? '').trim();
}

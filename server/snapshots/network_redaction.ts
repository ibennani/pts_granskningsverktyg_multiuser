/**
 * @fileoverview Redaction av känsliga nätverksheaders i snapshot-metadata.
 */

const BLOCKED_HEADER_NAMES = new Set([
    'cookie',
    'set-cookie',
    'authorization',
    'proxy-authorization',
]);

export type RawHeaderPair = { name: string; value: string };

export function is_blocked_network_header(name: string): boolean {
    return BLOCKED_HEADER_NAMES.has(String(name || '').trim().toLowerCase());
}

export function sanitize_response_headers(
    headers: Record<string, string> | RawHeaderPair[] | undefined
): Record<string, string> {
    const safe: Record<string, string> = {};
    if (!headers) return safe;

    if (Array.isArray(headers)) {
        for (const pair of headers) {
            if (!pair?.name || is_blocked_network_header(pair.name)) continue;
            safe[pair.name] = String(pair.value ?? '');
        }
        return safe;
    }

    for (const [name, value] of Object.entries(headers)) {
        if (is_blocked_network_header(name)) continue;
        safe[name] = String(value ?? '');
    }
    return safe;
}

export function sanitize_request_headers(
    headers: Record<string, string> | RawHeaderPair[] | undefined
): Record<string, string> {
    return sanitize_response_headers(headers);
}

export type NetworkResourceEntry = {
    url: string;
    method: string;
    resourceType: string;
    mimeType: string | null;
    status: number | null;
    timingMs: number | null;
    encodedSize: number | null;
    decodedSize: number | null;
    failed: boolean;
    failureReason: string | null;
    redirectChain: string[];
    responseHeaders: Record<string, string>;
    bodyCaptured: boolean;
    bodySkipReason: string | null;
    originalArchivePath: string | null;
};

export function build_network_json(resources: NetworkResourceEntry[]): {
    resources: NetworkResourceEntry[];
    failedRequestCount: number;
} {
    const failedRequestCount = resources.filter((r) => r.failed).length;
    return { resources, failedRequestCount };
}

/**
 * @fileoverview Ren logik för masskapande av URL-baserade granskningsdelar.
 */

export type BulkSampleUrlEntry = {
    input: string;
    normalizedUrl: string | null;
    lineNumber: number;
    status: 'valid' | 'invalid' | 'duplicate';
    reason: string | null;
};

function normalize_http_url(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
    try {
        const url = new URL(candidate);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}

function canonical_duplicate_key(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.hostname = parsed.hostname.toLowerCase();
        if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) {
            parsed.port = '';
        }
        if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
        return parsed.toString();
    } catch {
        return url;
    }
}

export function parse_bulk_sample_urls(input: string): BulkSampleUrlEntry[] {
    const seen = new Set<string>();
    const entries: BulkSampleUrlEntry[] = [];
    String(input || '').split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const normalized = normalize_http_url(trimmed);
        if (!normalized) {
            entries.push({
                input: trimmed,
                normalizedUrl: null,
                lineNumber: index + 1,
                status: 'invalid',
                reason: 'invalid-url',
            });
            return;
        }
        const key = canonical_duplicate_key(normalized);
        if (seen.has(key)) {
            entries.push({
                input: trimmed,
                normalizedUrl: normalized,
                lineNumber: index + 1,
                status: 'duplicate',
                reason: 'duplicate-url',
            });
            return;
        }
        seen.add(key);
        entries.push({
            input: trimmed,
            normalizedUrl: normalized,
            lineNumber: index + 1,
            status: 'valid',
            reason: null,
        });
    });
    return entries;
}

export function get_valid_unique_bulk_sample_urls(input: string): string[] {
    return parse_bulk_sample_urls(input)
        .filter((entry) => entry.status === 'valid' && entry.normalizedUrl)
        .map((entry) => entry.normalizedUrl!);
}

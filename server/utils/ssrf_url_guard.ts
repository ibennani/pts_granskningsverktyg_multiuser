/**
 * @fileoverview SSRF-skydd för server-side URL-hämtning (t.ex. skärmdumpar).
 */

export class SsrfUrlRejectedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SsrfUrlRejectedError';
    }
}

const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
]);

function is_private_ipv4(hostname: string): boolean {
    const parts = hostname.split('.').map((p) => Number.parseInt(p, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
        return false;
    }
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
}

function is_blocked_hostname(hostname: string): boolean {
    const lower = hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(lower)) return true;
    if (lower.endsWith('.localhost')) return true;
    if (lower.endsWith('.local')) return true;
    if (is_private_ipv4(lower)) return true;
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    return false;
}

/**
 * Validerar att en URL är säker att hämta från servern (endast publik http/https).
 */
export function assert_public_http_url(raw_url: string): URL {
    let parsed: URL;
    try {
        parsed = new URL(raw_url);
    } catch {
        throw new SsrfUrlRejectedError('Ogiltig URL');
    }

    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
        throw new SsrfUrlRejectedError('Endast http och https stöds');
    }

    const hostname = parsed.hostname.trim();
    if (!hostname) {
        throw new SsrfUrlRejectedError('Ogiltig URL');
    }

    if (is_blocked_hostname(hostname)) {
        throw new SsrfUrlRejectedError('URL:en får inte peka på intern adress');
    }

    return parsed;
}

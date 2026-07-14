/**
 * @fileoverview Regler för domän-cache av CMP-samtycke vid skärmdump (testbar utan Puppeteer).
 */

export const CMP_CONSENT_COOKIE_NAMES = [
    'CookieConsent',
    'OptanonConsent',
    'OptanonAlertBoxClosed',
    'uc_user_interaction',
    'CookieInformationConsent',
] as const;

export const CMP_CONSENT_LOCAL_STORAGE_KEYS = [
    'didomi_token',
    'didomi_config',
    'klaro',
    'uc_settings',
] as const;

export const DEFAULT_CONSENT_CACHE_TTL_DAYS = 90;

export type ConsentCacheCookie = {
    name: string;
    value: string;
    domain: string;
    path: string;
};

export type ConsentCacheSnapshot = {
    domain: string;
    updated_at: string;
    source: 'learned' | 'manual' | 'merged';
    cookies: ConsentCacheCookie[];
    local_storage: Record<string, string>;
};

export type ConsentSeedFile = Record<string, Omit<ConsentCacheSnapshot, 'domain'>>;

export function get_registrable_domain(url: string): string {
    const parsed = new URL(url);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) {
        host = host.slice(4);
    }
    return host;
}

export function is_cmp_consent_cookie_name(name: string): boolean {
    const normalized = String(name || '').trim();
    return CMP_CONSENT_COOKIE_NAMES.some((allowed) => allowed === normalized);
}

export function is_cmp_consent_local_storage_key(key: string): boolean {
    const normalized = String(key || '').trim();
    return CMP_CONSENT_LOCAL_STORAGE_KEYS.some((allowed) => allowed === normalized);
}

export function filter_cmp_cookies(
    cookies: Array<{ name?: string; value?: string; domain?: string; path?: string }>
): ConsentCacheCookie[] {
    const result: ConsentCacheCookie[] = [];
    for (const cookie of cookies) {
        const name = String(cookie.name || '').trim();
        if (!name || !is_cmp_consent_cookie_name(name)) continue;
        const value = String(cookie.value ?? '');
        if (!value) continue;
        result.push({
            name,
            value,
            domain: String(cookie.domain || '').trim() || '',
            path: String(cookie.path || '/').trim() || '/',
        });
    }
    return result;
}

export function filter_cmp_local_storage(entries: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(entries)) {
        if (!is_cmp_consent_local_storage_key(key)) continue;
        const trimmed = String(value ?? '').trim();
        if (!trimmed) continue;
        result[key] = trimmed;
    }
    return result;
}

export function is_consent_cache_entry_expired(
    entry: ConsentCacheSnapshot,
    ttl_days = DEFAULT_CONSENT_CACHE_TTL_DAYS,
    now = Date.now()
): boolean {
    const updated = Date.parse(entry.updated_at);
    if (Number.isNaN(updated)) return true;
    const ttl_ms = ttl_days * 24 * 60 * 60 * 1000;
    return now - updated > ttl_ms;
}

export function merge_consent_snapshots(
    base: ConsentCacheSnapshot | null,
    incoming: ConsentCacheSnapshot
): ConsentCacheSnapshot {
    if (!base) {
        return { ...incoming };
    }

    const base_time = Date.parse(base.updated_at);
    const incoming_time = Date.parse(incoming.updated_at);
    const incoming_is_newer = !Number.isNaN(incoming_time)
        && (Number.isNaN(base_time) || incoming_time >= base_time);

    const primary = incoming_is_newer ? incoming : base;
    const secondary = incoming_is_newer ? base : incoming;

    const cookies_by_name = new Map<string, ConsentCacheCookie>();
    for (const cookie of secondary.cookies) {
        cookies_by_name.set(cookie.name, cookie);
    }
    for (const cookie of primary.cookies) {
        cookies_by_name.set(cookie.name, cookie);
    }

    return {
        domain: incoming.domain,
        updated_at: primary.updated_at,
        source: 'merged',
        cookies: [...cookies_by_name.values()],
        local_storage: { ...secondary.local_storage, ...primary.local_storage },
    };
}

export function has_usable_consent_snapshot(snapshot: ConsentCacheSnapshot | null): boolean {
    if (!snapshot) return false;
    if (is_consent_cache_entry_expired(snapshot)) return false;
    return snapshot.cookies.length > 0 || Object.keys(snapshot.local_storage).length > 0;
}

/**
 * @fileoverview Regler för att blockera CMP-nätverksanrop vid skärmdump (testbar utan Puppeteer).
 */

export const CMP_BLOCK_DOMAIN_SUFFIXES = [
    'consent.cookiebot.com',
    'consentcdn.cookiebot.com',
    'cdn.cookielaw.org',
    'geolocation.onetrust.com',
    'sdk.privacy-center.org',
    'privacy-center.org',
    'app.usercentrics.eu',
    'api.usercentrics.eu',
    'cmp.quantcast.com',
    'cdn.kiprotect.com',
    'policy.app.cookieinformation.com',
    'cdn-cookieyes.com',
    'cmp.osano.com',
    'consent.trustarc.com',
    'cdn.consentmanager.net',
    'delivery.consentmanager.net',
    'static.axept.io',
    'cdn.axept.io',
    // Sourcepoint / Schibsted
    'privacy-mgmt.com',
    'privacy.schibsted.com',
    'sourcepoint.mgr.consensu.org',
] as const;

/** Schibsted first-party CMP på t.ex. cmp.svd.se — blockeras via prefix. */
export const CMP_BLOCK_HOSTNAME_PREFIXES = ['cmp.'] as const;

export const CMP_BLOCK_PATH_PATTERNS = [
    /cookie-consent/i,
    /\/consent\//i,
    /\/cmp\//i,
    /\/cookiebot\//i,
    /\/klaro\//i,
    /axeptio/i,
    /consentmanager/i,
    /gdpr-bundle/i,
    /sourcepoint/i,
    /privacy-mgmt/i,
] as const;

export const CMP_BLOCKABLE_RESOURCE_TYPES = new Set([
    'script',
    'stylesheet',
    'xhr',
    'fetch',
    'image',
]);

export function hostname_matches_cmp_block_suffix(hostname: string): boolean {
    const normalized = String(hostname || '').toLowerCase();
    if (!normalized) return false;
    return CMP_BLOCK_DOMAIN_SUFFIXES.some(
        (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`)
    );
}

export function hostname_matches_cmp_block_prefix(hostname: string): boolean {
    const normalized = String(hostname || '').toLowerCase();
    if (!normalized) return false;
    return CMP_BLOCK_HOSTNAME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function pathname_matches_cmp_block_pattern(pathname: string): boolean {
    const normalized = String(pathname || '');
    if (!normalized) return false;
    return CMP_BLOCK_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function should_block_cmp_request(url: string, resource_type: string): boolean {
    const type = String(resource_type || '').toLowerCase();
    if (!CMP_BLOCKABLE_RESOURCE_TYPES.has(type)) {
        return false;
    }

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }

    if (hostname_matches_cmp_block_suffix(parsed.hostname)) {
        return true;
    }

    if (hostname_matches_cmp_block_prefix(parsed.hostname)) {
        return true;
    }

    return pathname_matches_cmp_block_pattern(parsed.pathname);
}

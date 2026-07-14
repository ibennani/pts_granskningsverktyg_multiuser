/**
 * @fileoverview Regler för att blockera CMP-nätverksanrop vid skärmdump (testbar utan Puppeteer).
 */

import {
    hostname_matches_cmp_network_prefix,
    hostname_matches_cmp_network_substring,
    hostname_matches_cmp_vendor_suffix,
    pathname_matches_cmp_network_substring,
} from './page_screenshot_cmp_pattern_families.js';

export {
    CMP_NETWORK_VENDOR_SUFFIXES as CMP_BLOCK_DOMAIN_SUFFIXES,
    CMP_NETWORK_HOSTNAME_PREFIXES as CMP_BLOCK_HOSTNAME_PREFIXES,
} from './page_screenshot_cmp_pattern_families.js';

export const CMP_BLOCKABLE_RESOURCE_TYPES = new Set([
    'script',
    'stylesheet',
    'xhr',
    'fetch',
    'image',
]);

export function hostname_matches_cmp_block_suffix(hostname: string): boolean {
    return hostname_matches_cmp_vendor_suffix(hostname);
}

export function hostname_matches_cmp_block_prefix(hostname: string): boolean {
    return hostname_matches_cmp_network_prefix(hostname);
}

export function hostname_matches_cmp_block_substring(hostname: string): boolean {
    return hostname_matches_cmp_network_substring(hostname);
}

export function pathname_matches_cmp_block_pattern(pathname: string): boolean {
    return pathname_matches_cmp_network_substring(pathname);
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

    if (hostname_matches_cmp_vendor_suffix(parsed.hostname)) {
        return true;
    }

    if (hostname_matches_cmp_network_prefix(parsed.hostname)) {
        return true;
    }

    if (hostname_matches_cmp_network_substring(parsed.hostname)) {
        return true;
    }

    return pathname_matches_cmp_network_substring(parsed.pathname);
}

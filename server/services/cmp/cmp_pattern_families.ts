/**
 * @fileoverview CMP-mönsterfamiljer för sidrapporter (testbar utan Puppeteer).
 */
import {
    CMP_BUTTON_ACCEPT_ALL_TEXT_PATTERNS,
    CMP_BUTTON_ACCEPT_TEXT_PATTERNS,
    CMP_BUTTON_GENERIC_REQUIRES_CONTEXT_PATTERNS,
    CMP_BUTTON_REJECT_TEXT_PATTERNS,
    CMP_CONSENT_CONTEXT_KEYWORDS,
    CMP_GENERIC_ACCEPT_SELECTORS,
    CMP_GENERIC_CONTAINER_SELECTORS,
    CMP_GENERIC_HIDE_SELECTORS,
    CMP_NETWORK_HOSTNAME_PREFIXES,
    CMP_NETWORK_HOSTNAME_SUBSTRINGS,
    CMP_NETWORK_PATH_SUBSTRINGS as GENERIC_NETWORK_PATH_SUBSTRINGS,
    CMP_OVERLAY_MIN_VIEWPORT_WIDTH_RATIO,
    CMP_OVERLAY_MIN_Z_INDEX,
    CMP_OVERLAY_POSITIONS,
    CMP_STORAGE_COOKIE_CONSENT_TOKENS,
    CMP_STORAGE_LOCAL_STORAGE_CONSENT_TOKENS,
} from './cmp_generic_patterns.js';
import {
    collect_cookie_name_regexes,
    collect_exact_cookie_names,
    collect_exact_local_storage_keys,
    collect_local_storage_regexes,
    collect_network_suffixes,
    collect_path_substrings,
    collect_selectors,
} from './cmp_vendor_merge.js';
import { CMP_VENDORS } from './cmp_vendors/registry.js';

const GENERIC_COOKIE_REGEXES = [/^euconsent/i] as const;
const GENERIC_LOCAL_STORAGE_REGEXES = [/klaro/i] as const;

export const CMP_NETWORK_VENDOR_SUFFIXES = collect_network_suffixes(CMP_VENDORS);

export const CMP_STORAGE_EXACT_COOKIE_NAMES = collect_exact_cookie_names(CMP_VENDORS);
export const CMP_STORAGE_EXACT_LOCAL_STORAGE_KEYS = collect_exact_local_storage_keys(CMP_VENDORS);
export const CMP_STORAGE_COOKIE_NAME_REGEXES = collect_cookie_name_regexes(
    CMP_VENDORS,
    [...GENERIC_COOKIE_REGEXES]
);
export const CMP_STORAGE_LOCAL_STORAGE_REGEXES = collect_local_storage_regexes(
    CMP_VENDORS,
    [...GENERIC_LOCAL_STORAGE_REGEXES]
);

export const CMP_NETWORK_PATH_SUBSTRINGS = collect_path_substrings(
    CMP_VENDORS,
    GENERIC_NETWORK_PATH_SUBSTRINGS
);

export {
    CMP_NETWORK_HOSTNAME_PREFIXES,
    CMP_NETWORK_HOSTNAME_SUBSTRINGS,
    CMP_STORAGE_COOKIE_CONSENT_TOKENS,
    CMP_STORAGE_LOCAL_STORAGE_CONSENT_TOKENS,
};

export const CMP_VENDOR_SCHIBSTED = {
    block_hostname_suffixes: [] as string[],
    accept_button_selectors: collect_selectors(
        CMP_VENDORS.filter((v) => v.id === 'schibsted_sourcepoint'),
        'accept_button_selectors',
        []
    ),
    banner_container_selectors: collect_selectors(
        CMP_VENDORS.filter((v) => v.id === 'schibsted_sourcepoint'),
        'banner_container_selectors',
        []
    ),
} as const;

export const CMP_VENDOR_GENERIC_ACCEPT_SELECTORS = CMP_GENERIC_ACCEPT_SELECTORS;
export const CMP_VENDOR_GENERIC_CONTAINER_SELECTORS = collect_selectors(
    CMP_VENDORS,
    'banner_container_selectors',
    CMP_GENERIC_CONTAINER_SELECTORS
);
export const CMP_VENDOR_GENERIC_HIDE_SELECTORS = collect_selectors(
    CMP_VENDORS,
    'hide_selectors',
    CMP_GENERIC_HIDE_SELECTORS
);

export type OverlayDetectionConfig = {
    consent_context_keywords: string[];
    min_viewport_width_ratio: number;
    min_z_index: number;
    positions: string[];
};

export function normalize_cmp_text(raw: string): string {
    return String(raw || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

export function hostname_matches_cmp_vendor_suffix(hostname: string): boolean {
    const normalized = normalize_cmp_text(hostname);
    if (!normalized) return false;
    return CMP_NETWORK_VENDOR_SUFFIXES.some(
        (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`)
    );
}

export function hostname_matches_cmp_network_prefix(hostname: string): boolean {
    const normalized = normalize_cmp_text(hostname);
    if (!normalized) return false;
    return CMP_NETWORK_HOSTNAME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function hostname_matches_cmp_network_substring(hostname: string): boolean {
    const normalized = normalize_cmp_text(hostname);
    if (!normalized) return false;
    return CMP_NETWORK_HOSTNAME_SUBSTRINGS.some((part) => normalized.includes(part));
}

export function pathname_matches_cmp_network_substring(pathname: string): boolean {
    const normalized = String(pathname || '').toLowerCase();
    if (!normalized) return false;
    return CMP_NETWORK_PATH_SUBSTRINGS.some((part) => normalized.includes(part.toLowerCase()));
}

export function element_text_suggests_consent(text: string): boolean {
    const normalized = normalize_cmp_text(text);
    if (!normalized) return false;
    return CMP_CONSENT_CONTEXT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function button_label_requires_consent_context(label: string): boolean {
    const normalized = normalize_cmp_text(label);
    if (!normalized) return false;
    return CMP_BUTTON_GENERIC_REQUIRES_CONTEXT_PATTERNS.some((pattern) =>
        normalized.includes(pattern)
    );
}

export function matches_cmp_storage_cookie_name(name: string): boolean {
    const trimmed = String(name || '').trim();
    if (!trimmed) return false;

    if (CMP_STORAGE_EXACT_COOKIE_NAMES.some((exact) => exact === trimmed)) {
        return true;
    }

    if (CMP_STORAGE_COOKIE_NAME_REGEXES.some((regex) => regex.test(trimmed))) {
        return true;
    }

    const lower = trimmed.toLowerCase();
    if (!lower.includes('consent')) {
        return false;
    }

    return CMP_STORAGE_COOKIE_CONSENT_TOKENS.some((token) => lower.includes(token));
}

export function matches_cmp_storage_local_storage_key(key: string): boolean {
    const trimmed = String(key || '').trim();
    if (!trimmed) return false;

    if (CMP_STORAGE_EXACT_LOCAL_STORAGE_KEYS.some((exact) => exact === trimmed)) {
        return true;
    }

    if (CMP_STORAGE_LOCAL_STORAGE_REGEXES.some((regex) => regex.test(trimmed))) {
        return true;
    }

    const lower = trimmed.toLowerCase();
    if (!lower.includes('consent')) {
        return false;
    }

    return CMP_STORAGE_LOCAL_STORAGE_CONSENT_TOKENS.some((token) => lower.includes(token));
}

export function build_overlay_detection_config(): OverlayDetectionConfig {
    return {
        consent_context_keywords: [...CMP_CONSENT_CONTEXT_KEYWORDS],
        min_viewport_width_ratio: CMP_OVERLAY_MIN_VIEWPORT_WIDTH_RATIO,
        min_z_index: CMP_OVERLAY_MIN_Z_INDEX,
        positions: [...CMP_OVERLAY_POSITIONS],
    };
}

export function build_cmp_accept_button_selectors(): string[] {
    return collect_selectors(CMP_VENDORS, 'accept_button_selectors', CMP_GENERIC_ACCEPT_SELECTORS);
}

export function build_cmp_banner_container_selectors(): string[] {
    return collect_selectors(
        CMP_VENDORS,
        'banner_container_selectors',
        CMP_GENERIC_CONTAINER_SELECTORS
    );
}

export function build_cmp_banner_hide_selectors(): string[] {
    return [...new Set([
        ...build_cmp_banner_container_selectors(),
        ...collect_selectors(CMP_VENDORS, 'hide_selectors', CMP_GENERIC_HIDE_SELECTORS),
    ])];
}

export {
    CMP_BUTTON_ACCEPT_ALL_TEXT_PATTERNS,
    CMP_BUTTON_ACCEPT_TEXT_PATTERNS,
    CMP_BUTTON_GENERIC_REQUIRES_CONTEXT_PATTERNS,
    CMP_BUTTON_REJECT_TEXT_PATTERNS,
    CMP_CONSENT_CONTEXT_KEYWORDS,
};

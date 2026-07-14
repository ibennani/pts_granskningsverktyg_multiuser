/**
 * @fileoverview Mönsterfamiljer för CMP-hantering vid skärmdump (testbar utan Puppeteer).
 * Lägg bara till leverantörspaket här om mönsterfamiljer misslyckas på en känd stor sajt.
 */

/** --- Nätverksfamilj --- */

export const CMP_NETWORK_VENDOR_SUFFIXES = [
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
    'privacy-mgmt.com',
    'privacy.schibsted.com',
    'sourcepoint.mgr.consensu.org',
] as const;

export const CMP_NETWORK_HOSTNAME_PREFIXES = ['cmp.'] as const;

export const CMP_NETWORK_HOSTNAME_SUBSTRINGS = [
    'consent',
    'cookiebot',
    'onetrust',
    'privacy',
    'gdpr',
    'cookie',
    'cmp.',
    'usercentrics',
    'didomi',
    'axept',
    'osano',
    'trustarc',
    'klaro',
    'sourcepoint',
] as const;

export const CMP_NETWORK_PATH_SUBSTRINGS = [
    'cookie-consent',
    '/consent/',
    '/cmp/',
    '/cookiebot/',
    '/klaro/',
    'axeptio',
    'consentmanager',
    'gdpr-bundle',
    'sourcepoint',
    'privacy-mgmt',
] as const;

/** --- Knapp-heuristik --- */

export const CMP_BUTTON_ACCEPT_ALL_TEXT_PATTERNS = [
    'godkänn alla cookies',
    'godkänn alla',
    'acceptera alla',
    'tillåt alla',
    'accept all',
    'allow all',
    'alla kakor',
    'all cookies',
] as const;

export const CMP_BUTTON_REJECT_TEXT_PATTERNS = [
    'avvisa',
    'avslå',
    'neka',
    'reject',
    'deny',
    'decline',
    'endast nödvänd',
    'necessary only',
    'only necessary',
    'reject all',
    'avvisa alla',
] as const;

export const CMP_BUTTON_ACCEPT_TEXT_PATTERNS = [
    'godkänn',
    'acceptera',
    'tillåt',
    'accept',
    'allow',
    'jag förstår',
    'jag forstår',
    'jag accepterar',
    'samtycker',
    'ok',
    'agree',
    'yes',
    'ja',
    'continue',
    'fortsätt',
    'got it',
] as const;

/** Generiska knappar som kräver consent-kontext i närliggande text. */
export const CMP_BUTTON_GENERIC_REQUIRES_CONTEXT_PATTERNS = [
    'ok',
    'agree',
    'yes',
    'ja',
    'continue',
    'fortsätt',
    'got it',
    'jag förstår',
    'jag forstår',
] as const;

export const CMP_CONSENT_CONTEXT_KEYWORDS = [
    'cookie',
    'cookies',
    'kakor',
    'kaka',
    'samtycke',
    'consent',
    'gdpr',
    'integritet',
    'privacy',
    'personuppgift',
] as const;

/** --- Overlay-detektor --- */

export const CMP_OVERLAY_MIN_VIEWPORT_WIDTH_RATIO = 0.35;
export const CMP_OVERLAY_MIN_Z_INDEX = 100;
export const CMP_OVERLAY_POSITIONS = ['fixed', 'sticky'] as const;

export type OverlayDetectionConfig = {
    consent_context_keywords: string[];
    min_viewport_width_ratio: number;
    min_z_index: number;
    positions: string[];
};

/** --- Lagringsfamilj --- */

export const CMP_STORAGE_EXACT_COOKIE_NAMES = [
    'CookieConsent',
    'OptanonConsent',
    'OptanonAlertBoxClosed',
    'uc_user_interaction',
    'CookieInformationConsent',
] as const;

export const CMP_STORAGE_EXACT_LOCAL_STORAGE_KEYS = [
    'didomi_token',
    'didomi_config',
    'klaro',
    'uc_settings',
] as const;

export const CMP_STORAGE_COOKIE_NAME_REGEXES = [
    /^optanon/i,
    /^didomi/i,
    /^uc_/i,
    /^euconsent/i,
    /^sp_consent/i,
] as const;

export const CMP_STORAGE_COOKIE_CONSENT_TOKENS = [
    'cookie',
    'optanon',
    'didomi',
    'euconsent',
    'sp_',
    'uc_',
    'cmp',
    'gdpr',
] as const;

export const CMP_STORAGE_LOCAL_STORAGE_REGEXES = [
    /^didomi/i,
    /^uc_/i,
    /klaro/i,
] as const;

export const CMP_STORAGE_LOCAL_STORAGE_CONSENT_TOKENS = [
    'consent',
    'didomi',
    'klaro',
    'uc_',
    'cmp',
] as const;

/**
 * Leverantörspaket: lägg bara till här om mönsterfamiljer misslyckas på känd stor sajt.
 */
export const CMP_VENDOR_SCHIBSTED = {
    block_hostname_suffixes: [] as string[],
    accept_button_selectors: [
        'button.sp_choice_type_11',
        'button.sp_choice_type_ACCEPT_ALL',
        'button[title="Godkänn alla cookies"]',
        'button[title="Godkänn alla"]',
        '#notice button[title="Godkänn alla cookies"]',
        '#notice button[title="Godkänn alla"]',
    ],
    banner_container_selectors: [
        '#sp-cc',
        '[id^="sp_message_container_"]',
        '[id^="sp_message_iframe"]',
        '#notice',
        '.sch-datacontroller',
        '#schibsted-data-controller-sticky',
        '.schibsted-data-controller',
    ],
} as const;

export const CMP_VENDOR_GENERIC_ACCEPT_SELECTORS = [
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '#CybotCookiebotDialogBodyButtonAccept',
    '#onetrust-accept-btn-handler',
    '#didomi-notice-agree-button',
    '#truste-consent-button',
    '#ccc-notify-accept',
    '.osano-cm-accept-all',
    '.cm-btn-success',
    'button[data-testid="cookie-accept"]',
    'button.cookie-accept',
    'button[id*="accept"]',
    'button[class*="accept"]',
    'button[id*="accept-all"]',
    'button[class*="accept-all"]',
    '#cookie_action_close_header',
    '.coi-banner__accept',
    '#c-p-bn',
] as const;

export const CMP_VENDOR_GENERIC_CONTAINER_SELECTORS = [
    '#CybotCookiebotDialog',
    '#onetrust-banner-sdk',
    '#onetrust-consent-sdk',
    '.qc-cmp2-container',
    '#didomi-host',
    '#didomi-notice',
    '[id*="cookie"]',
    '[class*="cookie"]',
    '[id*="consent"]',
    '[class*="consent"]',
    '[aria-label*="cookie"]',
    '[aria-label*="kakor"]',
    '[role="dialog"]',
    '#usercentrics-root',
    '.cookieyes-banner',
    '#cookiebanner',
    '#cookie-law-info-bar',
    '.cookie-law-info-bar',
    '#cookiescript_injected',
    '#klaro',
    'div#cc--main',
    '.silktide-banner',
    '#civic-cookie-control',
    '.coi-overlay',
    '#onetrust-pc-sdk',
    '.modal-backdrop',
] as const;

export const CMP_VENDOR_GENERIC_HIDE_SELECTORS = [
    '#cookiebanner',
    '.cookie-banner',
    '.cookie-notice',
    '.cookie-modal',
    '.cookie-overlay',
    '.cookie-consent',
    '[data-cookiebanner]',
    '[class*="CookieConsent"]',
    '[id*="CookieConsent"]',
    '.ch2-container',
    '.ch2-dialog',
] as const;

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
    return [
        ...CMP_VENDOR_GENERIC_ACCEPT_SELECTORS,
        ...CMP_VENDOR_SCHIBSTED.accept_button_selectors,
    ];
}

export function build_cmp_banner_container_selectors(): string[] {
    return [
        ...CMP_VENDOR_GENERIC_CONTAINER_SELECTORS,
        ...CMP_VENDOR_SCHIBSTED.banner_container_selectors,
    ];
}

export function build_cmp_banner_hide_selectors(): string[] {
    return [...new Set([
        ...build_cmp_banner_container_selectors(),
        ...CMP_VENDOR_GENERIC_HIDE_SELECTORS,
    ])];
}

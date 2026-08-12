/**
 * @fileoverview Generiska CMP-mönster (ej leverantörsspecifika).
 */

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
    'termly',
    'iubenda',
    'complianz',
    'borlabs',
    'cookiefirst',
    'tarteaucitron',
    'tagcommander',
    'trustcommander',
    'devowl',
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
    'real-cookie-banner',
    'complianz',
    'borlabs',
    'cookiefirst',
    'tarteaucitron',
] as const;

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

export const CMP_OVERLAY_MIN_VIEWPORT_WIDTH_RATIO = 0.35;
export const CMP_OVERLAY_MIN_Z_INDEX = 100;
export const CMP_OVERLAY_POSITIONS = ['fixed', 'sticky'] as const;

export const CMP_STORAGE_COOKIE_CONSENT_TOKENS = [
    'cookie',
    'optanon',
    'didomi',
    'euconsent',
    'sp_',
    'uc_',
    'cmp',
    'gdpr',
    'cmplz',
    'borlabs',
    'termly',
    'iubenda',
] as const;

export const CMP_STORAGE_LOCAL_STORAGE_CONSENT_TOKENS = [
    'consent',
    'didomi',
    'klaro',
    'uc_',
    'cmp',
    'cmplz',
    'borlabs',
    'termly',
    'iubenda',
    'cookiefirst',
] as const;

export const CMP_GENERIC_ACCEPT_SELECTORS = [
    'button[data-testid="cookie-accept"]',
    'button.cookie-accept',
    'button[id*="accept"]',
    'button[class*="accept"]',
    'button[id*="accept-all"]',
    'button[class*="accept-all"]',
    '#cookie_action_close_header',
    '.coi-banner__accept',
    '#c-p-bn',
    '.cm-btn-success',
] as const;

export const CMP_GENERIC_CONTAINER_SELECTORS = [
    '[id*="cookie"]',
    '[class*="cookie"]',
    '[id*="consent"]',
    '[class*="consent"]',
    '[aria-label*="cookie"]',
    '[aria-label*="kakor"]',
    '[role="dialog"]',
    '#cookiebanner',
    '.modal-backdrop',
] as const;

export const CMP_GENERIC_HIDE_SELECTORS = [
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

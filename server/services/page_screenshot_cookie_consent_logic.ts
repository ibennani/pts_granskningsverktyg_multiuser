/**
 * @fileoverview Regler för att hitta och acceptera cookie-banners (testbar utan Puppeteer).
 */

/** Vanliga «acceptera»-knappar hos etablerade CMP:er. */
export const COOKIE_ACCEPT_BUTTON_SELECTORS = [
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
    // Sourcepoint (Schibsted m.fl.)
    'button.sp_choice_type_11',
    'button.sp_choice_type_ACCEPT_ALL',
    'button[title="Godkänn alla cookies"]',
    'button[title="Godkänn alla"]',
    '#notice button[title="Godkänn alla cookies"]',
    '#notice button[title="Godkänn alla"]',
    'button[id*="accept"]',
    'button[class*="accept"]',
    'button[id*="accept-all"]',
    'button[class*="accept-all"]',
    '#cookie_action_close_header',
    '.coi-banner__accept',
    '#c-p-bn',
] as const;

/** Textmönster som indikerar avvisning — ska inte klickas. */
export const COOKIE_REJECT_TEXT_PATTERNS = [
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

/** Textmönster för «acceptera alla» — högre prioritet än generisk accept. */
export const COOKIE_ACCEPT_ALL_TEXT_PATTERNS = [
    'godkänn alla cookies',
    'godkänn alla',
    'acceptera alla',
    'tillåt alla',
    'accept all',
    'allow all',
    'alla kakor',
    'all cookies',
] as const;

/** Textmönster som indikerar acceptera / godkänn (lägre prioritet). */
export const COOKIE_ACCEPT_TEXT_PATTERNS = [
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

export const COOKIE_BANNER_CONTAINER_SELECTORS = [
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
    '#sp-cc',
    '[id^="sp_message_container_"]',
    '[id^="sp_message_iframe"]',
    '#notice',
    '.sch-datacontroller',
    '#schibsted-data-controller-sticky',
    '.schibsted-data-controller',
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

/** Bredare lista — döljer visuellt före skärmdump även om klick misslyckades. */
export const COOKIE_BANNER_HIDE_SELECTORS = [
    ...COOKIE_BANNER_CONTAINER_SELECTORS,
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

export function normalize_button_label(raw: string): string {
    return String(raw || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

export function is_cookie_reject_button_label(label: string): boolean {
    const normalized = normalize_button_label(label);
    if (!normalized) return false;
    return COOKIE_REJECT_TEXT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function is_cookie_accept_all_button_label(label: string): boolean {
    const normalized = normalize_button_label(label);
    if (!normalized) return false;
    if (is_cookie_reject_button_label(normalized)) return false;
    return COOKIE_ACCEPT_ALL_TEXT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function is_cookie_accept_button_label(label: string): boolean {
    const normalized = normalize_button_label(label);
    if (!normalized) return false;
    if (is_cookie_reject_button_label(normalized)) return false;
    if (is_cookie_accept_all_button_label(normalized)) return true;
    return COOKIE_ACCEPT_TEXT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function get_cookie_accept_label_priority(label: string): number {
    if (is_cookie_accept_all_button_label(label)) return 2;
    if (is_cookie_accept_button_label(label)) return 1;
    return 0;
}

export function build_cookie_banner_dismiss_config() {
    return {
        accept_selectors: [...COOKIE_ACCEPT_BUTTON_SELECTORS],
        accept_all_text_patterns: [...COOKIE_ACCEPT_ALL_TEXT_PATTERNS],
        accept_text_patterns: [...COOKIE_ACCEPT_TEXT_PATTERNS],
        reject_text_patterns: [...COOKIE_REJECT_TEXT_PATTERNS],
        container_selectors: [...COOKIE_BANNER_CONTAINER_SELECTORS],
    };
}

export function build_cookie_banner_hide_config() {
    return {
        hide_selectors: [...new Set(COOKIE_BANNER_HIDE_SELECTORS)],
    };
}

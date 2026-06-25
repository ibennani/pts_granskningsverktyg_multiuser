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
    'button[id*="accept"]',
    'button[class*="accept"]',
    'a[class*="accept"]',
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

/** Textmönster som indikerar acceptera alla / godkänn. */
export const COOKIE_ACCEPT_TEXT_PATTERNS = [
    'godkänn alla',
    'acceptera alla',
    'tillåt alla',
    'accept all',
    'allow all',
    'godkänn',
    'acceptera',
    'tillåt',
    'accept',
    'allow',
    'jag förstår',
    'jag forstår',
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
    '[role="alertdialog"]',
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

export function is_cookie_accept_button_label(label: string): boolean {
    const normalized = normalize_button_label(label);
    if (!normalized) return false;
    if (is_cookie_reject_button_label(normalized)) return false;
    return COOKIE_ACCEPT_TEXT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function build_cookie_banner_dismiss_config() {
    return {
        accept_selectors: [...COOKIE_ACCEPT_BUTTON_SELECTORS],
        accept_text_patterns: [...COOKIE_ACCEPT_TEXT_PATTERNS],
        reject_text_patterns: [...COOKIE_REJECT_TEXT_PATTERNS],
        container_selectors: [...COOKIE_BANNER_CONTAINER_SELECTORS],
    };
}

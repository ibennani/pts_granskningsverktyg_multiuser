/**
 * @fileoverview Mönster för störande overlays (nyhetsbrev, kampanj, chatt m.m.) vid skärmdump.
 */

export const INTRUSIVE_OVERLAY_NEWSLETTER_KEYWORDS = [
    'nyhetsbrev',
    'newsletter',
    'prenumerera',
    'subscribe',
    'sign up for',
    'mailing list',
] as const;

export const INTRUSIVE_OVERLAY_PROMO_KEYWORDS = [
    'rabatt',
    'erbjudande',
    'kampanj',
    'discount',
    'coupon',
    'kupong',
    'spara ',
    'save ',
    '% rabatt',
    '% off',
] as const;

export const INTRUSIVE_OVERLAY_APP_KEYWORDS = [
    'ladda ner app',
    'download app',
    'app store',
    'google play',
    'get the app',
    'hämta app',
] as const;

export const INTRUSIVE_OVERLAY_CHAT_KEYWORDS = [
    'chatta med oss',
    'live chat',
    'chat with us',
    'zendesk',
    'intercom',
    'crisp',
    'messenger',
    'kundservice chatt',
] as const;

export const INTRUSIVE_OVERLAY_GENERIC_KEYWORDS = [
    'popup',
    'pop-up',
    'modal',
] as const;

export const INTRUSIVE_OVERLAY_CONTEXT_KEYWORDS = [
    ...INTRUSIVE_OVERLAY_NEWSLETTER_KEYWORDS,
    ...INTRUSIVE_OVERLAY_PROMO_KEYWORDS,
    ...INTRUSIVE_OVERLAY_APP_KEYWORDS,
    ...INTRUSIVE_OVERLAY_CHAT_KEYWORDS,
] as const;

export const INTRUSIVE_OVERLAY_CLOSE_TEXT_PATTERNS = [
    'stäng',
    'close',
    '×',
    '✕',
    'x',
    'nej tack',
    'no thanks',
    'inte nu',
    'not now',
    'hoppa över',
    'skip',
    'maybe later',
    'avbryt',
    'dismiss',
    'fortsätt utan',
    'continue without',
    'nej, tack',
] as const;

export const INTRUSIVE_OVERLAY_REJECT_TEXT_PATTERNS = [
    'prenumerera',
    'subscribe',
    'sign up',
    'registrera',
    'register',
    'skicka',
    'submit',
    'godkänn alla',
    'accept all',
    'godkänn',
    'acceptera',
    'tillåt alla',
    'allow all',
    'start chat',
    'starta chatt',
    'open chat',
    'öppna chatt',
] as const;

export const INTRUSIVE_OVERLAY_CLOSE_BUTTON_SELECTORS = [
    'button[aria-label*="close" i]',
    'button[aria-label*="stäng" i]',
    'button[title*="close" i]',
    'button[title*="stäng" i]',
    '[role="button"][aria-label*="close" i]',
    '[role="button"][aria-label*="stäng" i]',
    'button.close',
    'button.dismiss',
    '.modal-close',
    '.popup-close',
    '[class*="close-button"]',
    '[class*="closeButton"]',
    '[data-testid*="close"]',
    '[data-action="close"]',
] as const;

export const INTRUSIVE_OVERLAY_CONTAINER_SELECTORS = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    'dialog[open]',
    '.modal',
    '.popup',
    '.lightbox',
    '[class*="newsletter"]',
    '[id*="newsletter"]',
    '[class*="Newsletter"]',
    '[id*="Newsletter"]',
    '[class*="popup"]',
    '[id*="popup"]',
] as const;

export const INTRUSIVE_OVERLAY_HIDE_SELECTORS = [
    '#intercom-container',
    '.intercom-lightweight-app',
    '.crisp-client',
    '#launcher',
    '[class*="zendesk"]',
    '#hubspot-messages-iframe-container',
    '.hs-messages-widget',
    '.drift-frame-controller',
    '.tidio-chat',
    '[id*="livechat"]',
    '[class*="livechat"]',
] as const;

/** Chatt-widgets: dölj utan att klicka (undvik att öppna chatt). */
export const INTRUSIVE_OVERLAY_CHAT_HIDE_ONLY_SELECTORS = [
    '#intercom-container',
    '.intercom-lightweight-app',
    '.crisp-client',
    '#launcher',
    '[class*="zendesk"]',
    '#hubspot-messages-iframe-container',
    '.hs-messages-widget',
    '.drift-frame-controller',
    '.tidio-chat',
] as const;

export const INTRUSIVE_OVERLAY_MIN_Z_INDEX = 50;
export const INTRUSIVE_OVERLAY_BACKDROP_MIN_COVERAGE_RATIO = 0.25;
export const INTRUSIVE_OVERLAY_DIALOG_MIN_WIDTH_RATIO = 0.15;
export const INTRUSIVE_OVERLAY_POSITIONS = ['fixed', 'sticky', 'absolute'] as const;

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

export const INTRUSIVE_OVERLAY_MEMBERSHIP_KEYWORDS = [
    'bli medlem',
    'become a member',
    'join now',
    'gå med',
    'sign up and save',
    'nästa köp',
    'next purchase',
    'your next order',
    'ditt nästa köp',
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
    '% på',
    '% off your',
    '10%',
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

export const INTRUSIVE_OVERLAY_SURVEY_KEYWORDS = [
    'hotjar',
    'usabilla',
    'feedback',
    'enkät',
    'survey',
    'opinion',
    'tyck till',
    'vad tycker du',
    'rate your experience',
] as const;

export const INTRUSIVE_OVERLAY_CONTEXT_KEYWORDS = [
    ...INTRUSIVE_OVERLAY_NEWSLETTER_KEYWORDS,
    ...INTRUSIVE_OVERLAY_MEMBERSHIP_KEYWORDS,
    ...INTRUSIVE_OVERLAY_PROMO_KEYWORDS,
    ...INTRUSIVE_OVERLAY_APP_KEYWORDS,
    ...INTRUSIVE_OVERLAY_CHAT_KEYWORDS,
    ...INTRUSIVE_OVERLAY_SURVEY_KEYWORDS,
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
    'lukk',
    'lukke',
    'schließen',
    'fermer',
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
    'button[aria-label*="lukk" i]',
    'button[aria-label*="lukke" i]',
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
    '[data-dismiss="modal"]',
    '[data-close]',
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
    '[class*="overlay"]',
    '[class*="Overlay"]',
    '[class*="modal-backdrop"]',
    '[data-modal]',
    '[data-testid*="modal"]',
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
    '#hotjar-survey',
    '._hj-widget-container',
    '#usabilla',
    '.usabilla_live_button_container',
] as const;

/**
 * Marknadsföringswidgets i Shadow DOM (t.ex. Triggerbee på nelly.com).
 * Döljer värd-elementet så hela popupen försvinner ur skärmdumpen.
 */
export const INTRUSIVE_OVERLAY_SHADOW_HOST_SELECTORS = [
    'triggerbee-widget',
    'klaviyo-form',
    'klaviyo-popup',
    'omnisend-form',
    'privy-container',
    'justuno-popup',
    'optinmonster',
    'mailchimp-embedded-form',
    'sleeknote-popup',
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
    ...INTRUSIVE_OVERLAY_SHADOW_HOST_SELECTORS,
] as const;

export const INTRUSIVE_OVERLAY_MIN_Z_INDEX = 50;
export const INTRUSIVE_OVERLAY_BACKDROP_MIN_COVERAGE_RATIO = 0.25;
export const INTRUSIVE_OVERLAY_DIALOG_MIN_WIDTH_RATIO = 0.12;
export const INTRUSIVE_OVERLAY_POSITIONS = ['fixed', 'sticky', 'absolute'] as const;

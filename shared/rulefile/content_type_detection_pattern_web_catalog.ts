/**
 * @fileoverview Katalog med detectionPattern för webb-regelfilens undertyper (matchas på visningsnamn).
 */

import { is_valid_content_type_detection_pattern } from './content_type_detection_pattern.js';

/** Alltid sant för icke-tom HTML — alla sidor antas innehålla text. */
export const WEB_TEXT_CONTENT_ALWAYS_TRUE_PATTERN = String.raw`[\s\S]`;

/**
 * Regelfilens undertyp-text (normaliserad) → regex-mönster för automatisk HTML-analys.
 * Nycklar är svenska visningsnamn i lowercase med normaliserade mellanslag.
 */
export const WEB_CONTENT_TYPE_DETECTION_PATTERNS_BY_LABEL: Readonly<Record<string, string>> = {
    text: WEB_TEXT_CONTENT_ALWAYS_TRUE_PATTERN,
    'roller och egenskaper i koden': String.raw`<(?:button|input|select|textarea|details|summary|dialog)\b|<a\b[^>]*\bhref\s*=|<[^>]+\s(?:role|aria-[\w-]+|tabindex|contenteditable)\s*=`,
    sidtitel: String.raw`<title\b[^>]*>[\s\S]*?<\/title\s*>`,
    'sidans språk': String.raw`<html\b[^>]*\blang\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>]+)`,
    rubriker: String.raw`<(?:h[1-6]\b|[a-z][\w:-]*\b(?=[^>]*\srole\s*=\s*(?:"heading"|'heading'|heading\b)))[^>]*>`,
    listor: String.raw`<(?:ul|ol|dl)\b|<[^>]+\srole\s*=\s*(?:"(?:list|directory)"|'(?:list|directory)'|(?:list|directory)\b)`,
    tabeller: String.raw`<table\b|<[^>]+\srole\s*=\s*(?:"(?:table|grid|treegrid)"|'(?:table|grid|treegrid)'|(?:table|grid|treegrid)\b)`,
    landmärken: String.raw`<(?:main|nav|aside)\b|<[^>]+\srole\s*=\s*(?:"(?:banner|navigation|main|complementary|contentinfo|search|form|region)"|'(?:banner|navigation|main|complementary|contentinfo|search|form|region)'|(?:banner|navigation|main|complementary|contentinfo|search|form|region)\b)`,
    landmarker: String.raw`<(?:main|nav|aside)\b|<[^>]+\srole\s*=\s*(?:"(?:banner|navigation|main|complementary|contentinfo|search|form|region)"|'(?:banner|navigation|main|complementary|contentinfo|search|form|region)'|(?:banner|navigation|main|complementary|contentinfo|search|form|region)\b)`,
    länkar: String.raw`<a\b[^>]*\bhref\s*=|<[^>]+\srole\s*=\s*(?:"link"|'link'|link\b)`,
    lankar: String.raw`<a\b[^>]*\bhref\s*=|<[^>]+\srole\s*=\s*(?:"link"|'link'|link\b)`,
    navigeringsmenyer: String.raw`<nav\b|<[^>]+\srole\s*=\s*(?:"(?:navigation|menu|menubar)"|'(?:navigation|menu|menubar)'|(?:navigation|menu|menubar)\b)`,
    inmatningsfält: String.raw`<(?:select|textarea)\b|<input\b(?![^>]*\btype\s*=\s*(?:"(?:button|submit|reset|image|hidden)"|'(?:button|submit|reset|image|hidden)'|(?:button|submit|reset|image|hidden)\b))|<[^>]+\srole\s*=\s*(?:"(?:textbox|searchbox|combobox|spinbutton|slider|listbox|checkbox|radio|switch)"|'(?:textbox|searchbox|combobox|spinbutton|slider|listbox|checkbox|radio|switch)'|(?:textbox|searchbox|combobox|spinbutton|slider|listbox|checkbox|radio|switch)\b)`,
    inmatningsfalt: String.raw`<(?:select|textarea)\b|<input\b(?![^>]*\btype\s*=\s*(?:"(?:button|submit|reset|image|hidden)"|'(?:button|submit|reset|image|hidden)'|(?:button|submit|reset|image|hidden)\b))|<[^>]+\srole\s*=\s*(?:"(?:textbox|searchbox|combobox|spinbutton|slider|listbox|checkbox|radio|switch)"|'(?:textbox|searchbox|combobox|spinbutton|slider|listbox|checkbox|radio|switch)'|(?:textbox|searchbox|combobox|spinbutton|slider|listbox|checkbox|radio|switch)\b)`,
    knappar: String.raw`<button\b|<input\b[^>]*\btype\s*=\s*(?:"(?:button|submit|reset|image)"|'(?:button|submit|reset|image)'|(?:button|submit|reset|image)\b)|<[^>]+\srole\s*=\s*(?:"button"|'button'|button\b)`,
    'formulär (helhet)': String.raw`<form\b|<[^>]+\srole\s*=\s*(?:"form"|'form'|form\b)`,
    'formular (helhet)': String.raw`<form\b|<[^>]+\srole\s*=\s*(?:"form"|'form'|form\b)`,
    'dialoger och modaler': String.raw`<dialog\b|<[^>]+\srole\s*=\s*(?:"(?:dialog|alertdialog)"|'(?:dialog|alertdialog)'|(?:dialog|alertdialog)\b)`,
    'komplexa interaktiva komponenter': String.raw`<details\b|<input\b[^>]*\btype\s*=\s*(?:"range"|'range'|range\b)|<[^>]+\srole\s*=\s*(?:"(?:tablist|slider|combobox|tree|listbox|menu|menubar|grid|treegrid|toolbar|spinbutton)"|'(?:tablist|slider|combobox|tree|listbox|menu|menubar|grid|treegrid|toolbar|spinbutton)'|(?:tablist|slider|combobox|tree|listbox|menu|menubar|grid|treegrid|toolbar|spinbutton)\b)`,
    'tabellkomponenter med interaktion': String.raw`<[^>]+\srole\s*=\s*(?:"(?:grid|treegrid)"|'(?:grid|treegrid)'|(?:grid|treegrid)\b)|<[^>]+\baria-sort\s*=`,
    bilder: String.raw`<(?:img|picture)\b|<input\b[^>]*\btype\s*=\s*(?:"image"|'image'|image\b)|<[^>]+\srole\s*=\s*(?:"img"|'img'|img\b)`,
    'video eller filmklipp': String.raw`<video\b|<source\b[^>]*\btype\s*=\s*["']?video\/|<iframe\b[^>]*\bsrc\s*=\s*["'][^"']*(?:youtube|youtu\.be|vimeo|wistia|dailymotion)`,
    ljudklipp: String.raw`<audio\b|<source\b[^>]*\btype\s*=\s*["']?audio\/`,
    'mediespelare för video': String.raw`<video\b|<iframe\b[^>]*\bsrc\s*=\s*["'][^"']*(?:youtube|youtu\.be|vimeo|wistia|dailymotion)`,
    'mediespelare for video': String.raw`<video\b|<iframe\b[^>]*\bsrc\s*=\s*["'][^"']*(?:youtube|youtu\.be|vimeo|wistia|dailymotion)`,
    'mediespelare för ljud': String.raw`<audio\b`,
    'mediespelare for ljud': String.raw`<audio\b`,
    'språk i delar av sidan': String.raw`<(?!html\b)[a-z][\w:-]*\b[^>]*\b(?:lang|xml:lang)\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>]+)`,
    'sprak i delar av sidan': String.raw`<(?!html\b)[a-z][\w:-]*\b[^>]*\b(?:lang|xml:lang)\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>]+)`,
    'animeringar utan ljud': String.raw`<(?:marquee|animate|animateTransform|animateMotion)\b`,
    'rörliga element': String.raw`<(?:marquee|animate|animateTransform|animateMotion)\b`,
    rorliga: String.raw`<(?:marquee|animate|animateTransform|animateMotion)\b`,
    'uppdaterande innehåll': String.raw`<[^>]+(?:\saria-live\s*=|\srole\s*=\s*(?:"(?:status|alert|log|timer)"|'(?:status|alert|log|timer)'|(?:status|alert|log|timer)\b))`,
    'uppdaterande innehall': String.raw`<[^>]+(?:\saria-live\s*=|\srole\s*=\s*(?:"(?:status|alert|log|timer)"|'(?:status|alert|log|timer)'|(?:status|alert|log|timer)\b))`,
    captcha: String.raw`(?:\bg-recaptcha\b|\bgrecaptcha\b|\brecaptcha\b|\bh-captcha\b|\bhcaptcha\b|\bcf-turnstile\b|challenges\.cloudflare\.com\/turnstile)`,
};

export function normalize_content_type_label(text: unknown): string {
    return String(text || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

/**
 * Returnerar katalogmönster för undertypens visningsnamn, eller null om ingen träff.
 */
export function resolve_web_detection_pattern_for_label(text: unknown): string | null {
    const key = normalize_content_type_label(text);
    if (!key) return null;
    const pattern = WEB_CONTENT_TYPE_DETECTION_PATTERNS_BY_LABEL[key];
    if (!pattern || !is_valid_content_type_detection_pattern(pattern)) return null;
    return pattern;
}

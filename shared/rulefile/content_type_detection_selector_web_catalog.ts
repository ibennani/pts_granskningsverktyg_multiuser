/**
 * @fileoverview Katalog med default CSS-selectorer för webb-regelfilens undertyper.
 */
import { is_valid_content_type_detection_selector } from './content_type_detection_selector.js';
import { normalize_content_type_label } from './content_type_detection_pattern_web_catalog.js';

export const WEB_CONTENT_TYPE_DETECTION_SELECTORS_BY_LABEL: Readonly<Record<string, string>> = {
    text: 'body',
    'roller och egenskaper i koden': 'button,input,select,textarea,details,summary,dialog,a[href],[role],[aria-label],[aria-labelledby],[aria-describedby],[tabindex],[contenteditable]',
    sidtitel: 'title',
    'sidans språk': 'html[lang]',
    rubriker: 'h1,h2,h3,h4,h5,h6,[role="heading"]',
    listor: 'ul,ol,dl,[role="list"],[role="directory"]',
    tabeller: 'table,[role="table"],[role="grid"],[role="treegrid"]',
    landmärken: 'header,main,footer,nav,aside,[role="banner"],[role="navigation"],[role="main"],[role="complementary"],[role="contentinfo"],[role="search"],[role="form"],[role="region"]',
    landmarker: 'header,main,footer,nav,aside,[role="banner"],[role="navigation"],[role="main"],[role="complementary"],[role="contentinfo"],[role="search"],[role="form"],[role="region"]',
    länkar: 'a[href],[role="link"]',
    lankar: 'a[href],[role="link"]',
    navigeringsmenyer: 'nav,[role="navigation"],[role="menu"],[role="menubar"]',
    inmatningsfält: 'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="hidden"]),select,textarea,[role="textbox"],[role="searchbox"],[role="combobox"],[role="spinbutton"],[role="slider"],[role="listbox"],[role="checkbox"],[role="radio"],[role="switch"]',
    inmatningsfalt: 'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="hidden"]),select,textarea,[role="textbox"],[role="searchbox"],[role="combobox"],[role="spinbutton"],[role="slider"],[role="listbox"],[role="checkbox"],[role="radio"],[role="switch"]',
    knappar: 'button,input[type="button"],input[type="submit"],input[type="reset"],input[type="image"],[role="button"]',
    'formulär (helhet)': 'form,[role="form"]',
    'formular (helhet)': 'form,[role="form"]',
    'dialoger och modaler': 'dialog,[role="dialog"],[role="alertdialog"],[aria-modal="true"]',
    'komplexa interaktiva komponenter': 'details,input[type="range"],[role="tablist"],[role="slider"],[role="combobox"],[role="tree"],[role="listbox"],[role="menu"],[role="menubar"],[role="grid"],[role="treegrid"],[role="toolbar"],[role="spinbutton"]',
    'tabellkomponenter med interaktion': '[role="grid"],[role="treegrid"],[aria-sort]',
    bilder: 'img,picture,input[type="image"],[role="img"],svg[role="img"]',
    'video eller filmklipp': 'video,iframe[src*="youtube" i],iframe[src*="youtu.be" i],iframe[src*="vimeo" i],iframe[src*="wistia" i],iframe[src*="dailymotion" i]',
    ljudklipp: 'audio',
    'mediespelare för video': 'video,iframe[src*="youtube" i],iframe[src*="youtu.be" i],iframe[src*="vimeo" i],iframe[src*="wistia" i],iframe[src*="dailymotion" i]',
    'mediespelare for video': 'video,iframe[src*="youtube" i],iframe[src*="youtu.be" i],iframe[src*="vimeo" i],iframe[src*="wistia" i],iframe[src*="dailymotion" i]',
    'mediespelare för ljud': 'audio',
    'mediespelare for ljud': 'audio',
    'språk i delar av sidan': ':not(html)[lang],[xml\\:lang]',
    'sprak i delar av sidan': ':not(html)[lang],[xml\\:lang]',
    'animeringar utan ljud': 'marquee,animate,animateTransform,animateMotion',
    'rörliga element': 'marquee,animate,animateTransform,animateMotion',
    rorliga: 'marquee,animate,animateTransform,animateMotion',
    'uppdaterande innehåll': '[aria-live],[role="status"],[role="alert"],[role="log"],[role="timer"]',
    'uppdaterande innehall': '[aria-live],[role="status"],[role="alert"],[role="log"],[role="timer"]',
    captcha: '.g-recaptcha,.h-captcha,.cf-turnstile,iframe[src*="recaptcha" i],iframe[src*="hcaptcha" i],iframe[src*="turnstile" i]',
};

export function resolve_web_detection_selector_for_label(text: unknown): string | null {
    const key = normalize_content_type_label(text);
    if (!key) return null;
    const selector = WEB_CONTENT_TYPE_DETECTION_SELECTORS_BY_LABEL[key];
    if (!selector || !is_valid_content_type_detection_selector(selector)) return null;
    return selector;
}

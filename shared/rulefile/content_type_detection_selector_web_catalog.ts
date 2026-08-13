/**
 * @fileoverview Katalog med detectionSelector för webb-regelfilens undertyper (matchas på visningsnamn).
 */

import { is_valid_content_type_detection_selector } from './content_type_detection_selector.js';
import { normalize_content_type_label } from './content_type_detection_pattern_web_catalog.js';

/**
 * Regelfilens undertyp-text (normaliserad) → CSS-selector för renderad DOM.
 */
export const WEB_CONTENT_TYPE_DETECTION_SELECTORS_BY_LABEL: Readonly<Record<string, string>> = {
    rubriker: 'h1,h2,h3,h4,h5,h6,[role="heading"]',
    listor: 'ul,ol,dl,[role="list"]',
    tabeller: 'table,[role="table"],[role="grid"]',
    landmärken:
        'header,main,footer,nav,aside,[role="banner"],[role="main"],[role="contentinfo"],[role="navigation"],[role="complementary"],[role="search"]',
    landmarker:
        'header,main,footer,nav,aside,[role="banner"],[role="main"],[role="contentinfo"],[role="navigation"],[role="complementary"],[role="search"]',
    länkar: 'a[href],[role="link"]',
    lankar: 'a[href],[role="link"]',
    navigeringsmenyer: 'nav,[role="navigation"],[role="menu"],[role="menubar"]',
    inmatningsfält:
        'input,select,textarea,[role="textbox"],[role="combobox"],[role="spinbutton"],[role="searchbox"]',
    inmatningsfalt:
        'input,select,textarea,[role="textbox"],[role="combobox"],[role="spinbutton"],[role="searchbox"]',
    knappar: 'button,input[type="button"],input[type="submit"],input[type="reset"],[role="button"]',
    'formulär (helhet)': 'form,[role="form"],[role="search"]',
    'formular (helhet)': 'form,[role="form"],[role="search"]',
    bilder: 'img,svg[role="img"],[role="img"],picture',
    'video eller filmklipp': 'video',
    ljudklipp: 'audio',
    'mediespelare för video': 'video',
    'mediespelare for video': 'video',
    'mediespelare för ljud': 'audio',
    'mediespelare for ljud': 'audio',
};

/**
 * Returnerar katalog-selector för undertypens visningsnamn, eller null om ingen träff.
 */
export function resolve_web_detection_selector_for_label(text: unknown): string | null {
    const key = normalize_content_type_label(text);
    if (!key) return null;
    const selector = WEB_CONTENT_TYPE_DETECTION_SELECTORS_BY_LABEL[key];
    if (!selector || !is_valid_content_type_detection_selector(selector)) return null;
    return selector;
}

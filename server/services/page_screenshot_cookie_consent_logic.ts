/**
 * @fileoverview Regler för att hitta och acceptera cookie-banners (testbar utan Puppeteer).
 */

import {
    build_cmp_accept_button_selectors,
    build_cmp_banner_container_selectors,
    build_cmp_banner_hide_selectors,
    build_overlay_detection_config,
    button_label_requires_consent_context,
    CMP_BUTTON_ACCEPT_ALL_TEXT_PATTERNS,
    CMP_BUTTON_ACCEPT_TEXT_PATTERNS,
    CMP_BUTTON_GENERIC_REQUIRES_CONTEXT_PATTERNS,
    CMP_BUTTON_REJECT_TEXT_PATTERNS,
    CMP_CONSENT_CONTEXT_KEYWORDS,
    element_text_suggests_consent,
    normalize_cmp_text,
} from './page_screenshot_cmp_pattern_families.js';

export const COOKIE_ACCEPT_BUTTON_SELECTORS = build_cmp_accept_button_selectors();

export const COOKIE_REJECT_TEXT_PATTERNS = CMP_BUTTON_REJECT_TEXT_PATTERNS;

export const COOKIE_ACCEPT_ALL_TEXT_PATTERNS = CMP_BUTTON_ACCEPT_ALL_TEXT_PATTERNS;

export const COOKIE_ACCEPT_TEXT_PATTERNS = CMP_BUTTON_ACCEPT_TEXT_PATTERNS;

export const COOKIE_BANNER_CONTAINER_SELECTORS = build_cmp_banner_container_selectors();

export const COOKIE_BANNER_HIDE_SELECTORS = build_cmp_banner_hide_selectors();

export function normalize_button_label(raw: string): string {
    return normalize_cmp_text(raw);
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
        consent_context_keywords: [...CMP_CONSENT_CONTEXT_KEYWORDS],
        generic_requires_context_patterns: [...CMP_BUTTON_GENERIC_REQUIRES_CONTEXT_PATTERNS],
        overlay_detection: build_overlay_detection_config(),
    };
}

export function build_cookie_banner_hide_config() {
    return {
        hide_selectors: [...COOKIE_BANNER_HIDE_SELECTORS],
        container_selectors: [...COOKIE_BANNER_CONTAINER_SELECTORS],
        consent_context_keywords: [...CMP_CONSENT_CONTEXT_KEYWORDS],
        overlay_detection: build_overlay_detection_config(),
    };
}

export { button_label_requires_consent_context, element_text_suggests_consent };

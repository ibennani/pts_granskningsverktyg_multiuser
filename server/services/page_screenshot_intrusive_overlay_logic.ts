/**
 * @fileoverview Regler för att stänga störande overlays före skärmdump (testbar utan Puppeteer).
 */

import { CMP_CONSENT_CONTEXT_KEYWORDS } from './cmp/cmp_generic_patterns.js';
import {
    INTRUSIVE_OVERLAY_CHAT_HIDE_ONLY_SELECTORS,
    INTRUSIVE_OVERLAY_CLOSE_BUTTON_SELECTORS,
    INTRUSIVE_OVERLAY_CLOSE_TEXT_PATTERNS,
    INTRUSIVE_OVERLAY_CONTAINER_SELECTORS,
    INTRUSIVE_OVERLAY_CONTEXT_KEYWORDS,
    INTRUSIVE_OVERLAY_GENERIC_KEYWORDS,
    INTRUSIVE_OVERLAY_HIDE_SELECTORS,
    INTRUSIVE_OVERLAY_MIN_Z_INDEX,
    INTRUSIVE_OVERLAY_BACKDROP_MIN_COVERAGE_RATIO,
    INTRUSIVE_OVERLAY_DIALOG_MIN_WIDTH_RATIO,
    INTRUSIVE_OVERLAY_POSITIONS,
    INTRUSIVE_OVERLAY_REJECT_TEXT_PATTERNS,
} from './overlay/intrusive_overlay_patterns.js';

export type IntrusiveOverlayDetectionConfig = {
    context_keywords: string[];
    consent_exclusion_keywords: string[];
    generic_context_keywords: string[];
    min_z_index: number;
    backdrop_min_coverage_ratio: number;
    dialog_min_width_ratio: number;
    positions: string[];
};

export function normalize_intrusive_text(raw: string): string {
    return String(raw || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

export function element_text_suggests_consent_exclusion(text: string): boolean {
    const normalized = normalize_intrusive_text(text);
    if (!normalized) return false;
    return CMP_CONSENT_CONTEXT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function element_text_suggests_intrusive_overlay(text: string): boolean {
    const normalized = normalize_intrusive_text(text);
    if (!normalized) return false;
    if (element_text_suggests_consent_exclusion(normalized)) return false;
    return INTRUSIVE_OVERLAY_CONTEXT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function element_text_suggests_generic_popup_context(text: string): boolean {
    const normalized = normalize_intrusive_text(text);
    if (!normalized) return false;
    return INTRUSIVE_OVERLAY_GENERIC_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function is_intrusive_reject_button_label(label: string): boolean {
    const normalized = normalize_intrusive_text(label);
    if (!normalized) return false;
    return INTRUSIVE_OVERLAY_REJECT_TEXT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function is_intrusive_close_button_label(label: string): boolean {
    const normalized = normalize_intrusive_text(label);
    if (!normalized) return false;
    if (is_intrusive_reject_button_label(normalized)) return false;
    return INTRUSIVE_OVERLAY_CLOSE_TEXT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function get_intrusive_close_label_priority(label: string): number {
    if (!is_intrusive_close_button_label(label)) return 0;
    const normalized = normalize_intrusive_text(label);
    if (normalized.includes('nej tack') || normalized.includes('no thanks')) return 3;
    if (normalized.includes('stäng') || normalized.includes('close')) return 2;
    return 1;
}

export function build_intrusive_overlay_detection_config(): IntrusiveOverlayDetectionConfig {
    return {
        context_keywords: [...INTRUSIVE_OVERLAY_CONTEXT_KEYWORDS],
        consent_exclusion_keywords: [...CMP_CONSENT_CONTEXT_KEYWORDS],
        generic_context_keywords: [...INTRUSIVE_OVERLAY_GENERIC_KEYWORDS],
        min_z_index: INTRUSIVE_OVERLAY_MIN_Z_INDEX,
        backdrop_min_coverage_ratio: INTRUSIVE_OVERLAY_BACKDROP_MIN_COVERAGE_RATIO,
        dialog_min_width_ratio: INTRUSIVE_OVERLAY_DIALOG_MIN_WIDTH_RATIO,
        positions: [...INTRUSIVE_OVERLAY_POSITIONS],
    };
}

export function build_intrusive_overlay_dismiss_config() {
    return {
        close_selectors: [...INTRUSIVE_OVERLAY_CLOSE_BUTTON_SELECTORS],
        close_text_patterns: [...INTRUSIVE_OVERLAY_CLOSE_TEXT_PATTERNS],
        reject_text_patterns: [...INTRUSIVE_OVERLAY_REJECT_TEXT_PATTERNS],
        container_selectors: [...INTRUSIVE_OVERLAY_CONTAINER_SELECTORS],
        chat_hide_only_selectors: [...INTRUSIVE_OVERLAY_CHAT_HIDE_ONLY_SELECTORS],
        overlay_detection: build_intrusive_overlay_detection_config(),
    };
}

export function build_intrusive_overlay_hide_config() {
    return {
        hide_selectors: [...INTRUSIVE_OVERLAY_HIDE_SELECTORS],
        container_selectors: [...INTRUSIVE_OVERLAY_CONTAINER_SELECTORS],
        chat_hide_only_selectors: [...INTRUSIVE_OVERLAY_CHAT_HIDE_ONLY_SELECTORS],
        overlay_detection: build_intrusive_overlay_detection_config(),
    };
}

/**
 * @fileoverview Regler för att stänga störande overlays före skärmdump (testbar utan Puppeteer).
 */

import { CMP_CONSENT_CONTEXT_KEYWORDS } from './cmp/cmp_generic_patterns.js';
import {
    INTRUSIVE_OVERLAY_CHAT_HIDE_ONLY_SELECTORS,
    INTRUSIVE_OVERLAY_CLOSE_BUTTON_SELECTORS,
    INTRUSIVE_OVERLAY_CLOSE_LABEL_EXCLUSION_PATTERNS,
    INTRUSIVE_OVERLAY_CLOSE_TEXT_PATTERNS,
    INTRUSIVE_OVERLAY_CONTAINER_SELECTORS,
    INTRUSIVE_OVERLAY_CONTEXT_KEYWORDS,
    INTRUSIVE_OVERLAY_GENERIC_KEYWORDS,
    INTRUSIVE_OVERLAY_HIDE_SELECTORS,
    INTRUSIVE_OVERLAY_SHADOW_HOST_SELECTORS,
    INTRUSIVE_OVERLAY_MIN_Z_INDEX,
    INTRUSIVE_OVERLAY_BACKDROP_MIN_COVERAGE_RATIO,
    INTRUSIVE_OVERLAY_DIALOG_MIN_WIDTH_RATIO,
    INTRUSIVE_OVERLAY_POSITIONS,
    INTRUSIVE_OVERLAY_REJECT_TEXT_PATTERNS,
} from './overlay/intrusive_overlay_patterns.js';
import {
    merge_overlay_domain_hints,
    sanitize_overlay_domain_hints,
    type OverlayDomainHints,
} from './page_screenshot_intrusive_overlay_cache_logic.js';

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

/**
 * Matchar kontextnyckelord utan att «Erbjudanden» ska trigga «erbjudande».
 */
export function intrusive_context_keyword_matches(normalized_text: string, keyword: string): boolean {
    const kw = normalize_intrusive_text(keyword);
    if (!kw || !normalized_text) return false;
    if (kw.length <= 2 || /[%$@#]/.test(kw) || kw.includes(' ')) {
        return normalized_text.includes(kw);
    }
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundary = '(?:^|[\\s,.:;!?()"\'«»\\[\\]-])';
    const re = new RegExp(`${boundary}${escaped}(?:$|[\\s,.:;!?()"\'«»\\[\\]-]|s)`, 'i');
    return re.test(normalized_text);
}

export function element_text_suggests_intrusive_overlay(text: string): boolean {
    const normalized = normalize_intrusive_text(text);
    if (!normalized) return false;
    if (element_text_suggests_consent_exclusion(normalized)) return false;
    return INTRUSIVE_OVERLAY_CONTEXT_KEYWORDS.some((keyword) =>
        intrusive_context_keyword_matches(normalized, keyword)
    );
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

export function is_intrusive_close_label_excluded(label: string): boolean {
    const normalized = normalize_intrusive_text(label);
    if (!normalized) return false;
    return INTRUSIVE_OVERLAY_CLOSE_LABEL_EXCLUSION_PATTERNS.some((pattern) =>
        normalized.includes(pattern)
    );
}

export function is_intrusive_close_button_label(label: string): boolean {
    const normalized = normalize_intrusive_text(label);
    if (!normalized) return false;
    if (is_intrusive_close_label_excluded(normalized)) return false;
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

export function build_intrusive_overlay_dismiss_config(domain_hints: OverlayDomainHints | null = null) {
    const base = {
        close_selectors: [...INTRUSIVE_OVERLAY_CLOSE_BUTTON_SELECTORS],
        close_text_patterns: [...INTRUSIVE_OVERLAY_CLOSE_TEXT_PATTERNS],
        reject_text_patterns: [...INTRUSIVE_OVERLAY_REJECT_TEXT_PATTERNS],
        container_selectors: [...INTRUSIVE_OVERLAY_CONTAINER_SELECTORS],
        chat_hide_only_selectors: [...INTRUSIVE_OVERLAY_CHAT_HIDE_ONLY_SELECTORS],
        shadow_host_selectors: [...INTRUSIVE_OVERLAY_SHADOW_HOST_SELECTORS],
        overlay_detection: build_intrusive_overlay_detection_config(),
    };
    const merged_hints = sanitize_overlay_domain_hints(
        merge_overlay_domain_hints(null, domain_hints)
    );
    return {
        ...base,
        close_selectors: [...(merged_hints.close_selectors || []), ...base.close_selectors],
        shadow_host_selectors: [...(merged_hints.shadow_host_selectors || []), ...base.shadow_host_selectors],
    };
}

export function build_intrusive_overlay_hide_config(domain_hints: OverlayDomainHints | null = null) {
    const base = {
        close_selectors: [...INTRUSIVE_OVERLAY_CLOSE_BUTTON_SELECTORS],
        close_text_patterns: [...INTRUSIVE_OVERLAY_CLOSE_TEXT_PATTERNS],
        reject_text_patterns: [...INTRUSIVE_OVERLAY_REJECT_TEXT_PATTERNS],
        hide_selectors: [...INTRUSIVE_OVERLAY_HIDE_SELECTORS],
        container_selectors: [...INTRUSIVE_OVERLAY_CONTAINER_SELECTORS],
        chat_hide_only_selectors: [...INTRUSIVE_OVERLAY_CHAT_HIDE_ONLY_SELECTORS],
        shadow_host_selectors: [...INTRUSIVE_OVERLAY_SHADOW_HOST_SELECTORS],
        overlay_detection: build_intrusive_overlay_detection_config(),
    };
    const merged_hints = sanitize_overlay_domain_hints(
        merge_overlay_domain_hints(null, domain_hints)
    );
    return {
        ...base,
        hide_selectors: [...(merged_hints.hide_selectors || []), ...base.hide_selectors],
        shadow_host_selectors: [...(merged_hints.shadow_host_selectors || []), ...base.shadow_host_selectors],
    };
}

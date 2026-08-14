/**
 * @fileoverview Regler för domän-cache av overlay-dismiss vid skärmdump (testbar utan Puppeteer).
 */

import { get_registrable_domain } from './page_screenshot_consent_cache_logic.js';

export { get_registrable_domain };

export const DEFAULT_OVERLAY_HINT_CACHE_TTL_DAYS = 180;

export type OverlayDomainHints = {
    close_selectors?: string[];
    shadow_host_selectors?: string[];
    hide_selectors?: string[];
};

export type OverlayDismissLearnedHint = {
    kind: 'close_selector' | 'shadow_host' | 'hide_selector';
    value: string;
};

export type OverlayHintCacheSnapshot = {
    domain: string;
    updated_at: string;
    source: 'learned' | 'manual' | 'merged';
    hints: OverlayDomainHints;
};

export type OverlayHintSeedFile = Record<string, Omit<OverlayHintCacheSnapshot, 'domain'>>;

const UNSAFE_SELECTOR_PATTERN = /[{;]|javascript:/i;

export function is_safe_overlay_selector(selector: string): boolean {
    const trimmed = String(selector || '').trim();
    if (!trimmed || trimmed.length > 200) return false;
    if (UNSAFE_SELECTOR_PATTERN.test(trimmed)) return false;
    return true;
}

export function dedupe_string_list(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const trimmed = String(value || '').trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        result.push(trimmed);
    }
    return result;
}

export function sanitize_overlay_domain_hints(hints: OverlayDomainHints | null | undefined): OverlayDomainHints {
    if (!hints) return {};
    const close_selectors = dedupe_string_list(hints.close_selectors || []).filter(is_safe_overlay_selector);
    const shadow_host_selectors = dedupe_string_list(hints.shadow_host_selectors || []).filter(
        is_safe_overlay_selector
    );
    const hide_selectors = dedupe_string_list(hints.hide_selectors || []).filter(is_safe_overlay_selector);
    return { close_selectors, shadow_host_selectors, hide_selectors };
}

export function overlay_hints_from_dismiss_result(
    hint: OverlayDismissLearnedHint | null | undefined
): OverlayDomainHints | null {
    if (!hint || !is_safe_overlay_selector(hint.value)) return null;
    if (hint.value.startsWith('keyboard:')) return null;
    if (hint.value.includes('data-gv-overlay-label')) return null;
    if (hint.value === 'button.icon-close-in-corner') return null;
    if (hint.kind === 'close_selector') return { close_selectors: [hint.value] };
    if (hint.kind === 'shadow_host') return { shadow_host_selectors: [hint.value] };
    if (hint.kind === 'hide_selector') return { hide_selectors: [hint.value] };
    return null;
}

export function merge_overlay_domain_hints(
    base: OverlayDomainHints | null | undefined,
    incoming: OverlayDomainHints | null | undefined
): OverlayDomainHints {
    const safe_base = sanitize_overlay_domain_hints(base);
    const safe_incoming = sanitize_overlay_domain_hints(incoming);
    return sanitize_overlay_domain_hints({
        close_selectors: [...(safe_incoming.close_selectors || []), ...(safe_base.close_selectors || [])],
        shadow_host_selectors: [
            ...(safe_incoming.shadow_host_selectors || []),
            ...(safe_base.shadow_host_selectors || []),
        ],
        hide_selectors: [...(safe_incoming.hide_selectors || []), ...(safe_base.hide_selectors || [])],
    });
}

export function is_overlay_hint_cache_entry_expired(
    entry: OverlayHintCacheSnapshot,
    ttl_days = DEFAULT_OVERLAY_HINT_CACHE_TTL_DAYS,
    now = Date.now()
): boolean {
    const updated = Date.parse(entry.updated_at);
    if (Number.isNaN(updated)) return true;
    const ttl_ms = ttl_days * 24 * 60 * 60 * 1000;
    return now - updated > ttl_ms;
}

export function has_usable_overlay_hint_snapshot(snapshot: OverlayHintCacheSnapshot | null): boolean {
    if (!snapshot || is_overlay_hint_cache_entry_expired(snapshot)) return false;
    const hints = sanitize_overlay_domain_hints(snapshot.hints);
    return (
        (hints.close_selectors?.length ?? 0) > 0
        || (hints.shadow_host_selectors?.length ?? 0) > 0
        || (hints.hide_selectors?.length ?? 0) > 0
    );
}

export function merge_overlay_hint_snapshots(
    base: OverlayHintCacheSnapshot | null,
    incoming: OverlayHintCacheSnapshot
): OverlayHintCacheSnapshot {
    if (!base) {
        return {
            ...incoming,
            hints: sanitize_overlay_domain_hints(incoming.hints),
        };
    }

    const base_time = Date.parse(base.updated_at);
    const incoming_time = Date.parse(incoming.updated_at);
    const incoming_is_newer = !Number.isNaN(incoming_time)
        && (Number.isNaN(base_time) || incoming_time >= base_time);

    const primary = incoming_is_newer ? incoming : base;
    const secondary = incoming_is_newer ? base : incoming;

    return {
        domain: incoming.domain,
        updated_at: primary.updated_at,
        source: 'merged',
        hints: merge_overlay_domain_hints(secondary.hints, primary.hints),
    };
}

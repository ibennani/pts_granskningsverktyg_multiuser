/**
 * @fileoverview Gemensam CMP-detektering för initial consent-evidens (selectors från vendor-registry).
 */
import { CMP_VENDORS } from './cmp_vendors/registry.js';
import {
    CMP_CONSENT_CONTEXT_KEYWORDS,
    CMP_GENERIC_CONTAINER_SELECTORS,
} from './cmp_generic_patterns.js';

export type CmpConsentBannerEvidence = {
    tagName: string;
    id: string | null;
    role: string | null;
    ariaLabel: string | null;
    ariaLabelledby: string | null;
    ariaModal: string | null;
    vendorId: string | null;
    boundingBox: { x: number; y: number; width: number; height: number };
    textExcerpt: string | null;
    controls: Array<{
        tagName: string;
        text: string | null;
        role: string | null;
        accessibleName: string | null;
    }>;
    domPath: string | null;
    outerHtmlExcerpt: string | null;
    frameUrl: string | null;
};

/** Alla kända banner-container-selectors från CMP-arkitekturen. */
export function get_all_banner_container_selectors(): string[] {
    const selectors = new Set<string>();
    for (const vendor of CMP_VENDORS) {
        for (const sel of vendor.banner_container_selectors ?? []) {
            if (sel?.trim()) selectors.add(sel.trim());
        }
    }
    for (const sel of CMP_GENERIC_CONTAINER_SELECTORS) {
        selectors.add(sel);
    }
    return [...selectors];
}

/** Browser-side detektering — injiceras via page.evaluate. */
export function build_cmp_consent_detection_eval_source(): string {
    const selectors = get_all_banner_container_selectors();
    const keywords = [...CMP_CONSENT_CONTEXT_KEYWORDS];
    const vendor_rules = CMP_VENDORS.flatMap((vendor) =>
        (vendor.banner_container_selectors ?? []).map((selector) => ({
            vendorId: vendor.id,
            selector,
        }))
    );
    return `(() => {
        const selectors = ${JSON.stringify(selectors)};
        const keywords = ${JSON.stringify(keywords)};
        const vendorRules = ${JSON.stringify(vendor_rules)};
        const seen = new Set();
        const results = [];

        function matchesKeywords(el) {
            const text = (el.textContent || '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const cls = (el.className || '').toString().toLowerCase();
            return keywords.some((k) => text.includes(k) || id.includes(k) || cls.includes(k));
        }

        function resolveVendor(el) {
            for (const rule of vendorRules) {
                try {
                    if (el.matches(rule.selector)) return rule.vendorId;
                } catch { /* ignore */ }
            }
            return null;
        }

        function domPath(el) {
            const parts = [];
            let node = el;
            while (node && node.nodeType === 1 && parts.length < 8) {
                let part = node.tagName.toLowerCase();
                if (node.id) part += '#' + node.id;
                parts.unshift(part);
                node = node.parentElement;
            }
            return parts.join(' > ');
        }

        function collectControls(el) {
            return Array.from(el.querySelectorAll('button, a, input[type="button"], input[type="submit"], input, select, textarea'))
                .slice(0, 12)
                .map((c) => ({
                    tagName: c.tagName.toLowerCase(),
                    text: (c.textContent || '').trim().slice(0, 80) || null,
                    role: c.getAttribute('role'),
                    accessibleName: c.getAttribute('aria-label') || c.getAttribute('title') || null,
                }));
        }

        for (const sel of selectors) {
            let nodes = [];
            try {
                nodes = Array.from(document.querySelectorAll(sel));
            } catch {
                continue;
            }
            for (const el of nodes) {
                if (!el || seen.has(el)) continue;
                const cs = getComputedStyle(el);
                if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
                const rect = el.getBoundingClientRect();
                if (rect.width < 50 || rect.height < 20) continue;
                if (!matchesKeywords(el) && sel.includes('role')) {
                    if (!matchesKeywords(el)) continue;
                }
                if (!matchesKeywords(el)) continue;
                seen.add(el);
                const html = el.outerHTML || '';
                results.push({
                    tagName: el.tagName.toLowerCase(),
                    id: el.id || null,
                    role: el.getAttribute('role'),
                    ariaLabel: el.getAttribute('aria-label'),
                    ariaLabelledby: el.getAttribute('aria-labelledby'),
                    ariaModal: el.getAttribute('aria-modal'),
                    vendorId: resolveVendor(el),
                    boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                    textExcerpt: (el.textContent || '').trim().slice(0, 300) || null,
                    controls: collectControls(el),
                    domPath: domPath(el),
                    outerHtmlExcerpt: html.slice(0, 4000) || null,
                    frameUrl: window.location.href,
                });
            }
        }
        return results;
    })()`;
}

/**
 * Detekterar consent UI på en Puppeteer-page utan interaktion.
 */
export async function detect_consent_ui_in_page(
    page: import('puppeteer').Page
): Promise<CmpConsentBannerEvidence[]> {
    const source = build_cmp_consent_detection_eval_source();
    const banners = await page.evaluate(source);
    return Array.isArray(banners) ? (banners as CmpConsentBannerEvidence[]) : [];
}

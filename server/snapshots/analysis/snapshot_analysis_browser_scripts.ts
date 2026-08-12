/**
 * @fileoverview Browser-side hjälpskript för snapshot-analys (evaluate).
 */

export const BROWSER_GET_FOCUSED_ELEMENT_INFO = () => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || active === document.documentElement) {
        return null;
    }
    const rect = active.getBoundingClientRect();
    const get_dom_path = (el: Element): string => {
        const parts: string[] = [];
        let node: Element | null = el;
        while (node && node !== document.documentElement && parts.length < 12) {
            let part = node.tagName.toLowerCase();
            if (node.id) {
                part += `#${node.id}`;
                parts.unshift(part);
                break;
            }
            const parent_el: Element | null = node.parentElement;
            if (parent_el) {
                const siblings = Array.from(parent_el.children).filter(
                    (child: Element) => child.tagName === node!.tagName
                );
                if (siblings.length > 1) {
                    part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
                }
            }
            parts.unshift(part);
            node = parent_el;
        }
        return parts.join(' > ');
    };
    const role = active.getAttribute('role');
    const aria_label = active.getAttribute('aria-label');
    const aria_labelledby = active.getAttribute('aria-labelledby');
    let accessible_name = aria_label || '';
    if (!accessible_name && aria_labelledby) {
        const ref = document.getElementById(aria_labelledby);
        if (ref) accessible_name = ref.textContent?.trim() || '';
    }
    if (!accessible_name) {
        accessible_name = active.textContent?.trim().slice(0, 200) || '';
    }
    return {
        tagName: active.tagName.toLowerCase(),
        type: active.getAttribute('type'),
        role,
        accessibleName: accessible_name || null,
        id: active.id || null,
        name: active.getAttribute('name'),
        href: active.tagName === 'A' ? (active as HTMLAnchorElement).href : null,
        tabIndex: active.tabIndex,
        disabled: (active as HTMLInputElement).disabled === true,
        ariaDisabled: active.getAttribute('aria-disabled') === 'true',
        ariaHidden: active.getAttribute('aria-hidden') === 'true',
        boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        },
        domPath: get_dom_path(active),
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        visible: rect.width > 0 && rect.height > 0,
        fullyWithinViewport:
            rect.left >= 0 &&
            rect.top >= 0 &&
            rect.right <= window.innerWidth &&
            rect.bottom <= window.innerHeight,
    };
};

export const BROWSER_GET_COMPUTED_FOCUS_STYLES = () => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return null;
    const cs = getComputedStyle(active);
    return {
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
        outlineColor: cs.outlineColor,
        outlineOffset: cs.outlineOffset,
        boxShadow: cs.boxShadow,
        borderTopWidth: cs.borderTopWidth,
        borderRightWidth: cs.borderRightWidth,
        borderBottomWidth: cs.borderBottomWidth,
        borderLeftWidth: cs.borderLeftWidth,
        borderTopColor: cs.borderTopColor,
        borderRightColor: cs.borderRightColor,
        borderBottomColor: cs.borderBottomColor,
        borderLeftColor: cs.borderLeftColor,
        backgroundColor: cs.backgroundColor,
        color: cs.color,
    };
};

export const BROWSER_COLLECT_REFLOW_CANDIDATES = () => {
    const doc_el = document.documentElement;
    const body = document.body;
    const client_width = doc_el.clientWidth;
    const scroll_width = Math.max(doc_el.scrollWidth, body?.scrollWidth ?? 0);
    const has_horizontal_overflow = scroll_width > client_width + 1;
    const candidates: Array<Record<string, unknown>> = [];
    const viewport_w = window.innerWidth;
    const elements = document.querySelectorAll('body *');
    const max = 80;
    for (let i = 0; i < elements.length && candidates.length < max; i++) {
        const el = elements[i] as HTMLElement;
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const el_scroll = el.scrollWidth;
        const el_client = el.clientWidth;
        const overflows_viewport = rect.right > viewport_w + 1;
        const internal_overflow = el_scroll > el_client + 1;
        const position = cs.position;
        if (overflows_viewport || internal_overflow || (position === 'fixed' && rect.width > viewport_w * 0.8)) {
            candidates.push({
                tagName: el.tagName.toLowerCase(),
                id: el.id || null,
                overflowsViewport: overflows_viewport,
                internalOverflow: internal_overflow,
                scrollWidth: el_scroll,
                clientWidth: el_client,
                position,
                boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            });
        }
    }
    return {
        documentClientWidth: client_width,
        documentScrollWidth: scroll_width,
        hasHorizontalOverflow: has_horizontal_overflow,
        candidates,
    };
};

export const BROWSER_APPLY_TEXT_SPACING_CSS = () => {
    const existing = document.querySelector('[data-gv-snapshot-analysis="text-spacing"]');
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.setAttribute('data-gv-snapshot-analysis', 'text-spacing');
    style.textContent = `
        * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
        p { margin-bottom: 2em !important; }
    `;
    document.head.appendChild(style);
    return true;
};

export const BROWSER_REMOVE_TEXT_SPACING_CSS = () => {
    const node = document.querySelector('[data-gv-snapshot-analysis="text-spacing"]');
    if (node) node.remove();
    return !document.querySelector('[data-gv-snapshot-analysis="text-spacing"]');
};

export const BROWSER_COLLECT_TEXT_SPACING_ISSUES = () => {
    const issues: Array<Record<string, unknown>> = [];
    const containers = document.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, div, span');
    const max = 60;
    for (let i = 0; i < containers.length && issues.length < max; i++) {
        const el = containers[i] as HTMLElement;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const text = el.textContent?.trim();
        if (!text || text.length < 2) continue;
        const overflow = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
        const clipped = cs.overflow === 'hidden' && overflow;
        if (overflow || clipped) {
            issues.push({
                tagName: el.tagName.toLowerCase(),
                id: el.id || null,
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
                scrollHeight: el.scrollHeight,
                clientHeight: el.clientHeight,
                overflow: cs.overflow,
                textExcerpt: text.slice(0, 200),
            });
        }
    }
    return issues;
};

export const BROWSER_COLLECT_CONTRAST_CANDIDATES = () => {
    const results: Array<Record<string, unknown>> = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const max = 120;
    while (results.length < max) {
        const node = walk.nextNode();
        if (!node) break;
        const text = node.textContent?.trim();
        if (!text || text.length < 1) continue;
        const parent = node.parentElement;
        if (!parent) continue;
        const cs = getComputedStyle(parent);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const rect = parent.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        const bg_image = cs.backgroundImage;
        const has_complex_bg =
            (bg_image && bg_image !== 'none') ||
            cs.filter !== 'none' ||
            cs.mixBlendMode !== 'normal';
        results.push({
            tagName: parent.tagName.toLowerCase(),
            id: parent.id || null,
            textExcerpt: text.slice(0, 300),
            foregroundColor: cs.color,
            backgroundColor: cs.backgroundColor,
            backgroundImage: bg_image,
            opacity: cs.opacity,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            measurable: !has_complex_bg,
            reason: has_complex_bg ? 'complex-background' : null,
        });
    }
    return results;
};

export const BROWSER_COLLECT_TARGET_SIZES = () => {
    const selectors =
        'button, input, select, textarea, a[href], [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';
    const elements = document.querySelectorAll(selectors);
    const results: Array<Record<string, unknown>> = [];
    const max = 100;
    for (let i = 0; i < elements.length && results.length < max; i++) {
        const el = elements[i] as HTMLElement;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 && rect.height < 1) continue;
        results.push({
            tagName: el.tagName.toLowerCase(),
            id: el.id || null,
            role: el.getAttribute('role'),
            accessibleName: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 100) || null,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        });
    }
    return results;
};

export const BROWSER_COLLECT_SAFE_INTERACTION_CANDIDATES = () => {
    const results: Array<Record<string, unknown>> = [];
    const elements = document.querySelectorAll(
        'button, [aria-expanded], [aria-controls], summary, [role="button"]'
    );
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        results.push({
            tagName: el.tagName.toLowerCase(),
            type: el.getAttribute('type'),
            role: el.getAttribute('role'),
            href: el.tagName === 'A' ? (el as HTMLAnchorElement).href : null,
            ariaExpanded: el.getAttribute('aria-expanded'),
            ariaControls: el.getAttribute('aria-controls'),
            ariaHaspopup: el.getAttribute('aria-haspopup'),
            text: el.textContent?.trim().slice(0, 120) || null,
            isSummary: el.tagName.toLowerCase() === 'summary',
            id: el.id || null,
        });
    }
    return results;
};

export const BROWSER_DETECT_CONSENT_BANNER = () => {
    const keywords = ['cookie', 'consent', 'gdpr', 'samtycke', 'integritet'];
    const candidates: Array<Record<string, unknown>> = [];
    const elements = document.querySelectorAll(
        '[role="dialog"], [aria-modal="true"], [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i]'
    );
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const text = el.textContent?.toLowerCase() || '';
        const matches = keywords.some((k) => text.includes(k) || el.id.toLowerCase().includes(k));
        if (!matches) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 20) continue;
        const controls = Array.from(el.querySelectorAll('button, a, input[type="button"], input[type="submit"]'))
            .slice(0, 10)
            .map((c) => ({
                tagName: c.tagName.toLowerCase(),
                text: c.textContent?.trim().slice(0, 80) || null,
                role: c.getAttribute('role'),
            }));
        candidates.push({
            tagName: el.tagName.toLowerCase(),
            id: el.id || null,
            role: el.getAttribute('role'),
            boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            controls,
            textExcerpt: el.textContent?.trim().slice(0, 300) || null,
        });
    }
    return candidates;
};

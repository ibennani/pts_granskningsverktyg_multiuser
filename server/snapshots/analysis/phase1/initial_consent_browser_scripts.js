/**
 * @fileoverview Browser-side insamling av initial cookie/CMP-evidens.
 * Ren JavaScript eftersom funktionen serialiseras till frame.evaluate.
 */
export function browser_collect_initial_consent_candidates(config) {
    const genericSelectors = Array.isArray(config?.container_selectors)
        ? config.container_selectors
        : [];
    const vendorPackages = Array.isArray(config?.vendors) ? config.vendors : [];
    const keywords = Array.isArray(config?.consent_context_keywords)
        ? config.consent_context_keywords.map((value) => String(value).toLowerCase())
        : ['cookie', 'cookies', 'kakor', 'samtycke', 'consent', 'gdpr', 'integritet', 'privacy'];

    const selectorSources = [];
    for (const vendor of vendorPackages) {
        const vendorId = String(vendor?.id || '').trim();
        const selectors = Array.isArray(vendor?.banner_container_selectors)
            ? vendor.banner_container_selectors
            : [];
        for (const selector of selectors) {
            if (selector) selectorSources.push({ selector: String(selector), vendorId: vendorId || null });
        }
    }
    for (const selector of genericSelectors) {
        if (selector) selectorSources.push({ selector: String(selector), vendorId: null });
    }
    selectorSources.push(
        { selector: '[role="dialog"]', vendorId: null },
        { selector: '[role="alertdialog"]', vendorId: null },
        { selector: '[aria-modal="true"]', vendorId: null },
        { selector: '[id*="cookie" i]', vendorId: null },
        { selector: '[class*="cookie" i]', vendorId: null },
        { selector: '[id*="consent" i]', vendorId: null },
        { selector: '[class*="consent" i]', vendorId: null }
    );

    const candidates = new Map();
    const safeQuery = (selector) => {
        try {
            return Array.from(document.querySelectorAll(selector));
        } catch {
            return [];
        }
    };

    for (const source of selectorSources) {
        for (const el of safeQuery(source.selector)) {
            if (!(el instanceof Element)) continue;
            const existing = candidates.get(el) || { vendors: new Set(), selectors: new Set() };
            if (source.vendorId) existing.vendors.add(source.vendorId);
            existing.selectors.add(source.selector);
            candidates.set(el, existing);
        }
    }

    const domPath = (el) => {
        const parts = [];
        let node = el;
        while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.documentElement && parts.length < 12) {
            let part = node.tagName.toLowerCase();
            if (node.id) {
                part += `#${CSS.escape(node.id)}`;
                parts.unshift(part);
                break;
            }
            const parent = node.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children).filter((child) => child.tagName === node.tagName);
                if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
            }
            parts.unshift(part);
            node = parent;
        }
        return parts.join(' > ');
    };

    const accessibleName = (el) => {
        const aria = el.getAttribute('aria-label');
        if (aria && aria.trim()) return aria.trim().slice(0, 300);
        const labelledby = el.getAttribute('aria-labelledby');
        if (labelledby) {
            const value = labelledby
                .split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent?.trim() || '')
                .filter(Boolean)
                .join(' ')
                .trim();
            if (value) return value.slice(0, 300);
        }
        if (el instanceof HTMLInputElement) {
            if (el.labels?.length) {
                const value = Array.from(el.labels).map((label) => label.textContent?.trim() || '').filter(Boolean).join(' ');
                if (value) return value.slice(0, 300);
            }
            if (el.value && ['button', 'submit', 'reset'].includes(el.type)) return el.value.slice(0, 300);
        }
        const text = el.textContent?.replace(/\s+/g, ' ').trim() || '';
        return text ? text.slice(0, 300) : null;
    };

    const controlSelector = 'button,a[href],input,select,textarea,[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="switch"]';
    const results = [];

    for (const [el, source] of candidates) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 20) continue;

        const text = el.textContent?.replace(/\s+/g, ' ').trim() || '';
        const idClass = `${el.id || ''} ${el.className || ''}`.toLowerCase();
        const hasConsentText = keywords.some((keyword) => text.toLowerCase().includes(keyword) || idClass.includes(keyword));
        const knownVendor = source.vendors.size > 0;
        const explicitModal = el.matches('[role="dialog"],[role="alertdialog"],[aria-modal="true"]');
        if (!knownVendor && !hasConsentText && !explicitModal) continue;

        const controls = Array.from(el.querySelectorAll(controlSelector)).slice(0, 40).map((control) => {
            const controlRect = control.getBoundingClientRect();
            return {
                tagName: control.tagName.toLowerCase(),
                type: control.getAttribute('type'),
                role: control.getAttribute('role'),
                id: control.id || null,
                name: accessibleName(control),
                text: control.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200) || null,
                ariaLabel: control.getAttribute('aria-label'),
                ariaChecked: control.getAttribute('aria-checked'),
                ariaPressed: control.getAttribute('aria-pressed'),
                ariaExpanded: control.getAttribute('aria-expanded'),
                disabled: control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true',
                tabIndex: control.tabIndex,
                boundingBox: {
                    x: controlRect.x,
                    y: controlRect.y,
                    width: controlRect.width,
                    height: controlRect.height,
                },
            };
        });

        results.push({
            vendorIds: Array.from(source.vendors).sort(),
            matchedSelectors: Array.from(source.selectors).slice(0, 20),
            tagName: el.tagName.toLowerCase(),
            id: el.id || null,
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            ariaLabelledby: el.getAttribute('aria-labelledby'),
            ariaModal: el.getAttribute('aria-modal'),
            accessibleName: accessibleName(el),
            domPath: domPath(el),
            boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            viewport: { width: window.innerWidth, height: window.innerHeight },
            textExcerpt: text.slice(0, 1000) || null,
            outerHTML: el.outerHTML.slice(0, 25000),
            outerHTMLTruncated: el.outerHTML.length > 25000,
            computedStyle: {
                position: cs.position,
                zIndex: cs.zIndex,
                display: cs.display,
                visibility: cs.visibility,
                color: cs.color,
                backgroundColor: cs.backgroundColor,
                fontSize: cs.fontSize,
            },
            controls,
        });
    }

    // Behåll yttersta kandidaten när samma banner matchas via flera nested selectors.
    return results.filter((candidate, index, all) => {
        const currentPath = candidate.domPath || '';
        return !all.some((other, otherIndex) => {
            if (otherIndex === index) return false;
            const otherPath = other.domPath || '';
            return otherPath && currentPath && currentPath.startsWith(`${otherPath} > `);
        });
    }).slice(0, 12);
}

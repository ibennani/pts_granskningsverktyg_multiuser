/**
 * @fileoverview Deterministisk browser-side inventering av större återkommande block.
 * Ingen AI och ingen interaktion.
 */
export function browser_collect_recurring_component_candidates() {
    const isVisible = (el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width >= 40 && rect.height >= 20;
    };

    const domPath = (el) => {
        const parts = [];
        let node = el;
        while (node && node !== document.documentElement && parts.length < 12) {
            let part = node.tagName.toLowerCase();
            const role = node.getAttribute('role');
            if (role) part += `[role="${role}"]`;
            if (node.id && !/[0-9a-f]{8}-[0-9a-f-]{20,}/i.test(node.id) && !/\d{5,}/.test(node.id)) {
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

    const normalizedStructure = (root) => {
        let visited = 0;
        const max = 450;
        const walk = (el, depth) => {
            if (!(el instanceof Element) || visited >= max || depth > 9) return '';
            visited += 1;
            const tag = el.tagName.toLowerCase();
            const role = (el.getAttribute('role') || '').toLowerCase();
            const type = (el.getAttribute('type') || '').toLowerCase();
            const landmark = ['header','main','footer','nav','aside','form'].includes(tag) ? tag : '';
            const ariaPopup = el.getAttribute('aria-haspopup') ? 'popup' : '';
            const ariaExpanded = el.hasAttribute('aria-expanded') ? 'expandable' : '';
            const hrefKind = tag === 'a' && el.hasAttribute('href') ? 'link' : '';
            const key = [tag, role, type, landmark, ariaPopup, ariaExpanded, hrefKind].filter(Boolean).join(':');
            const children = Array.from(el.children).slice(0, 50).map((child) => walk(child, depth + 1)).filter(Boolean);
            return `${key}(${children.join(',')})`;
        };
        return walk(root, 0).slice(0, 50000);
    };

    const summarize = (el) => {
        const rect = el.getBoundingClientRect();
        const links = Array.from(el.querySelectorAll('a[href],[role="link"]'));
        const buttons = Array.from(el.querySelectorAll('button,[role="button"]'));
        const fields = Array.from(el.querySelectorAll('input,select,textarea,[role="textbox"],[role="combobox"],[role="searchbox"]'));
        const headings = Array.from(el.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]'));
        const navs = Array.from(el.querySelectorAll('nav,[role="navigation"]'));
        const linkLabels = links.slice(0, 30).map((link) => (link.getAttribute('aria-label') || link.textContent || '').replace(/\s+/g,' ').trim().slice(0,100)).filter(Boolean);
        return {
            domPath: domPath(el),
            tagName: el.tagName.toLowerCase(),
            role: el.getAttribute('role'),
            id: el.id || null,
            ariaLabel: el.getAttribute('aria-label'),
            boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            viewport: { width: window.innerWidth, height: window.innerHeight },
            counts: {
                links: links.length,
                buttons: buttons.length,
                fields: fields.length,
                headings: headings.length,
                navigations: navs.length,
            },
            linkLabels,
            textExcerpt: (el.textContent || '').replace(/\s+/g,' ').trim().slice(0,800) || null,
            structure: normalizedStructure(el),
        };
    };

    const candidateMap = new Map();
    const add = (el, type, score, signals) => {
        if (!(el instanceof Element) || !isVisible(el)) return;
        const current = candidateMap.get(el);
        if (!current || score > current.score) {
            candidateMap.set(el, { type, score, signals: [...signals] });
        } else if (current.type === type) {
            current.score = Math.max(current.score, score);
            current.signals = Array.from(new Set([...current.signals, ...signals]));
        }
    };

    for (const el of document.querySelectorAll('header,[role="banner"]')) {
        add(el, 'header', 100, ['semantic-banner']);
    }
    for (const el of document.querySelectorAll('footer,[role="contentinfo"]')) {
        add(el, 'footer', 100, ['semantic-contentinfo']);
    }
    for (const el of document.querySelectorAll('nav,[role="navigation"]')) {
        const rect = el.getBoundingClientRect();
        const links = el.querySelectorAll('a[href],[role="link"]').length;
        const header = el.closest('header,[role="banner"]');
        let score = header ? 95 : 75;
        const signals = header ? ['semantic-navigation','inside-header'] : ['semantic-navigation'];
        if (links >= 4) { score += 5; signals.push('multiple-links'); }
        if (rect.width >= window.innerWidth * 0.5) { score += 3; signals.push('wide-navigation'); }
        add(el, header ? 'menu' : 'section_navigation', Math.min(score, 100), signals);
    }

    // Menytrigger kan avslöja huvudmeny även när nav-semantik saknas.
    for (const trigger of document.querySelectorAll('[aria-haspopup="menu"],[aria-controls][aria-expanded],button[aria-expanded]')) {
        if (!isVisible(trigger)) continue;
        const header = trigger.closest('header,[role="banner"]');
        if (!header) continue;
        const controlledId = trigger.getAttribute('aria-controls');
        let controlled = null;
        if (controlledId) {
            try { controlled = document.getElementById(controlledId); } catch { controlled = null; }
        }
        if (controlled && isVisible(controlled)) {
            add(controlled, 'menu', 92, ['controlled-by-header-trigger','aria-expanded']);
        }
    }

    // Fallback för dåligt kodade sajter: större top-level block i början/slutet av body.
    const bodyChildren = Array.from(document.body?.children || []).filter((el) => isVisible(el));
    const docHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, window.innerHeight);
    for (let i = 0; i < bodyChildren.length; i++) {
        const el = bodyChildren[i];
        if (el.matches('script,style,noscript')) continue;
        const rect = el.getBoundingClientRect();
        const widthRatio = rect.width / Math.max(window.innerWidth, 1);
        const interactiveCount = el.querySelectorAll('a[href],button,input,select,textarea,[role="button"],[role="link"]').length;
        if (widthRatio < 0.65 || interactiveCount < 2) continue;
        if (i <= 2 && rect.top < window.innerHeight * 1.2) {
            add(el, 'header', 55 + Math.min(interactiveCount, 15), ['top-level-position','wide-block','interactive-group']);
        }
        const absoluteBottom = rect.bottom + window.scrollY;
        if (i >= bodyChildren.length - 3 || absoluteBottom >= docHeight * 0.82) {
            add(el, 'footer', 55 + Math.min(interactiveCount, 15), ['bottom-level-position','wide-block','interactive-group']);
        }
    }

    const candidates = [];
    for (const [el, meta] of candidateMap) {
        candidates.push({
            candidateType: meta.type,
            score: meta.score,
            confidence: meta.score >= 90 ? 'high' : meta.score >= 70 ? 'medium' : 'low',
            matchedSignals: meta.signals,
            ...summarize(el),
            parentHeaderPath: meta.type === 'menu' ? domPath(el.closest('header,[role="banner"]') || el.parentElement) : null,
        });
    }

    candidates.sort((a,b) => b.score - a.score || a.boundingBox.y - b.boundingBox.y);
    return candidates.slice(0, 30);
}

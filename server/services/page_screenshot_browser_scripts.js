/**
 * @fileoverview Funktioner som skickas till Puppeteer page.evaluate / evaluateOnNewDocument.
 * Måste vara ren JavaScript — laddas via page_screenshot_browser_scripts_loader.ts
 * (Function-konstruktor från rå fil) så tsx/esbuild inte injicerar __name i serialiserad kod.
 */

/**
 * @param {{ step_px: number, pause_ms: number, max_passes: number, stable_passes_needed: number }} config
 */
export function browser_read_document_scroll_height() {
    return Math.max(document.body?.scrollHeight ?? 0, document.documentElement?.scrollHeight ?? 0);
}

export async function browser_auto_scroll_lazy_content(config) {
    const sleep = (ms) =>
        new Promise((resolve) => {
            window.setTimeout(resolve, ms);
        });

    const read_scroll_height = () =>
        Math.max(document.body?.scrollHeight ?? 0, document.documentElement?.scrollHeight ?? 0);

    const scroll_window_to = async (y, pause_ms) => {
        window.scrollTo(0, y);
        window.dispatchEvent(new Event('scroll'));
        await sleep(pause_ms);
    };

    const scroll_nested_containers = async (pause_ms) => {
        const selectors = ['main', '[role="main"]', '#main', '#content', '.main-content'];
        for (const selector of selectors) {
            document.querySelectorAll(selector).forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                if (node.scrollHeight > node.clientHeight + 4) {
                    node.scrollTop = node.scrollHeight;
                }
            });
        }
        await sleep(pause_ms);
    };

    let stable_passes = 0;
    let last_height = read_scroll_height();

    for (let pass = 0; pass < config.max_passes && stable_passes < config.stable_passes_needed; pass++) {
        let y = 0;
        let height = read_scroll_height();

        while (y < height) {
            await scroll_window_to(y, config.pause_ms);
            y += config.step_px;
            const expanded = read_scroll_height();
            if (expanded > height) {
                height = expanded;
                stable_passes = 0;
            }
        }

        await scroll_window_to(height, config.pause_ms);
        await scroll_nested_containers(config.pause_ms);

        const height_after = read_scroll_height();
        if (height_after <= last_height) {
            stable_passes += 1;
        } else {
            stable_passes = 0;
            last_height = height_after;
        }
    }
}

/** @param {number} max_wait_ms */
export async function browser_wait_for_lazy_images(max_wait_ms) {
    const pending = Array.from(document.images).filter((img) => !img.complete);
    if (pending.length === 0) return;

    await Promise.race([
        Promise.all(
            pending.map(
                (img) =>
                    new Promise((resolve) => {
                        img.addEventListener('load', () => resolve(), { once: true });
                        img.addEventListener('error', () => resolve(), { once: true });
                    })
            )
        ),
        new Promise((resolve) => {
            window.setTimeout(resolve, max_wait_ms);
        }),
    ]);
}

export function browser_scroll_to_top() {
    window.scrollTo(0, 0);
    document.querySelectorAll('main, [role="main"], #main, #content, .main-content').forEach((node) => {
        if (node instanceof HTMLElement) {
            node.scrollTop = 0;
        }
    });
}

export function browser_page_has_renderable_content() {
    const body = document.body;
    if (!body) return false;
    const text = (body.innerText || '').trim();
    const height = body.scrollHeight || document.documentElement.scrollHeight;
    return text.length > 20 || height > 200;
}

export function browser_hide_webdriver_flag() {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
}

/**
 * Hittar synliga cookie-overlay-kandidater via mönsterfamilj.
 * @param {{
 *   container_selectors?: string[];
 *   consent_context_keywords?: string[];
 *   overlay_detection?: {
 *     consent_context_keywords: string[];
 *     min_viewport_width_ratio: number;
 *     min_z_index: number;
 *     positions: string[];
 *   };
 * }} config
 * @returns {HTMLElement[]}
 */
export function browser_find_cookie_overlay_roots(config) {
    const overlay = config.overlay_detection || {};
    const keywords = overlay.consent_context_keywords || config.consent_context_keywords || [];
    const min_ratio = overlay.min_viewport_width_ratio ?? 0.35;
    const min_z = overlay.min_z_index ?? 100;
    const positions = overlay.positions || ['fixed', 'sticky'];

    const is_visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 4 && rect.height > 4;
    };

    const text_suggests_consent = (text) => {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!normalized) return false;
        return keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
    };

    const has_visible_button = (root) => {
        const buttons = root.querySelectorAll(
            'button, a[role="button"], input[type="button"], input[type="submit"], [role="button"]'
        );
        for (const button of buttons) {
            if (is_visible(button)) return true;
        }
        return false;
    };

    const is_overlay_candidate = (element) => {
        if (!is_visible(element)) return false;
        const style = window.getComputedStyle(element);
        if (!positions.includes(style.position)) return false;
        const z_index = Number.parseInt(style.zIndex, 10);
        if (!Number.isNaN(z_index) && z_index < min_z) return false;
        const rect = element.getBoundingClientRect();
        const viewport_width = window.innerWidth || document.documentElement.clientWidth || 1;
        if (rect.width / viewport_width < min_ratio) return false;
        const text = element.innerText || element.textContent || '';
        if (!text_suggests_consent(text)) return false;
        return has_visible_button(element);
    };

    const roots = [];
    const seen = new Set();

    const add_root = (element) => {
        if (!(element instanceof HTMLElement) || seen.has(element)) return;
        if (!is_overlay_candidate(element)) return;
        seen.add(element);
        roots.push(element);
    };

    for (const selector of config.container_selectors || []) {
        let containers = [];
        try {
            containers = Array.from(document.querySelectorAll(selector));
        } catch {
            continue;
        }
        for (const container of containers) {
            add_root(container);
        }
    }

    document.querySelectorAll('body *').forEach((node) => {
        if (node instanceof HTMLElement) {
            add_root(node);
        }
    });

    return roots;
}

/**
 * Försöker klicka bort cookie-/samtyckesbanner före skärmdump.
 * @param {{
 *   accept_selectors: string[];
 *   accept_all_text_patterns?: string[];
 *   accept_text_patterns: string[];
 *   reject_text_patterns: string[];
 *   container_selectors: string[];
 *   consent_context_keywords?: string[];
 *   generic_requires_context_patterns?: string[];
 *   overlay_detection?: object;
 * }} config
 * @returns {boolean}
 */
export function browser_dismiss_cookie_banners(config) {
    const is_visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 4 && rect.height > 4;
    };

    const read_clickable_label = (element) => {
        if (!(element instanceof HTMLElement)) return '';
        const aria = element.getAttribute('aria-label') || '';
        const title = element.getAttribute('title') || '';
        const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
        return [text, aria, title].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
    };

    const text_suggests_consent = (text) => {
        const keywords = config.consent_context_keywords || [];
        const normalized = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!normalized) return false;
        return keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
    };

    const label_requires_consent_context = (label) => {
        const patterns = config.generic_requires_context_patterns || [];
        const normalized = String(label || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return patterns.some((pattern) => normalized.includes(String(pattern).toLowerCase()));
    };

    const label_matches_patterns = (label, patterns, reject_text_patterns) => {
        const normalized = String(label || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!normalized) return false;
        for (const pattern of reject_text_patterns) {
            if (normalized.includes(String(pattern).toLowerCase())) return false;
        }
        for (const pattern of patterns) {
            if (normalized.includes(String(pattern).toLowerCase())) return true;
        }
        return false;
    };

    const try_click = (element) => {
        if (!(element instanceof HTMLElement) || !is_visible(element)) return false;
        element.click();
        return true;
    };

    const find_accept_in_root = (root, enforce_consent_context) => {
        for (const selector of config.accept_selectors) {
            try {
                const match = root.querySelector(selector);
                if (try_click(match)) return true;
            } catch {
                // Ogiltig selector — hoppa över.
            }
        }

        const accept_all_patterns = config.accept_all_text_patterns || [];
        const accept_patterns = config.accept_text_patterns || [];
        const root_text = root.innerText || root.textContent || '';
        const root_has_consent = text_suggests_consent(root_text);

        const candidates = root.querySelectorAll(
            'button, a[role="button"], input[type="button"], input[type="submit"], [role="button"]'
        );

        for (const candidate of candidates) {
            const label = read_clickable_label(candidate);
            if (label_matches_patterns(label, accept_all_patterns, config.reject_text_patterns)) {
                if (try_click(candidate)) return true;
            }
        }

        for (const candidate of candidates) {
            const label = read_clickable_label(candidate);
            if (!label_matches_patterns(label, accept_patterns, config.reject_text_patterns)) {
                continue;
            }
            if (enforce_consent_context && label_requires_consent_context(label) && !root_has_consent) {
                continue;
            }
            if (try_click(candidate)) return true;
        }
        return false;
    };

    if (find_accept_in_root(document, true)) {
        return true;
    }

    const overlay_roots = browser_find_cookie_overlay_roots(config);
    for (const overlay of overlay_roots) {
        if (find_accept_in_root(overlay, false)) {
            return true;
        }
    }

    for (const container_selector of config.container_selectors) {
        let containers = [];
        try {
            containers = Array.from(document.querySelectorAll(container_selector));
        } catch {
            continue;
        }
        for (const container of containers) {
            if (find_accept_in_root(container, false)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * @param {{ container_selectors: string[]; overlay_detection?: object; consent_context_keywords?: string[] }} config
 * @returns {boolean}
 */
export function browser_is_cookie_banner_visible(config) {
    const is_visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 4 && rect.height > 4;
    };

    for (const container_selector of config.container_selectors) {
        let containers = [];
        try {
            containers = Array.from(document.querySelectorAll(container_selector));
        } catch {
            continue;
        }
        for (const container of containers) {
            if (is_visible(container)) {
                return true;
            }
        }
    }

    const overlay_roots = browser_find_cookie_overlay_roots(config);
    return overlay_roots.length > 0;
}

/**
 * Döljer kända cookie-banner DOM-noder och återställer scroll — sista steg före skärmdump.
 * @param {{ hide_selectors: string[]; overlay_detection?: object; container_selectors?: string[]; consent_context_keywords?: string[] }} config
 * @returns {number} Antal dolda element
 */
export function browser_hide_cookie_banners_for_screenshot(config) {
    let hidden_count = 0;

    const hide_element = (element) => {
        if (!(element instanceof HTMLElement)) return;
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('opacity', '0', 'important');
        element.style.setProperty('pointer-events', 'none', 'important');
        hidden_count += 1;
    };

    for (const selector of config.hide_selectors) {
        let elements = [];
        try {
            elements = Array.from(document.querySelectorAll(selector));
        } catch {
            continue;
        }
        for (const element of elements) {
            hide_element(element);
        }
    }

    const overlay_roots = browser_find_cookie_overlay_roots({
        container_selectors: config.container_selectors || [],
        consent_context_keywords: config.consent_context_keywords,
        overlay_detection: config.overlay_detection,
    });
    for (const overlay of overlay_roots) {
        hide_element(overlay);
    }

    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.classList.remove('overflow-hidden', 'no-scroll', 'modal-open');

    return hidden_count;
}

/**
 * @param {HTMLElement} element
 * @param {(element: HTMLElement) => boolean} is_visible_fn
 * @returns {boolean}
 */
function is_icon_only_close_button(element, is_visible_fn) {
    if (!(element instanceof HTMLElement)) return false;
    if (!is_visible_fn(element)) return false;
    const tag = element.tagName;
    if (tag !== 'BUTTON' && element.getAttribute('role') !== 'button') return false;
    const rect = element.getBoundingClientRect();
    if (rect.width > 72 || rect.height > 72) return false;
    const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length > 2) return false;
    const has_svg = element.querySelector('svg') !== null;
    const has_icon_class = /\b(close|dismiss|icon)\b/i.test(element.className || '');
    return has_svg || has_icon_class || text === '×' || text === '✕' || text === 'x' || text === 'X';
}

/**
 * @param {HTMLElement} button
 * @param {HTMLElement} root
 * @param {(element: HTMLElement) => boolean} is_visible_fn
 * @returns {boolean}
 */
function is_close_button_in_dialog_corner(button, root, is_visible_fn) {
    if (!is_icon_only_close_button(button, is_visible_fn)) return false;
    const root_rect = root.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    const top_offset = rect.top - root_rect.top;
    const right_offset = root_rect.right - rect.right;
    const top_limit = Math.max(96, root_rect.height * 0.22);
    const right_limit = Math.max(96, root_rect.width * 0.22);
    return top_offset <= top_limit && right_offset <= right_limit;
}

/**
 * @param {HTMLElement} root
 * @param {(element: HTMLElement) => boolean} is_visible_fn
 * @returns {boolean}
 */
function has_icon_close_in_corner(root, is_visible_fn) {
    if (!(root instanceof HTMLElement)) return false;
    const candidates = root.querySelectorAll('button, [role="button"]');
    for (const candidate of candidates) {
        if (is_close_button_in_dialog_corner(candidate, root, is_visible_fn)) return true;
    }
    return false;
}

/**
 * @param {object} config
 * @returns {HTMLElement[]}
 */
export function browser_find_intrusive_overlay_roots(config) {
    const detection = config.overlay_detection || {};
    const context_keywords = detection.context_keywords || [];
    const consent_exclusion = detection.consent_exclusion_keywords || [];
    const generic_keywords = detection.generic_context_keywords || [];
    const min_z = detection.min_z_index ?? 50;
    const backdrop_ratio = detection.backdrop_min_coverage_ratio ?? 0.25;
    const dialog_min_ratio = detection.dialog_min_width_ratio ?? 0.15;
    const positions = detection.positions || ['fixed', 'sticky', 'absolute'];

    const is_visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 4 && rect.height > 4;
    };

    const normalize_text = (text) => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();

    const text_suggests_consent = (text) => {
        const normalized = normalize_text(text);
        if (!normalized) return false;
        return consent_exclusion.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
    };

    const text_suggests_intrusive = (text) => {
        const normalized = normalize_text(text);
        if (!normalized || text_suggests_consent(normalized)) return false;
        return context_keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
    };

    const text_suggests_generic_popup = (text) => {
        const normalized = normalize_text(text);
        if (!normalized) return false;
        return generic_keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
    };

    const is_dialog_like = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const role = element.getAttribute('role');
        const aria_modal = element.getAttribute('aria-modal');
        if (role === 'dialog' || aria_modal === 'true') return true;
        return element.tagName === 'DIALOG' && element.hasAttribute('open');
    };

    const is_backdrop_like = (element) => {
        if (!is_visible(element)) return false;
        const style = window.getComputedStyle(element);
        if (!positions.includes(style.position)) return false;
        const z_index = Number.parseInt(style.zIndex, 10);
        if (!Number.isNaN(z_index) && z_index < min_z) return false;
        const rect = element.getBoundingClientRect();
        const vw = window.innerWidth || document.documentElement.clientWidth || 1;
        const vh = window.innerHeight || document.documentElement.clientHeight || 1;
        return rect.width / vw >= backdrop_ratio && rect.height / vh >= backdrop_ratio;
    };

    const read_clickable_label = (element) => {
        if (!(element instanceof HTMLElement)) return '';
        const aria = element.getAttribute('aria-label') || '';
        const title = element.getAttribute('title') || '';
        const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
        return [text, aria, title].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
    };

    const has_visible_close_control = (root) => {
        for (const selector of config.close_selectors || []) {
            try {
                const match = root.querySelector(selector);
                if (is_visible(match)) return true;
            } catch {
                // Ogiltig selector.
            }
        }
        const reject_patterns = config.reject_text_patterns || [];
        const close_patterns = config.close_text_patterns || [];
        const candidates = root.querySelectorAll(
            'button, a[role="button"], input[type="button"], [role="button"]'
        );
        for (const candidate of candidates) {
            if (!is_visible(candidate)) continue;
            const label = read_clickable_label(candidate);
            const normalized = normalize_text(label);
            if (!normalized) continue;
            if (reject_patterns.some((p) => normalized.includes(String(p).toLowerCase()))) continue;
            if (close_patterns.some((p) => normalized.includes(String(p).toLowerCase()))) return true;
        }
        if (has_icon_close_in_corner(root, is_visible)) return true;
        return false;
    };

    const is_intrusive_overlay_candidate = (element) => {
        if (!is_visible(element)) return false;
        const text = element.innerText || element.textContent || '';
        if (text_suggests_consent(text)) return false;

        const intrusive = text_suggests_intrusive(text);
        const dialog = is_dialog_like(element);
        const backdrop = is_backdrop_like(element);

        if (intrusive) {
            return dialog || backdrop || has_visible_close_control(element);
        }

        if (dialog && text_suggests_generic_popup(text) && has_visible_close_control(element)) {
            return true;
        }

        if (dialog && has_visible_close_control(element)) {
            const rect = element.getBoundingClientRect();
            const vw = window.innerWidth || document.documentElement.clientWidth || 1;
            if (rect.width / vw >= dialog_min_ratio) return true;
        }

        return false;
    };

    const roots = [];
    const seen = new Set();

    const add_root = (element) => {
        if (!(element instanceof HTMLElement) || seen.has(element)) return;
        if (!is_intrusive_overlay_candidate(element)) return;
        seen.add(element);
        roots.push(element);
    };

    for (const selector of config.container_selectors || []) {
        let containers = [];
        try {
            containers = Array.from(document.querySelectorAll(selector));
        } catch {
            continue;
        }
        for (const container of containers) {
            add_root(container);
        }
    }

    if (roots.length === 0) {
        document.querySelectorAll('body *').forEach((node) => {
            if (node instanceof HTMLElement) {
                add_root(node);
            }
        });
    }

    return roots;
}

/**
 * @param {object} config
 * @returns {boolean}
 */
export function browser_dismiss_intrusive_overlays(config) {
    const is_visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 4 && rect.height > 4;
    };

    const read_clickable_label = (element) => {
        if (!(element instanceof HTMLElement)) return '';
        const aria = element.getAttribute('aria-label') || '';
        const title = element.getAttribute('title') || '';
        const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
        return [text, aria, title].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
    };

    const label_matches_close = (label) => {
        const normalized = String(label || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!normalized) return false;
        const reject = config.reject_text_patterns || [];
        for (const pattern of reject) {
            if (normalized.includes(String(pattern).toLowerCase())) return false;
        }
        const close_patterns = config.close_text_patterns || [];
        return close_patterns.some((pattern) => normalized.includes(String(pattern).toLowerCase()));
    };

    const try_click = (element) => {
        if (!(element instanceof HTMLElement) || !is_visible(element)) return false;
        element.click();
        return true;
    };

    const find_close_in_root = (root) => {
        for (const selector of config.close_selectors || []) {
            try {
                const match = root.querySelector(selector);
                if (try_click(match)) return true;
            } catch {
                // Ogiltig selector.
            }
        }

        const candidates = root.querySelectorAll(
            'button, a[role="button"], input[type="button"], [role="button"]'
        );
        for (const candidate of candidates) {
            const label = read_clickable_label(candidate);
            if (label_matches_close(label) && try_click(candidate)) return true;
        }
        const icon_candidates = root.querySelectorAll('button, [role="button"]');
        for (const candidate of icon_candidates) {
            if (is_close_button_in_dialog_corner(candidate, root, is_visible) && try_click(candidate)) {
                return true;
            }
        }
        return false;
    };

    const overlay_roots = browser_find_intrusive_overlay_roots(config);
    for (const overlay of overlay_roots) {
        if (find_close_in_root(overlay)) return true;
    }

    if (overlay_roots.length > 0) {
        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true })
        );
        return true;
    }

    return false;
}

/**
 * @param {object} config
 * @returns {boolean}
 */
export function browser_is_intrusive_overlay_visible(config) {
    const detection = config.overlay_detection || {};
    const context_keywords = detection.context_keywords || [];
    const consent_exclusion = detection.consent_exclusion_keywords || [];

    const is_visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 4 && rect.height > 4;
    };

    const normalize_text = (text) => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();

    const text_suggests_consent = (text) => {
        const normalized = normalize_text(text);
        if (!normalized) return false;
        return consent_exclusion.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
    };

    const text_suggests_intrusive = (text) => {
        const normalized = normalize_text(text);
        if (!normalized || text_suggests_consent(normalized)) return false;
        return context_keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
    };

    for (const selector of config.chat_hide_only_selectors || []) {
        let elements = [];
        try {
            elements = Array.from(document.querySelectorAll(selector));
        } catch {
            continue;
        }
        for (const element of elements) {
            if (is_visible(element)) return true;
        }
    }

    for (const container_selector of config.container_selectors || []) {
        let containers = [];
        try {
            containers = Array.from(document.querySelectorAll(container_selector));
        } catch {
            continue;
        }
        for (const container of containers) {
            if (!is_visible(container)) continue;
            const text = container.innerText || container.textContent || '';
            if (text_suggests_intrusive(text)) return true;
        }
    }

    return false;
}

/**
 * @param {object} config
 * @returns {number}
 */
export function browser_hide_intrusive_overlays_for_screenshot(config) {
    let hidden_count = 0;

    const hide_element = (element) => {
        if (!(element instanceof HTMLElement)) return;
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('opacity', '0', 'important');
        element.style.setProperty('pointer-events', 'none', 'important');
        hidden_count += 1;
    };

    for (const selector of config.hide_selectors || []) {
        let elements = [];
        try {
            elements = Array.from(document.querySelectorAll(selector));
        } catch {
            continue;
        }
        for (const element of elements) {
            hide_element(element);
        }
    }

    for (const overlay of browser_find_intrusive_overlay_roots(config)) {
        hide_element(overlay);
    }

    const detection = config.overlay_detection || {};
    const backdrop_ratio = detection.backdrop_min_coverage_ratio ?? 0.25;
    const min_z = detection.min_z_index ?? 50;
    const positions = detection.positions || ['fixed', 'sticky', 'absolute'];
    const is_backdrop_like = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }
        if (!positions.includes(style.position)) return false;
        const z_index = Number.parseInt(style.zIndex, 10);
        if (!Number.isNaN(z_index) && z_index < min_z) return false;
        const rect = element.getBoundingClientRect();
        const vw = window.innerWidth || document.documentElement.clientWidth || 1;
        const vh = window.innerHeight || document.documentElement.clientHeight || 1;
        return rect.width / vw >= backdrop_ratio && rect.height / vh >= backdrop_ratio;
    };

    if (hidden_count > 0) {
        document.querySelectorAll('body *').forEach((node) => {
            if (is_backdrop_like(node)) hide_element(node);
        });
    }

    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.classList.remove('overflow-hidden', 'no-scroll', 'modal-open');

    return hidden_count;
}

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
 * Försöker klicka bort cookie-/samtyckesbanner före skärmdump.
 * All hjälplogik måste ligga inuti funktionen — Puppeteer serialiserar bara
 * den funktion som skickas till page.evaluate(), inte modulnivå-hjälpare.
 * @param {{
 *   accept_selectors: string[];
 *   accept_all_text_patterns?: string[];
 *   accept_text_patterns: string[];
 *   reject_text_patterns: string[];
 *   container_selectors: string[];
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

    const find_accept_in_root = (root) => {
        for (const selector of config.accept_selectors) {
            try {
                const match = root.querySelector(selector);
                if (try_click(match)) return true;
            } catch {
                // Ogiltig selector — hoppa över.
            }
        }

        const accept_all_patterns = config.accept_all_text_patterns || [];
        const accept_patterns = [
            ...accept_all_patterns,
            ...(config.accept_text_patterns || []),
        ];

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
            if (label_matches_patterns(label, accept_patterns, config.reject_text_patterns)) {
                if (try_click(candidate)) return true;
            }
        }
        return false;
    };

    if (find_accept_in_root(document)) {
        return true;
    }

    for (const container_selector of config.container_selectors) {
        let containers = [];
        try {
            containers = Array.from(document.querySelectorAll(container_selector));
        } catch {
            continue;
        }
        for (const container of containers) {
            if (find_accept_in_root(container)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * @param {{ container_selectors: string[] }} config
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

    return false;
}

/**
 * Döljer kända cookie-banner DOM-noder och återställer scroll — sista steg före skärmdump.
 * @param {{ hide_selectors: string[] }} config
 * @returns {number} Antal dolda element
 */
export function browser_hide_cookie_banners_for_screenshot(config) {
    let hidden_count = 0;

    for (const selector of config.hide_selectors) {
        let elements = [];
        try {
            elements = Array.from(document.querySelectorAll(selector));
        } catch {
            continue;
        }
        for (const element of elements) {
            if (!(element instanceof HTMLElement)) continue;
            element.style.setProperty('display', 'none', 'important');
            element.style.setProperty('visibility', 'hidden', 'important');
            element.style.setProperty('opacity', '0', 'important');
            element.style.setProperty('pointer-events', 'none', 'important');
            hidden_count += 1;
        }
    }

    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.classList.remove('overflow-hidden', 'no-scroll', 'modal-open');

    return hidden_count;
}

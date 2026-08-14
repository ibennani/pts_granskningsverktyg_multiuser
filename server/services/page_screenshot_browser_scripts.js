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
    const sleep = (ms) =>
        new Promise((resolve) => {
            window.setTimeout(resolve, ms);
        });

    const count_visible_broken_images = () => {
        let count = 0;
        for (const img of document.images) {
            const rect = img.getBoundingClientRect();
            if (rect.width > 40 && rect.height > 40 && img.naturalWidth < 2) {
                count += 1;
            }
        }
        return count;
    };

    const count_undersized_visible_images = () => {
        let count = 0;
        for (const img of document.images) {
            const rect = img.getBoundingClientRect();
            if (rect.width < 48 || rect.height < 48) continue;
            if (img.naturalWidth < 2) continue;
            const min_side = Math.min(rect.width, rect.height);
            const dpr = window.devicePixelRatio || 1;
            const min_expected = Math.max(min_side * 0.72, min_side * dpr * 0.35);
            if (img.naturalWidth < min_expected) count += 1;
        }
        return count;
    };

    const deadline = Date.now() + max_wait_ms;
    while (Date.now() < deadline) {
        const pending = Array.from(document.images).filter((img) => !img.complete);
        const broken_visible = count_visible_broken_images();
        const undersized_visible = count_undersized_visible_images();
        if (pending.length === 0 && broken_visible === 0 && undersized_visible === 0) {
            return;
        }
        await sleep(100);
    }

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
        sleep(Math.max(0, deadline - Date.now())),
    ]);
}

/**
 * Tvingar lazy-bilder att ladda: eager, data-attribut, scrollIntoView för intersection observers.
 */
export async function browser_prepare_lazy_images_for_screenshot() {
    const sleep = (ms) =>
        new Promise((resolve) => {
            window.setTimeout(resolve, ms);
        });

    const parse_srcset_entries = (srcset) => {
        if (!srcset) return [];
        const entries = [];
        const width_pattern = /\s(\d+)w/g;
        let url_start = 0;
        let match = width_pattern.exec(srcset);
        while (match) {
            const width = Number.parseInt(match[1], 10);
            const url = srcset.slice(url_start, match.index).trim().replace(/^,+/, '').trim();
            if (url.startsWith('http')) {
                entries.push({ url, width: Number.isFinite(width) ? width : 0 });
            }
            url_start = width_pattern.lastIndex;
            match = width_pattern.exec(srcset);
        }
        return entries;
    };

    const collect_best_image_url = (img) => {
        let best_url = null;
        let best_score = 0;
        const consider_srcset = (srcset) => {
            for (const entry of parse_srcset_entries(srcset)) {
                if (!entry.url || !entry.url.startsWith('http')) continue;
                const capped_width = Math.min(entry.width, 1920);
                const quality_bonus = entry.url.includes('quality=80') ? 10_000 : 0;
                const score = capped_width + quality_bonus;
                if (score > best_score) {
                    best_score = score;
                    best_url = entry.url;
                }
            }
        };
        const picture = img.closest('picture');
        if (picture) {
            picture.querySelectorAll('source[srcset]').forEach((source) => {
                consider_srcset(source.getAttribute('srcset'));
            });
        }
        consider_srcset(img.getAttribute('srcset'));
        const current_src = img.currentSrc || img.src || '';
        if (!best_url && current_src) best_url = current_src;
        return best_url;
    };

    const is_undersized_visible_image = (img) => {
        const rect = img.getBoundingClientRect();
        if (rect.width < 48 || rect.height < 48) return false;
        if (img.naturalWidth < 2) return false;
        const min_side = Math.min(rect.width, rect.height);
        const dpr = window.devicePixelRatio || 1;
        const min_expected = Math.max(min_side * 0.72, min_side * dpr * 0.35);
        return img.naturalWidth < min_expected;
    };

    const replace_img_with_resolved_url = async (img, target_url) => {
        const picture = img.closest('picture');
        if (picture) picture.querySelectorAll('source').forEach((source) => source.remove());
        const replacement = document.createElement('img');
        for (const attr of ['class', 'alt', 'style', 'itemprop', 'fetchpriority']) {
            const value = img.getAttribute(attr);
            if (value != null) replacement.setAttribute(attr, value);
        }
        replacement.loading = 'eager';
        replacement.removeAttribute('srcset');
        replacement.removeAttribute('sizes');
        replacement.src = target_url;
        img.replaceWith(replacement);
        const previous_natural = img.naturalWidth;
        await new Promise((resolve) => {
            const finish = () => resolve();
            const check_loaded = () => {
                if (replacement.naturalWidth > Math.max(previous_natural, 120)) {
                    finish();
                }
            };
            replacement.addEventListener('load', check_loaded, { once: true });
            replacement.addEventListener('error', finish, { once: true });
            window.setTimeout(finish, 8000);
            if (replacement.complete) check_loaded();
        });
        await sleep(40);
    };

    const upgrade_undersized_responsive_images = async () => {
        const undersized = Array.from(document.images).filter((img) => is_undersized_visible_image(img));
        undersized.sort((a, b) => {
            const area_a = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
            const area_b = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
            return area_b - area_a;
        });
        for (const img of undersized.slice(0, 24)) {
            const best_url = collect_best_image_url(img);
            if (!best_url) continue;
            await replace_img_with_resolved_url(img, best_url);
        }
    };

    document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
        img.loading = 'eager';
    });

    document.querySelectorAll('img').forEach((img) => {
        const data_src =
            img.getAttribute('data-src') ||
            img.getAttribute('data-lazy-src') ||
            img.getAttribute('data-original');
        if (data_src && (!img.getAttribute('src') || img.getAttribute('src') === '')) {
            img.setAttribute('src', data_src);
        }
        const data_srcset = img.getAttribute('data-srcset');
        if (data_srcset && !img.getAttribute('srcset')) {
            img.setAttribute('srcset', data_srcset);
        }
    });

    const scroll_targets = Array.from(
        document.querySelectorAll('picture, img, [data-src], [data-bg]')
    ).filter((node) => {
        if (node instanceof HTMLImageElement) {
            const rect = node.getBoundingClientRect();
            if (rect.width < 4 && rect.height < 4) return false;
            if (!node.complete || node.naturalWidth < 2) return true;
            const src = node.currentSrc || node.src || '';
            return src.includes('width=1490') && node.naturalWidth < 10;
        }
        return true;
    });
    for (const node of scroll_targets) {
        if (!(node instanceof HTMLElement)) continue;
        try {
            node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        } catch {
            try {
                node.scrollIntoView({ block: 'center', inline: 'nearest' });
            } catch {
                // Ignorera scroll-fel.
            }
        }
        await sleep(40);
    }

    window.dispatchEvent(new Event('scroll'));
    await sleep(150);
    await upgrade_undersized_responsive_images();
}

/**
 * Slutlig bildfix utan scroll — anropas direkt före fullPage-skärmdump så att
 * Puppeteers intern scroll inte triggar lågupplösta picture/srcset-val.
 */
export async function browser_finalize_images_for_fullpage_screenshot() {
    const sleep = (ms) =>
        new Promise((resolve) => {
            window.setTimeout(resolve, ms);
        });

    const parse_srcset_entries = (srcset) => {
        if (!srcset) return [];
        const entries = [];
        const width_pattern = /\s(\d+)w/g;
        let url_start = 0;
        let match = width_pattern.exec(srcset);
        while (match) {
            const width = Number.parseInt(match[1], 10);
            const url = srcset.slice(url_start, match.index).trim().replace(/^,+/, '').trim();
            if (url.startsWith('http')) {
                entries.push({ url, width: Number.isFinite(width) ? width : 0 });
            }
            url_start = width_pattern.lastIndex;
            match = width_pattern.exec(srcset);
        }
        return entries;
    };

    const collect_best_image_url = (img) => {
        let best_url = null;
        let best_score = 0;
        const consider_srcset = (srcset) => {
            for (const entry of parse_srcset_entries(srcset)) {
                if (!entry.url || !entry.url.startsWith('http')) continue;
                const capped_width = Math.min(entry.width, 1920);
                const quality_bonus = entry.url.includes('quality=80') ? 10_000 : 0;
                const score = capped_width + quality_bonus;
                if (score > best_score) {
                    best_score = score;
                    best_url = entry.url;
                }
            }
        };
        const picture = img.closest('picture');
        if (picture) {
            picture.querySelectorAll('source[srcset]').forEach((source) => {
                consider_srcset(source.getAttribute('srcset'));
            });
        }
        consider_srcset(img.getAttribute('srcset'));
        const current_src = img.currentSrc || img.src || '';
        if (!best_url && current_src) best_url = current_src;
        return best_url;
    };

    const is_undersized_visible_image = (img) => {
        const rect = img.getBoundingClientRect();
        if (rect.width < 48 || rect.height < 48) return false;
        if (img.naturalWidth < 2) return false;
        const min_side = Math.min(rect.width, rect.height);
        const dpr = window.devicePixelRatio || 1;
        const min_expected = Math.max(min_side * 0.72, min_side * dpr * 0.35);
        return img.naturalWidth < min_expected;
    };

    const replace_img_with_resolved_url = async (img, target_url) => {
        const picture = img.closest('picture');
        if (picture) picture.querySelectorAll('source').forEach((source) => source.remove());
        const replacement = document.createElement('img');
        for (const attr of ['class', 'alt', 'style', 'itemprop', 'fetchpriority']) {
            const value = img.getAttribute(attr);
            if (value != null) replacement.setAttribute(attr, value);
        }
        replacement.loading = 'eager';
        replacement.removeAttribute('srcset');
        replacement.removeAttribute('sizes');
        replacement.src = target_url;
        img.replaceWith(replacement);
        const previous_natural = img.naturalWidth;
        await new Promise((resolve) => {
            const finish = () => resolve();
            const check_loaded = () => {
                if (replacement.naturalWidth > Math.max(previous_natural, 120)) finish();
            };
            replacement.addEventListener('load', check_loaded, { once: true });
            replacement.addEventListener('error', finish, { once: true });
            window.setTimeout(finish, 8000);
            if (replacement.complete) check_loaded();
        });
        await sleep(20);
    };

    document.querySelectorAll('img').forEach((img) => {
        img.loading = 'eager';
    });
    document.querySelectorAll('picture source').forEach((source) => source.remove());

    const undersized = Array.from(document.images).filter((img) => is_undersized_visible_image(img));
    undersized.sort((a, b) => {
        const area_a = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
        const area_b = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
        return area_b - area_a;
    });
    for (const img of undersized.slice(0, 24)) {
        const best_url = collect_best_image_url(img);
        if (!best_url) continue;
        await replace_img_with_resolved_url(img, best_url);
    }
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

export function browser_read_main_content_lengths() {
    const read_len = (node) => (node?.textContent || '').replace(/\s+/g, ' ').trim().length;
    const main_lengths = Array.from(
        document.querySelectorAll('main, [role="main"], article')
    ).map((node) => read_len(node));

    return {
        main_lengths,
        body_text_length: read_len(document.body),
    };
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

const INTRUSIVE_CLOSE_LABEL_EXCLUSIONS = [
    'stäng menyn',
    'stäng meny',
    'stäng navigering',
    'stäng navigation',
    'close menu',
    'close navigation',
    'lukk meny',
    'lukk navigering',
    'öppna menyn',
    'open menu',
    'öppna navigering',
    'open navigation',
];

/**
 * @param {string} label
 * @returns {boolean}
 */
function label_is_close_label_excluded(label) {
    const normalized = String(label || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalized) return false;
    return INTRUSIVE_CLOSE_LABEL_EXCLUSIONS.some((pattern) => normalized.includes(pattern));
}

/**
 * @param {string} normalized_text
 * @param {string} keyword
 * @returns {boolean}
 */
function intrusive_context_keyword_matches(normalized_text, keyword) {
    const kw = String(keyword || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!kw || !normalized_text) return false;
    if (kw.length <= 2 || /[%$@#]/.test(kw) || kw.includes(' ')) {
        return normalized_text.includes(kw);
    }
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundary = '(?:^|[\\s,.:;!?()"\'«»\\[\\]-])';
    const re = new RegExp(`${boundary}${escaped}(?:$|[\\s,.:;!?()"\'«»\\[\\]-]|s)`, 'i');
    return re.test(normalized_text);
}

/**
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function is_dialog_like_overlay_element(element) {
    if (!(element instanceof HTMLElement)) return false;
    const role = element.getAttribute('role');
    const aria_modal = element.getAttribute('aria-modal');
    if (role === 'dialog' || aria_modal === 'true') return true;
    return element.tagName === 'DIALOG' && element.hasAttribute('open');
}

/**
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function is_inside_primary_content_landmark(element) {
    if (!(element instanceof HTMLElement)) return false;
    let parent = element.parentElement;
    while (parent) {
        const tag = parent.tagName;
        if (
            tag === 'MAIN' ||
            tag === 'HEADER' ||
            tag === 'NAV' ||
            tag === 'FOOTER' ||
            tag === 'ARTICLE'
        ) {
            if (is_dialog_like_overlay_element(parent)) return false;
            return true;
        }
        parent = parent.parentElement;
    }
    return false;
}

/**
 * @param {HTMLElement[]} roots
 * @returns {HTMLElement[]}
 */
function minimize_overlay_roots_to_outermost(roots) {
    return roots.filter((root) => {
        return !roots.some((other) => other !== root && other.contains(root));
    });
}

const SHADOW_MARKETING_CLOSE_SELECTORS = [
    '.close',
    '.modal-close',
    '[class*="close-button"]',
    '[class*="closeButton"]',
    'button[aria-label*="close" i]',
    'button[aria-label*="stäng" i]',
    '[role="button"][aria-label*="close" i]',
    '[role="button"][aria-label*="stäng" i]',
];

/**
 * @param {object} config
 * @returns {boolean}
 */
function try_dismiss_shadow_marketing_hosts(config) {
    const selectors = config.shadow_host_selectors || [];
    const is_visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 4 && rect.height > 4;
    };

    for (const selector of selectors) {
        let hosts = [];
        try {
            hosts = Array.from(document.querySelectorAll(selector));
        } catch {
            continue;
        }
        for (const host of hosts) {
            if (!(host instanceof HTMLElement) || !host.shadowRoot) continue;
            const root = host.shadowRoot;
            for (const close_selector of SHADOW_MARKETING_CLOSE_SELECTORS) {
                try {
                    const match = root.querySelector(close_selector);
                    if (match instanceof HTMLElement && is_visible(match)) {
                        match.click();
                        globalThis.__gv_overlay_dismiss_hint = { kind: 'shadow_host', value: selector };
                        return true;
                    }
                } catch {
                    // Ogiltig selector.
                }
            }
            const modal = root.querySelector('.modal, .layout-popup, [class*="modal"]');
            if (modal instanceof HTMLElement) {
                const buttons = modal.querySelectorAll('button, [role="button"]');
                for (const candidate of buttons) {
                    if (
                        candidate instanceof HTMLElement &&
                        is_close_button_in_dialog_corner(candidate, modal, is_visible)
                    ) {
                        candidate.click();
                        globalThis.__gv_overlay_dismiss_hint = { kind: 'shadow_host', value: selector };
                        return true;
                    }
                }
            }
        }
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
        return context_keywords.some((keyword) => intrusive_context_keyword_matches(normalized, keyword));
    };

    const text_suggests_generic_popup = (text) => {
        const normalized = normalize_text(text);
        if (!normalized) return false;
        return generic_keywords.some((keyword) => intrusive_context_keyword_matches(normalized, keyword));
    };

    const is_dialog_like = (element) => is_dialog_like_overlay_element(element);

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
            if (label_is_close_label_excluded(normalized)) continue;
            if (reject_patterns.some((p) => normalized.includes(String(p).toLowerCase()))) continue;
            if (close_patterns.some((p) => normalized.includes(String(p).toLowerCase()))) return true;
        }
        if (has_icon_close_in_corner(root, is_visible)) return true;
        return false;
    };

    const is_intrusive_overlay_candidate = (element) => {
        if (!is_visible(element)) return false;
        const tag = element.tagName;
        if (
            (tag === 'FOOTER' || tag === 'MAIN' || tag === 'NAV' || tag === 'HEADER') &&
            !is_dialog_like(element)
        ) {
            return false;
        }
        if (is_inside_primary_content_landmark(element) && !is_dialog_like(element)) {
            return false;
        }
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
            const vh = window.innerHeight || document.documentElement.clientHeight || 1;
            if (rect.width / vw >= dialog_min_ratio && rect.height / vh >= 0.1) return true;
        }

        if (has_icon_close_in_corner(element, is_visible)) {
            const rect = element.getBoundingClientRect();
            const vw = window.innerWidth || document.documentElement.clientWidth || 1;
            const vh = window.innerHeight || document.documentElement.clientHeight || 1;
            if (rect.width / vw >= dialog_min_ratio && rect.height / vh >= 0.12) return true;
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
        const fallback_selectors = ['[role="dialog"]', '[aria-modal="true"]', 'dialog[open]', 'body > *'];
        for (const selector of fallback_selectors) {
            let nodes = [];
            try {
                nodes = Array.from(document.querySelectorAll(selector));
            } catch {
                continue;
            }
            for (const node of nodes) {
                if (!(node instanceof HTMLElement)) continue;
                if (selector === 'body > *') {
                    const style = window.getComputedStyle(node);
                    if (!['fixed', 'sticky'].includes(style.position)) continue;
                    const z_index = Number.parseInt(style.zIndex, 10);
                    if (!Number.isNaN(z_index) && z_index < min_z) continue;
                    const rect = node.getBoundingClientRect();
                    const vw = window.innerWidth || document.documentElement.clientWidth || 1;
                    const vh = window.innerHeight || document.documentElement.clientHeight || 1;
                    if (rect.width / vw < 0.2 || rect.height / vh < 0.15) continue;
                }
                add_root(node);
            }
        }
    }

    return minimize_overlay_roots_to_outermost(roots);
}

/**
 * @param {object} config
 * @returns {{ clicked: boolean, hint: { kind: string, value: string } | null }}
 */
export function browser_dismiss_intrusive_overlays(config) {
    const set_dismiss_hint = (kind, value) => {
        if (typeof value === 'string' && value.trim()) {
            globalThis.__gv_overlay_dismiss_hint = { kind, value: value.trim() };
        }
    };

    const read_dismiss_hint = () => globalThis.__gv_overlay_dismiss_hint || null;

    delete globalThis.__gv_overlay_dismiss_hint;

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
        if (label_is_close_label_excluded(normalized)) return false;
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
                if (try_click(match)) {
                    set_dismiss_hint('close_selector', selector);
                    return true;
                }
            } catch {
                // Ogiltig selector.
            }
        }

        const candidates = root.querySelectorAll(
            'button, a[role="button"], input[type="button"], [role="button"]'
        );
        for (const candidate of candidates) {
            const label = read_clickable_label(candidate);
            if (label_matches_close(label) && try_click(candidate)) {
                set_dismiss_hint('close_selector', `[data-gv-overlay-label="${label.slice(0, 48)}"]`);
                return true;
            }
        }
        const icon_candidates = root.querySelectorAll('button, [role="button"]');
        for (const candidate of icon_candidates) {
            if (is_close_button_in_dialog_corner(candidate, root, is_visible) && try_click(candidate)) {
                set_dismiss_hint('close_selector', 'button.icon-close-in-corner');
                return true;
            }
        }
        return false;
    };

    const overlay_roots = browser_find_intrusive_overlay_roots(config);
    for (const overlay of overlay_roots) {
        if (find_close_in_root(overlay)) {
            return { clicked: true, hint: read_dismiss_hint() };
        }
    }

    if (try_dismiss_shadow_marketing_hosts(config)) {
        return { clicked: true, hint: read_dismiss_hint() };
    }

    if (overlay_roots.length > 0) {
        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true })
        );
        return { clicked: true, hint: { kind: 'close_selector', value: 'keyboard:escape' } };
    }

    return { clicked: false, hint: null };
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
        return context_keywords.some((keyword) => intrusive_context_keyword_matches(normalized, keyword));
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

    for (const selector of config.shadow_host_selectors || []) {
        let hosts = [];
        try {
            hosts = Array.from(document.querySelectorAll(selector));
        } catch {
            continue;
        }
        for (const host of hosts) {
            if (!(host instanceof HTMLElement)) continue;
            const style = window.getComputedStyle(host);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
                continue;
            }
            const rect = host.getBoundingClientRect();
            if (rect.width > 4 && rect.height > 4) return true;
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

    for (const selector of config.shadow_host_selectors || []) {
        let hosts = [];
        try {
            hosts = Array.from(document.querySelectorAll(selector));
        } catch {
            continue;
        }
        for (const host of hosts) {
            hide_element(host);
        }
    }

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
            if (!(node instanceof HTMLElement)) return;
            if (is_inside_primary_content_landmark(node)) return;
            if (is_backdrop_like(node)) hide_element(node);
        });
    }

    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.classList.remove('overflow-hidden', 'no-scroll', 'modal-open');

    return hidden_count;
}

/**
 * @fileoverview Puppeteer browser_scripts för Bilaga 1 TOC-sidnummer.
 * Ren JavaScript — laddas via appendix1_toc_browser_scripts_loader.ts så tsx/esbuild
 * inte injicerar __name i kod som serialiseras till page.evaluate.
 */

/**
 * Väntar på webbtypsnitt och två animation frames så print-layout är stabil.
 */
export async function browser_wait_for_print_layout() {
    const wait_frames = () =>
        new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });

    if (document.fonts && document.fonts.ready) {
        try {
            await document.fonts.ready;
        } catch (_error) {
            /* fortsätt ändå */
        }
    }
    await wait_frames();
}

/**
 * @param {number} page_height_mm
 * @param {number} px_per_mm
 * @returns {{ filled: number, skipped: number, missing_target: number, missing_span: number }}
 */
export function browser_inject_appendix1_toc_page_numbers(page_height_mm, px_per_mm) {
    const page_height_px = page_height_mm * px_per_mm;

    function compute_page(top_mm) {
        if (!Number.isFinite(top_mm) || top_mm < 0) {
            return 1;
        }
        return Math.floor(top_mm / page_height_mm) + 1;
    }

    function resolve_target_id(link) {
        const attr = link.getAttribute('href');
        if (attr && attr.startsWith('#')) {
            return attr.slice(1);
        }
        try {
            const hash = new URL(link.href).hash;
            if (hash && hash.startsWith('#')) {
                return hash.slice(1);
            }
        } catch (_error) {
            /* ignorera ogiltig URL */
        }
        return null;
    }

    function find_layout_root() {
        return document.querySelector('main.appendix1-document') || document.body;
    }

    function has_page_break_before(element) {
        const style = window.getComputedStyle(element);
        const before = style.breakBefore || style.pageBreakBefore || '';
        return before === 'page' || before === 'always' || before === 'left' || before === 'right';
    }

    function sum_preceding_sibling_heights_px(element, stop_at) {
        let total = 0;
        let node = element;
        while (node && node !== stop_at) {
            let previous = node.previousElementSibling;
            while (previous) {
                total += previous.offsetHeight || 0;
                previous = previous.previousElementSibling;
            }
            node = node.parentElement;
        }
        return total;
    }

    function element_top_mm(element) {
        const root = find_layout_root();
        let top_px = sum_preceding_sibling_heights_px(element, root);

        const cover = root.querySelector('.appendix1-cover');
        if (cover && (cover.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)) {
            const cover_end_px = (cover.offsetTop || 0) + (cover.offsetHeight || 0);
            if (top_px < cover_end_px) {
                top_px = cover_end_px;
            }
        }

        if (has_page_break_before(element)) {
            top_px = Math.ceil(top_px / page_height_px) * page_height_px;
        }

        const root_rect = root.getBoundingClientRect();
        const element_rect = element.getBoundingClientRect();
        const from_rect_px = element_rect.top - root_rect.top + (window.scrollY || 0);
        top_px = Math.max(top_px, from_rect_px);

        return top_px / px_per_mm;
    }

    const stats = { filled: 0, skipped: 0, missing_target: 0, missing_span: 0 };
    const links = document.querySelectorAll('.appendix1-toc__link');

    for (const link of links) {
        const page_span = link.querySelector('.appendix1-toc__page');
        if (!page_span) {
            stats.missing_span += 1;
            stats.skipped += 1;
            continue;
        }

        const target_id = resolve_target_id(link);
        if (!target_id) {
            stats.skipped += 1;
            continue;
        }

        const target = document.getElementById(target_id);
        if (!target) {
            stats.missing_target += 1;
            stats.skipped += 1;
            continue;
        }

        page_span.textContent = String(compute_page(element_top_mm(target)));
        stats.filled += 1;
    }

    return stats;
}

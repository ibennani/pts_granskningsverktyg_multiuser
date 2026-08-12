/**
 * @fileoverview Fas 2 – riktad, säker interaktion med huvudmenyn.
 * Detta är den enda recurring-komponenten som öppnas automatiskt.
 */
import type { Page } from 'puppeteer';
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { write_analysis_png } from '../snapshot_analysis_io.js';
import { restore_baseline_viewport } from '../snapshot_viewport_baseline.js';

const MAX_TAB_STEPS = 24;

async function delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function detect_menu_trigger(page: Page): Promise<Record<string, unknown> | null> {
    return page.evaluate(() => {
        const visible = (el: Element) => {
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 4 && r.height > 4;
        };
        const path = (el: Element) => {
            const parts: string[] = [];
            let node: Element | null = el;
            while (node && node !== document.documentElement && parts.length < 12) {
                let part = node.tagName.toLowerCase();
                if ((node as HTMLElement).id) {
                    part += `#${CSS.escape((node as HTMLElement).id)}`;
                    parts.unshift(part);
                    break;
                }
                const parent = node.parentElement;
                if (parent) {
                    const siblings = Array.from(parent.children).filter((child) => child.tagName === node!.tagName);
                    if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
                }
                parts.unshift(part);
                node = parent;
            }
            return parts.join(' > ');
        };
        const candidates = Array.from(document.querySelectorAll(
            'header button,[role="banner"] button,header [role="button"],[role="banner"] [role="button"],header [aria-expanded],[role="banner"] [aria-expanded],header [aria-haspopup],[role="banner"] [aria-haspopup]'
        )).filter(visible);
        const scored = candidates.map((el) => {
            const label = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
            const lower = label.toLowerCase();
            let score = 0;
            const reasons: string[] = [];
            if (el.hasAttribute('aria-expanded')) { score += 55; reasons.push('aria-expanded'); }
            if ((el.getAttribute('aria-haspopup') || '').toLowerCase() === 'menu') { score += 35; reasons.push('aria-haspopup-menu'); }
            if (el.hasAttribute('aria-controls')) { score += 20; reasons.push('aria-controls'); }
            if (/\b(meny|menu|sortiment|navigation)\b/i.test(lower)) { score += 25; reasons.push('menu-label'); }
            if (el.tagName.toLowerCase() === 'button') { score += 10; reasons.push('native-button'); }
            if (el.tagName.toLowerCase() === 'a' && el.hasAttribute('href')) score -= 100;
            return { el, score, reasons, label };
        }).filter((item) => item.score >= 45).sort((a,b) => b.score - a.score);
        const best = scored[0];
        if (!best) return null;
        const rect = best.el.getBoundingClientRect();
        return {
            domPath: path(best.el),
            tagName: best.el.tagName.toLowerCase(),
            id: (best.el as HTMLElement).id || null,
            label: best.label || null,
            score: best.score,
            reasons: best.reasons,
            ariaExpanded: best.el.getAttribute('aria-expanded'),
            ariaControls: best.el.getAttribute('aria-controls'),
            ariaHaspopup: best.el.getAttribute('aria-haspopup'),
            boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        };
    });
}

async function collect_open_state(page: Page, trigger_path: string): Promise<Record<string, unknown>> {
    return page.evaluate((triggerPath) => {
        const trigger = document.querySelector(triggerPath);
        const visible = (el: Element | null) => {
            if (!el) return false;
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 4 && r.height > 4;
        };
        const controlledId = trigger?.getAttribute('aria-controls') || '';
        const controlled = controlledId ? document.getElementById(controlledId) : null;
        const menuRoot = visible(controlled)
            ? controlled
            : Array.from(document.querySelectorAll('nav,[role="navigation"],[role="menu"],[role="menubar"]'))
                .filter(visible)
                .sort((a,b) => b.querySelectorAll('a[href],button,[role="menuitem"]').length - a.querySelectorAll('a[href],button,[role="menuitem"]').length)[0] || null;
        const active = document.activeElement as HTMLElement | null;
        const rect = menuRoot?.getBoundingClientRect();
        return {
            trigger: {
                ariaExpanded: trigger?.getAttribute('aria-expanded') || null,
                ariaControls: controlledId || null,
            },
            menuFound: Boolean(menuRoot),
            menu: menuRoot ? {
                tagName: menuRoot.tagName.toLowerCase(),
                id: (menuRoot as HTMLElement).id || null,
                role: menuRoot.getAttribute('role'),
                ariaLabel: menuRoot.getAttribute('aria-label'),
                textExcerpt: (menuRoot.textContent || '').replace(/\s+/g,' ').trim().slice(0,1200),
                outerHTML: menuRoot.outerHTML.slice(0,30000),
                outerHTMLTruncated: menuRoot.outerHTML.length > 30000,
                counts: {
                    links: menuRoot.querySelectorAll('a[href],[role="link"],[role="menuitem"]').length,
                    buttons: menuRoot.querySelectorAll('button,[role="button"]').length,
                    headings: menuRoot.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]').length,
                    lists: menuRoot.querySelectorAll('ul,ol,[role="list"],[role="menu"]').length,
                },
                boundingBox: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
            } : null,
            activeElement: active ? {
                tagName: active.tagName.toLowerCase(),
                id: active.id || null,
                name: active.getAttribute('aria-label') || active.textContent?.replace(/\s+/g,' ').trim().slice(0,200) || null,
            } : null,
        };
    }, trigger_path);
}

async function run_menu_mode(
    ctx: AnalysisContext,
    mode: 'desktop' | 'narrow320'
): Promise<Record<string, unknown>> {
    if (mode === 'narrow320') {
        await ctx.page.setViewport({ width: 320, height: 800, deviceScaleFactor: 2 });
        await delay(250);
    }

    const trigger = await detect_menu_trigger(ctx.page);
    if (!trigger) return { mode, found: false, reason: 'no-safe-main-menu-trigger' };
    const trigger_path = String(trigger.domPath || '');
    const handle = trigger_path ? await ctx.page.$(trigger_path) : null;
    if (!handle) return { mode, found: false, reason: 'trigger-not-resolved', trigger };

    const initial_url = ctx.page.url();
    await handle.focus();
    const before = await collect_open_state(ctx.page, trigger_path);
    await ctx.page.keyboard.press('Enter');
    await delay(250);
    if (ctx.page.url() !== initial_url) {
        ctx.mark_page_state_corrupted();
        return { mode, found: true, trigger, before, interaction: 'aborted-navigation' };
    }
    const open = await collect_open_state(ctx.page, trigger_path);

    let screenshot_path: string | null = null;
    if ((open as { menuFound?: boolean }).menuFound && ctx.screenshot_budget.remaining > 0) {
        const path = `analysis/phase2/menu-${mode}-open.png`;
        const png = await ctx.page.screenshot({ type: 'png', fullPage: false });
        await write_analysis_png(ctx.temp_dir, path, Buffer.from(png));
        ctx.screenshot_budget.remaining -= 1;
        screenshot_path = path;
    }

    const focus_steps: Array<Record<string, unknown>> = [];
    for (let i = 0; i < MAX_TAB_STEPS && !ctx.should_stop(); i++) {
        await ctx.page.keyboard.press('Tab');
        await delay(25);
        const step = await ctx.page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el || el === document.body) return null;
            const rect = el.getBoundingClientRect();
            return {
                tagName: el.tagName.toLowerCase(),
                id: el.id || null,
                role: el.getAttribute('role'),
                name: el.getAttribute('aria-label') || el.textContent?.replace(/\s+/g,' ').trim().slice(0,180) || null,
                href: el.tagName.toLowerCase() === 'a' ? el.getAttribute('href') : null,
                boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            };
        });
        if (step) focus_steps.push(step);
        if (focus_steps.length > 1) {
            const first = focus_steps[0];
            const last = focus_steps[focus_steps.length - 1];
            if (first.id && first.id === last.id) break;
        }
    }

    await ctx.page.keyboard.press('Escape');
    await delay(150);
    const closed = await collect_open_state(ctx.page, trigger_path);

    return {
        mode,
        found: true,
        trigger,
        before,
        open,
        screenshotPath: screenshot_path,
        focusSteps: focus_steps,
        closedAfterEscape: closed,
    };
}

export async function run_menu_interaction_analysis(
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const records: Array<Record<string, unknown>> = [];
    try {
        records.push(await run_menu_mode(ctx, 'desktop'));
        if (!ctx.page_state_corrupted() && !ctx.should_stop()) {
            records.push(await run_menu_mode(ctx, 'narrow320'));
        }
    } finally {
        if (!ctx.page_state_corrupted()) {
            await restore_baseline_viewport(ctx.page);
            await delay(150);
        }
    }

    const found_count = records.filter((record) => record.found === true).length;
    return {
        module: 'main-menu-states',
        version: 1,
        phase: 2,
        status: found_count > 0 ? 'success' : 'skipped',
        durationMs: Date.now() - started,
        recordCount: found_count,
        truncated: false,
        skipReason: found_count > 0 ? null : 'no-main-menu-trigger',
        warnings: [],
        data: {
            interactionPolicy: 'main-menu-only',
            records,
        },
    };
}

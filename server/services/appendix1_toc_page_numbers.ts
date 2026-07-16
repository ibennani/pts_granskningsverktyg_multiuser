/**
 * @fileoverview Injicerar sidnummer i Bilaga 1-innehållsförteckning före PDF-rendering.
 */
import type { Page } from 'puppeteer';
import { APPENDIX1_PAGE_HEIGHT_MM } from '../../shared/pdf/appendix1_toc_page_numbers.js';
import {
    browser_inject_appendix1_toc_page_numbers,
    browser_wait_for_print_layout,
} from './appendix1_toc_browser_scripts_loader.js';

const PX_PER_MM = 96 / 25.4;

export interface Appendix1TocInjectStats {
    filled: number;
    skipped: number;
    missing_target: number;
    missing_span: number;
}

/**
 * Fyller .appendix1-toc__page med sidnummer baserat på målsektionens position i print-layout.
 * Chromium implementerar inte CSS target-counter() i Page.printToPDF.
 */
export async function inject_appendix1_toc_page_numbers(page: Page): Promise<Appendix1TocInjectStats> {
    await page.evaluate(browser_wait_for_print_layout);
    const stats = ((await page.evaluate(
        browser_inject_appendix1_toc_page_numbers,
        APPENDIX1_PAGE_HEIGHT_MM,
        PX_PER_MM
    )) ?? {
        filled: 0,
        skipped: 0,
        missing_target: 0,
        missing_span: 0,
    }) as Appendix1TocInjectStats;

    if (stats.filled === 0) {
        console.error('[pdf] Bilaga 1 TOC: inga sidnummer injicerades', stats);
    } else if (stats.skipped > 0) {
        console.warn('[pdf] Bilaga 1 TOC: sidnummer saknas för vissa poster', stats);
    }

    return stats;
}

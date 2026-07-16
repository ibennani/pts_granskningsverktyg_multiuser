/**
 * @fileoverview Beräknar sidnummer för Bilaga 1-innehållsförteckning (Puppeteer/Chromium saknar target-counter).
 */

/** A4-sidhöjd i mm, samma som @page i Bilaga 1 print-CSS. */
export const APPENDIX1_PAGE_HEIGHT_MM = 297;

/**
 * Beräknar sidnummer från avstånd från dokumentets topp i millimeter.
 * Bilaga 1 använder helsidesomslag (297 mm) följt av A4-sidor utan extra lucka i dokumentflödet.
 */
export function compute_appendix1_page_number_from_top_mm(top_mm: number): number {
    if (!Number.isFinite(top_mm) || top_mm < 0) {
        return 1;
    }
    return Math.floor(top_mm / APPENDIX1_PAGE_HEIGHT_MM) + 1;
}

/**
 * @fileoverview Enhetstester för Bilaga 1 TOC-sidnummerberäkning.
 */
import { describe, test, expect } from '@jest/globals';
import {
    APPENDIX1_PAGE_HEIGHT_MM,
    compute_appendix1_page_number_from_top_mm,
} from '../../shared/pdf/appendix1_toc_page_numbers.ts';

describe('appendix1_toc_page_numbers', () => {
    test('compute_appendix1_page_number_from_top_mm mappar omslag och följande sidor', () => {
        expect(APPENDIX1_PAGE_HEIGHT_MM).toBe(297);
        expect(compute_appendix1_page_number_from_top_mm(0)).toBe(1);
        expect(compute_appendix1_page_number_from_top_mm(150)).toBe(1);
        expect(compute_appendix1_page_number_from_top_mm(296.9)).toBe(1);
        expect(compute_appendix1_page_number_from_top_mm(297)).toBe(2);
        expect(compute_appendix1_page_number_from_top_mm(593.9)).toBe(2);
        expect(compute_appendix1_page_number_from_top_mm(594)).toBe(3);
    });

    test('ogiltiga värden ger sid 1', () => {
        expect(compute_appendix1_page_number_from_top_mm(-5)).toBe(1);
        expect(compute_appendix1_page_number_from_top_mm(Number.NaN)).toBe(1);
    });
});

/**
 * @fileoverview Enhetstester för råladdning av Bilaga 1 TOC browser_scripts.
 */
import { describe, test, expect } from '@jest/globals';
import {
    browser_inject_appendix1_toc_page_numbers,
    browser_wait_for_print_layout,
} from '../../server/services/appendix1_toc_browser_scripts_loader.ts';

describe('appendix1_toc_browser_scripts_loader', () => {
    test('laddar browser_scripts utan tsx __name-injektion', () => {
        const wait_source = browser_wait_for_print_layout.toString();
        expect(wait_source.includes('__name')).toBe(false);
        expect(wait_source.startsWith('async function browser_wait_for_print_layout')).toBe(true);

        const inject_source = browser_inject_appendix1_toc_page_numbers.toString();
        expect(inject_source.includes('__name')).toBe(false);
        expect(inject_source.startsWith('function browser_inject_appendix1_toc_page_numbers')).toBe(true);
        expect(inject_source).toContain('sum_preceding_sibling_heights_px');
        expect(inject_source).toContain('has_page_break_before');
        expect(inject_source).toContain('appendix1-cover');
    });
});

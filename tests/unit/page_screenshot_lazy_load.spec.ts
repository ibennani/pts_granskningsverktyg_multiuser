/**
 * @fileoverview Enhetstester för lazy-load-scroll före skärmdump.
 */
import { describe, test, expect } from '@jest/globals';
import { should_continue_lazy_load_passes } from '../../server/services/page_screenshot_lazy_load.ts';

describe('page_screenshot_lazy_load', () => {
    test('should_continue_lazy_load_passes stoppar vid stabil höjd', () => {
        expect(should_continue_lazy_load_passes(2, 1, 6, 2)).toBe(false);
    });

    test('should_continue_lazy_load_passes fortsätter vid växande höjd', () => {
        expect(should_continue_lazy_load_passes(0, 1, 6, 2)).toBe(true);
    });

    test('should_continue_lazy_load_passes stoppar vid max pass', () => {
        expect(should_continue_lazy_load_passes(0, 6, 6, 2)).toBe(false);
    });
});

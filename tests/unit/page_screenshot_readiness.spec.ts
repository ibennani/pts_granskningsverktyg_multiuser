import { describe, test, expect } from '@jest/globals';
import {
    MAIN_CONTENT_MIN_TEXT_LENGTH,
    page_has_main_content_text,
} from '../../server/services/page_screenshot_readiness.ts';

describe('page_screenshot_readiness', () => {
    test('godkänner main med tillräckligt text', () => {
        expect(page_has_main_content_text([120], 10)).toBe(true);
    });

    test('godkänner body när inget main-element finns', () => {
        expect(page_has_main_content_text([], MAIN_CONTENT_MIN_TEXT_LENGTH)).toBe(true);
    });

    test('avvisar tomt eller kort innehåll', () => {
        expect(page_has_main_content_text([5], 10)).toBe(false);
        expect(page_has_main_content_text([], 10)).toBe(false);
    });
});

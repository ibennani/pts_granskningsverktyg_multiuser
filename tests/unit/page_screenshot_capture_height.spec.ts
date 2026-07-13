import { describe, test, expect } from '@jest/globals';
import {
    compute_screenshot_clip_height_css,
    MAX_CAPTURE_HEIGHT_TO_WIDTH_RATIO,
} from '../../server/services/page_screenshot_capture_height.ts';

describe('page_screenshot_capture_height', () => {
    const viewport_width = 1280;

    test('behåller hela sidan när höjden är under 3:1', () => {
        expect(compute_screenshot_clip_height_css(600, viewport_width)).toBe(600);
    });

    test('begränsar höjd till tre gånger bredden', () => {
        expect(compute_screenshot_clip_height_css(5000, viewport_width)).toBe(3840);
        expect(MAX_CAPTURE_HEIGHT_TO_WIDTH_RATIO).toBe(3);
    });

    test('ger minst 1 px vid tom eller negativ höjd', () => {
        expect(compute_screenshot_clip_height_css(0, viewport_width)).toBe(1);
        expect(compute_screenshot_clip_height_css(-100, viewport_width)).toBe(1);
    });
});

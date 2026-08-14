import { describe, test, expect } from '@jest/globals';
import sharp from 'sharp';
import {
    compute_screenshot_clip_height_css,
    compute_full_document_screenshot_height_css,
    crop_png_to_max_css_height,
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

    test('full_document använder hela scrollhöjden upp till max', () => {
        expect(compute_full_document_screenshot_height_css(12_000, 50_000)).toBe(12_000);
        expect(compute_full_document_screenshot_height_css(80_000, 50_000)).toBe(50_000);
    });

    test('beskär PNG till maxhöjd i CSS-pixlar', async () => {
        const tall_png = await sharp({
            create: {
                width: 2560,
                height: 8000,
                channels: 3,
                background: { r: 200, g: 100, b: 50 },
            },
        })
            .png()
            .toBuffer();

        const cropped = await crop_png_to_max_css_height(tall_png, 3840, 2);
        const metadata = await sharp(cropped).metadata();
        expect(metadata.height).toBe(7680);
        expect(metadata.width).toBe(2560);
    });

    test('lämnar PNG oförändrad när den redan är under maxhöjd', async () => {
        const short_png = await sharp({
            create: {
                width: 2560,
                height: 1200,
                channels: 3,
                background: { r: 10, g: 20, b: 30 },
            },
        })
            .png()
            .toBuffer();

        const cropped = await crop_png_to_max_css_height(short_png, 3840, 2);
        expect(cropped.equals(short_png)).toBe(true);
    });
});

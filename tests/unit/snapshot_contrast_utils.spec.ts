/**
 * @fileoverview Enhetstester för kontrastberäkning.
 */
import { describe, test, expect } from '@jest/globals';
import {
    contrast_ratio,
    is_large_text_candidate,
    parse_font_size_px,
} from '../../server/snapshots/analysis/snapshot_contrast_utils.ts';

describe('snapshot_contrast_utils', () => {
    test('beräknar ratio för svart på vitt', () => {
        const ratio = contrast_ratio('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
        expect(ratio).not.toBeNull();
        expect(ratio!).toBeGreaterThan(20);
    });

    test('large text candidate vid 24px', () => {
        expect(is_large_text_candidate(24, 400)).toBe(true);
    });

    test('parse font size', () => {
        expect(parse_font_size_px('18px')).toBe(18);
    });

    test('returnerar null för ogiltiga färger', () => {
        expect(contrast_ratio('invalid', 'rgb(255,255,255)')).toBeNull();
    });
});

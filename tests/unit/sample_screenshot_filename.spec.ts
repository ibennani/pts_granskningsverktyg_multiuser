/**
 * @fileoverview Enhetstester för filnamn vid automatisk stickprovsskärmdump.
 */
import { describe, test, expect } from '@jest/globals';
import { build_sample_screenshot_filename } from '../../server/utils/sample_screenshot_filename.ts';

describe('build_sample_screenshot_filename', () => {
    test('bygger filnamn med sidtitel och suffix', () => {
        expect(build_sample_screenshot_filename('Startsida', 'skärmavbild')).toBe('Startsida_skärmavbild.png');
    });

    test('använder fallback när sidtitel saknas', () => {
        expect(build_sample_screenshot_filename('', 'screenshot')).toBe('sida_screenshot.png');
    });

    test('sanerar ogiltiga tecken i sidtitel', () => {
        expect(build_sample_screenshot_filename('Min sida: test', 'skärmavbild')).toBe('Min_sida__test_skärmavbild.png');
    });
});

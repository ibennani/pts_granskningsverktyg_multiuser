/**
 * @fileoverview Enhetstester för recurring_block_screenshot_logic.
 */
import { describe, test, expect } from '@jest/globals';
import {
    compute_device_crop_region,
    find_page_block_candidate,
} from '../../server/services/recurring_block_screenshot_logic.ts';

describe('recurring_block_screenshot_logic', () => {
    test('find_page_block_candidate väljer exakt fingeravtryck', () => {
        const match = find_page_block_candidate(
            [
                {
                    candidateType: 'header',
                    structureFingerprint: 'fp-a',
                    rootIdentity: '#site-header',
                    boundingBox: { x: 0, y: 0, width: 1280, height: 120 },
                },
                {
                    candidateType: 'header',
                    structureFingerprint: 'fp-b',
                    boundingBox: { x: 0, y: 0, width: 100, height: 50 },
                },
            ],
            {
                candidateType: 'header',
                structureFingerprint: 'fp-a',
                rootIdentity: '#other',
            }
        );
        expect(match?.structureFingerprint).toBe('fp-a');
    });

    test('compute_device_crop_region skalar och klampar mot bild', () => {
        const region = compute_device_crop_region(
            { x: 10, y: 20, width: 100, height: 50 },
            2560,
            1600,
            2
        );
        expect(region).toEqual({ left: 20, top: 40, width: 200, height: 100 });
    });

    test('compute_device_crop_region returnerar null utanför bild', () => {
        const region = compute_device_crop_region(
            { x: 3000, y: 0, width: 100, height: 50 },
            2560,
            1600,
            2
        );
        expect(region).toBeNull();
    });
});

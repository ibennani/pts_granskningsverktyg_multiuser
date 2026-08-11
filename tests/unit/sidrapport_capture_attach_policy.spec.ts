import { describe, test, expect } from '@jest/globals';
import {
    sample_has_attached_images,
    should_attach_screenshot_when_creating_sidrapport,
} from '../../shared/sidrapport/capture_attach_policy.ts';

describe('sidrapport capture_attach_policy', () => {
    test('should_attach_screenshot_when_creating_sidrapport är false när bild finns', () => {
        expect(
            should_attach_screenshot_when_creating_sidrapport({
                attachedMediaFilenames: ['bild.png'],
            })
        ).toBe(false);
    });

    test('should_attach_screenshot_when_creating_sidrapport är true utan bifogad bild', () => {
        expect(
            should_attach_screenshot_when_creating_sidrapport({
                attachedMediaFilenames: [],
            })
        ).toBe(true);
        expect(sample_has_attached_images(null)).toBe(false);
    });
});

/**
 * @fileoverview Enhetstester för viewport-begränsning i bildförhandsvisning.
 */

import {
    clamp_dialog_size_to_viewport,
    get_media_preview_viewport_limits
} from '../../js/logic/audit_media_preview_viewport.js';

describe('audit_media_preview_viewport', () => {
    const original_inner_width = window.innerWidth;
    const original_inner_height = window.innerHeight;

    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    });

    afterAll(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: original_inner_width });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: original_inner_height });
    });

    test('get_media_preview_viewport_limits returnerar 90 % av viewport', () => {
        expect(get_media_preview_viewport_limits()).toEqual({ width: 900, height: 720 });
    });

    test('clamp_dialog_size_to_viewport begränsar till viewport-tak', () => {
        expect(clamp_dialog_size_to_viewport({ width: 2000, height: 1500 })).toEqual({
            width: 900,
            height: 720
        });
    });

    test('clamp_dialog_size_to_viewport behåller mindre mått', () => {
        expect(clamp_dialog_size_to_viewport({ width: 400, height: 300 })).toEqual({
            width: 400,
            height: 300
        });
    });
});

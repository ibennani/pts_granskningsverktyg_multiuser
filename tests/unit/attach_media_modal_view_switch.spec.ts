/**
 * @fileoverview Enhetstester för vybytesanimation i modalen Bifoga media.
 */

import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import {
    ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS,
    run_attach_media_modal_view_switch,
    split_transition_phases
} from '../../js/components/media/attach_media_modal_view_switch.ts';

function setup_modal_dom() {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal-dialog';

    const shell = document.createElement('div');
    shell.className = 'modal-content modal-content--attach-media';

    const body = document.createElement('div');
    body.className = 'modal-body modal-body--attach-media';

    const list_root = document.createElement('div');
    list_root.className = 'attach-media-list-mode';
    list_root.style.minHeight = '120px';
    body.appendChild(list_root);

    shell.appendChild(body);
    dialog.appendChild(shell);
    document.body.appendChild(dialog);

    return { dialog, container: body, list_root, shell };
}

describe('run_attach_media_modal_view_switch', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        window.matchMedia = jest.fn().mockImplementation(() => ({
            matches: false,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        }));
        jest.useFakeTimers();
        global.requestAnimationFrame = (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        };
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('mäter ny målstorlek efter inline-vybyte', async () => {
        const { dialog, container, list_root } = setup_modal_dom();
        const measured_heights: number[] = [];
        const measure_height = jest.spyOn(dialog, 'getBoundingClientRect').mockImplementation(() => {
            const locked_height = Number.parseFloat(dialog.style.height);
            if (Number.isFinite(locked_height) && locked_height > 0) {
                measured_heights.push(locked_height);
                return {
                    width: 400,
                    height: locked_height,
                    top: 0,
                    left: 0,
                    right: 400,
                    bottom: locked_height,
                    x: 0,
                    y: 0,
                    toJSON: () => ({})
                } as DOMRect;
            }
            const content_height = list_root.style.minHeight === '320px' ? 360 : 220;
            measured_heights.push(content_height);
            return {
                width: 400,
                height: content_height,
                top: 0,
                left: 0,
                right: 400,
                bottom: content_height,
                x: 0,
                y: 0,
                toJSON: () => ({})
            } as DOMRect;
        });

        const switch_promise = run_attach_media_modal_view_switch(
            container,
            () => {
                list_root.style.minHeight = '320px';
                const panel = document.createElement('div');
                panel.className = 'attach-media-rename-panel';
                panel.style.minHeight = '220px';
                list_root.appendChild(panel);
            },
            { transition_ms: ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS }
        );

        await jest.advanceTimersByTimeAsync(ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS + 50);
        await switch_promise;

        expect(measured_heights).toContain(360);
        expect(Math.max(...measured_heights)).toBeGreaterThan(Math.min(...measured_heights));
        measure_height.mockRestore();
    });

    it('delar inline-transition i tre faser som summerar till total tid', () => {
        const phases = split_transition_phases(ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS);
        expect(phases).toEqual({ fade_out_ms: 80, resize_ms: 90, fade_in_ms: 80 });
        expect(phases.fade_out_ms + phases.resize_ms + phases.fade_in_ms).toBe(
            ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS
        );
    });

    it('byter DOM efter uttoning och tonar in nytt innehåll sekventiellt', async () => {
        const { container, shell } = setup_modal_dom();
        let swapped = false;
        const phases = split_transition_phases(ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS);

        const switch_promise = run_attach_media_modal_view_switch(
            container,
            () => {
                swapped = true;
                const panel = document.createElement('div');
                panel.className = 'attach-media-rename-panel';
                container.appendChild(panel);
            },
            { transition_ms: ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS }
        );

        expect(swapped).toBe(false);
        expect(shell.classList.contains('modal-content--attach-media-view-switch')).toBe(true);
        expect(shell.style.opacity).toBe('0');

        await jest.advanceTimersByTimeAsync(phases.fade_out_ms);
        expect(swapped).toBe(true);
        expect(container.querySelector('.attach-media-rename-panel')).not.toBeNull();
        expect(shell.style.opacity).toBe('0');

        await jest.advanceTimersByTimeAsync(phases.resize_ms - 1);
        expect(shell.style.opacity).toBe('0');

        await jest.advanceTimersByTimeAsync(1 + phases.fade_in_ms);
        await switch_promise;

        expect(shell.classList.contains('modal-content--attach-media-view-switch')).toBe(false);
        expect(shell.style.opacity).toBe('');
    });

    it('håller dialoglåst under uttoning och DOM-byte', async () => {
        const { dialog, container, list_root } = setup_modal_dom();
        const measure_height = jest.spyOn(dialog, 'getBoundingClientRect').mockImplementation(() => {
            const locked_height = Number.parseFloat(dialog.style.height);
            if (Number.isFinite(locked_height) && locked_height > 0) {
                return {
                    width: 400,
                    height: locked_height,
                    top: 0,
                    left: 0,
                    right: 400,
                    bottom: locked_height,
                    x: 0,
                    y: 0,
                    toJSON: () => ({})
                } as DOMRect;
            }
            const content_height = list_root.querySelector('.attach-media-rename-panel') ? 360 : 220;
            return {
                width: 400,
                height: content_height,
                top: 0,
                left: 0,
                right: 400,
                bottom: content_height,
                x: 0,
                y: 0,
                toJSON: () => ({})
            } as DOMRect;
        });
        let swapped = false;
        const phases = split_transition_phases(ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS);

        const switch_promise = run_attach_media_modal_view_switch(
            container,
            () => {
                swapped = true;
                const panel = document.createElement('div');
                panel.className = 'attach-media-rename-panel';
                panel.style.minHeight = '360px';
                container.appendChild(panel);
            },
            { transition_ms: ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS }
        );

        expect(dialog.style.height).toBe('220px');

        await jest.advanceTimersByTimeAsync(phases.fade_out_ms - 1);
        expect(swapped).toBe(false);
        expect(dialog.style.height).toBe('220px');

        await jest.advanceTimersByTimeAsync(1);
        expect(swapped).toBe(true);
        expect(dialog.style.height).toBe('220px');

        await jest.advanceTimersByTimeAsync(phases.resize_ms + phases.fade_in_ms + 10);
        await switch_promise;

        measure_height.mockRestore();
    });

    it('byter vy direkt vid prefers-reduced-motion', async () => {
        window.matchMedia = jest.fn().mockImplementation(() => ({
            matches: true,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        }));

        const { container } = setup_modal_dom();
        let swapped = false;

        await run_attach_media_modal_view_switch(
            container,
            () => {
                swapped = true;
                container.textContent = 'ny vy';
            },
            { transition_ms: ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS }
        );

        expect(swapped).toBe(true);
        expect(container.textContent).toBe('ny vy');
    });
});

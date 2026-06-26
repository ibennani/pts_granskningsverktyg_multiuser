/**
 * @fileoverview Enhetstester för toggle aria-live vid dynamisk text.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
    clear_temporary_live_region,
    get_button_primary_label_span,
    show_temporary_button_label_feedback,
    update_text_with_temporary_live_region,
} from '../../js/utils/temporary_live_text_update.ts';

describe('temporary_live_text_update', () => {
    let raf_callbacks: FrameRequestCallback[];

    function install_raf_mock(): void {
        raf_callbacks = [];
        window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            raf_callbacks.push(cb);
            return raf_callbacks.length;
        }) as typeof window.requestAnimationFrame;
    }

    function flush_raf(count = 1): void {
        for (let i = 0; i < count; i += 1) {
            const cb = raf_callbacks.shift();
            if (cb) cb(0);
        }
    }

    beforeEach(() => {
        install_raf_mock();
    });

    test('update_text_with_temporary_live_region sätter aria-live före text', () => {
        const el = document.createElement('span');
        update_text_with_temporary_live_region(el, 'Ny text');
        expect(el.getAttribute('aria-live')).toBe('polite');
        expect(el.getAttribute('aria-atomic')).toBe('true');
        expect(el.textContent).toBe('');
        flush_raf(1);
        expect(el.textContent).toBe('Ny text');
    });

    test('update_text_with_temporary_live_region anropar on_settled i andra rAF', () => {
        const el = document.createElement('span');
        const settled = jest.fn();
        update_text_with_temporary_live_region(el, 'Klar', settled);
        flush_raf(1);
        expect(settled).not.toHaveBeenCalled();
        flush_raf(1);
        expect(settled).toHaveBeenCalledTimes(1);
    });

    test('clear_temporary_live_region tar bort attribut', () => {
        const el = document.createElement('span');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        clear_temporary_live_region(el);
        expect(el.hasAttribute('aria-live')).toBe(false);
        expect(el.hasAttribute('aria-atomic')).toBe(false);
    });

    test('get_button_primary_label_span hittar första icke-dold span', () => {
        const btn = document.createElement('button');
        btn.innerHTML = '<span>Etikett</span><span aria-hidden="true">ikon</span>';
        expect(get_button_primary_label_span(btn)?.textContent).toBe('Etikett');
    });

    describe('show_temporary_button_label_feedback', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('återställer default och rensar live', () => {
            install_raf_mock();
            const btn = document.createElement('button');
            btn.innerHTML = '<span>Kopiera</span>';
            show_temporary_button_label_feedback(btn, 'Kopierat', 3000, {
                copied_class_name: 'is-copied',
            });

            const text_el = get_button_primary_label_span(btn)!;
            flush_raf(1);
            expect(text_el.textContent).toBe('Kopierat');
            expect(btn.classList.contains('is-copied')).toBe(true);
            expect(text_el.getAttribute('aria-live')).toBe('polite');

            jest.advanceTimersByTime(3000);
            flush_raf(1);
            expect(text_el.textContent).toBe('Kopiera');
            flush_raf(1);
            expect(text_el.hasAttribute('aria-live')).toBe(false);
            expect(btn.classList.contains('is-copied')).toBe(false);
        });
    });
});

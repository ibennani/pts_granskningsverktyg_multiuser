/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import {
    is_slide_out_in_progress,
    set_pass_criteria_list_visibility,
    set_slide_element_visibility,
    SLIDE_DOWN_ANIMATION_MS
} from '../../js/components/requirement_audit/slide_down_animation.ts';

describe('set_slide_element_visibility', () => {
    let raf_original;

    beforeEach(() => {
        jest.useFakeTimers();
        raf_original = window.requestAnimationFrame;
        window.requestAnimationFrame = (callback) => {
            callback(0);
            return 0;
        };
    });

    afterEach(() => {
        window.requestAnimationFrame = raf_original;
        jest.useRealTimers();
    });

    test('animerar kriterielistan med befintlig slide-down-klass', () => {
        document.body.innerHTML = '<ul class="pass-criteria-list" style="display: none;"></ul>';
        const pc_list = document.querySelector('.pass-criteria-list');

        set_pass_criteria_list_visibility(pc_list, true);

        expect(pc_list.style.display).toBe('');
        expect(pc_list.classList.contains('slide-down-in')).toBe(true);

        jest.advanceTimersByTime(SLIDE_DOWN_ANIMATION_MS);
        expect(pc_list.classList.contains('slide-down-in')).toBe(false);
    });

    test('animerar observationswrapper med hidden-läge', () => {
        document.body.innerHTML = '<div class="pc-observation-detail-wrapper" hidden></div>';
        const wrapper = document.querySelector('.pc-observation-detail-wrapper');

        set_slide_element_visibility(wrapper, true, { mode: 'hidden' });

        expect(wrapper.hidden).toBe(false);
        expect(wrapper.classList.contains('slide-down-in')).toBe(true);

        jest.advanceTimersByTime(SLIDE_DOWN_ANIMATION_MS);
        expect(wrapper.classList.contains('slide-down-in')).toBe(false);
    });

    test('döljer efter slide-down-out', () => {
        document.body.innerHTML = '<div class="pc-observation-detail-wrapper"></div>';
        const wrapper = document.querySelector('.pc-observation-detail-wrapper');

        set_slide_element_visibility(wrapper, false, { mode: 'hidden' });

        expect(wrapper.classList.contains('slide-down-out')).toBe(true);
        expect(wrapper.hidden).toBe(false);

        jest.advanceTimersByTime(SLIDE_DOWN_ANIMATION_MS);
        expect(wrapper.hidden).toBe(true);
        expect(wrapper.classList.contains('slide-down-out')).toBe(false);
    });

    test('avbryter inte pågående slide-out', () => {
        document.body.innerHTML = '<div class="pc-observation-detail-wrapper"></div>';
        const wrapper = document.querySelector('.pc-observation-detail-wrapper');
        wrapper.classList.add('slide-down-out');

        const changed = set_slide_element_visibility(wrapper, true, { mode: 'hidden' });

        expect(changed).toBe(false);
        expect(is_slide_out_in_progress(wrapper)).toBe(true);
    });
});

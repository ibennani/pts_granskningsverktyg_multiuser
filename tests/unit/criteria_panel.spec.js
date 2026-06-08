/**

 * @jest-environment jsdom

 */



import { jest } from '@jest/globals';

import {

    is_panel_sync_blocked,

    PANEL_OPEN_CLASS,

    PANEL_ANIMATION_MS,

    set_panel_open,

    toggle_slide_hidden_element

} from '../../js/components/requirement_audit/criteria_panel.ts';



describe('set_panel_open', () => {

    beforeEach(() => {

        jest.useFakeTimers();

    });



    afterEach(() => {

        jest.useRealTimers();

    });



    test('öppnar panel med animationsklass efter övergång', () => {

        document.body.innerHTML = `

            <div class="criteria-panel pass-criteria-panel" hidden>

                <div class="criteria-panel__inner">

                    <ul class="pass-criteria-list"></ul>

                </div>

            </div>

        `;

        const panel = document.querySelector('.pass-criteria-panel');



        set_panel_open(panel, true);



        expect(panel.hidden).toBe(false);

        expect(panel.classList.contains('slide-down-in')).toBe(true);

        expect(is_panel_sync_blocked(panel)).toBe(true);



        jest.advanceTimersByTime(PANEL_ANIMATION_MS + 100);



        expect(panel.classList.contains(PANEL_OPEN_CLASS)).toBe(true);

        expect(panel.classList.contains('slide-down-in')).toBe(false);

        expect(is_panel_sync_blocked(panel)).toBe(false);

    });



    test('stänger panel efter övergång', () => {

        document.body.innerHTML = `

            <div class="criteria-panel pass-criteria-panel criteria-panel--open">

                <div class="criteria-panel__inner"></div>

            </div>

        `;

        const panel = document.querySelector('.pass-criteria-panel');



        set_panel_open(panel, false);



        expect(panel.classList.contains(PANEL_OPEN_CLASS)).toBe(false);

        expect(panel.classList.contains('slide-down-out')).toBe(true);

        expect(panel.hidden).toBe(false);



        jest.advanceTimersByTime(PANEL_ANIMATION_MS + 100);



        expect(panel.hidden).toBe(true);

    });

});



describe('toggle_slide_hidden_element', () => {

    beforeEach(() => {

        jest.useFakeTimers();

    });



    afterEach(() => {

        jest.useRealTimers();

    });



    test('visar observationswrapper med slide-down-in', () => {

        document.body.innerHTML = '<div class="pc-observation-detail-wrapper" hidden></div>';

        const wrapper = document.querySelector('.pc-observation-detail-wrapper');



        toggle_slide_hidden_element(wrapper, true, { animate: true });



        expect(wrapper.hidden).toBe(false);

        expect(wrapper.classList.contains('slide-down-in')).toBe(true);



        jest.advanceTimersByTime(PANEL_ANIMATION_MS);

        expect(wrapper.classList.contains('slide-down-in')).toBe(false);

    });

});



import { describe, test, expect, jest } from '@jest/globals';
import {
    is_sidrapport_retake_busy,
    render_sidrapport_retake_control,
} from '../../js/utils/sidrapport_retake_button_ui.ts';

const helpers = {
    create_element: (tag: string, opts: Record<string, unknown> = {}) => {
        const el = document.createElement(tag);
        if (opts.class_name) el.className = String(opts.class_name);
        if (opts.text_content) el.textContent = String(opts.text_content);
        if (opts.attributes && typeof opts.attributes === 'object') {
            for (const [key, value] of Object.entries(opts.attributes as Record<string, string>)) {
                el.setAttribute(key, value);
            }
        }
        return el;
    },
    get_icon_svg: () => '<svg data-testid="loader"></svg>',
};

describe('sidrapport_retake_button_ui', () => {
    test('is_sidrapport_retake_busy när capture pågår på servern', () => {
        expect(
            is_sidrapport_retake_busy({
                sampleId: 's1',
                pendingAttempt: { status: 'capturing' },
            })
        ).toBe(true);
    });

    test('is_sidrapport_retake_busy när start anropas lokalt', () => {
        const in_flight = new Set(['s1']);
        expect(
            is_sidrapport_retake_busy({ sampleId: 's1', pendingAttempt: null }, in_flight)
        ).toBe(true);
    });

    test('renderar knapp när inte upptagen', () => {
        const on_retake = jest.fn();
        const el = render_sidrapport_retake_control(
            helpers,
            (key) => key,
            'Startsida',
            false,
            on_retake
        );
        expect(el.tagName).toBe('BUTTON');
        expect(el.textContent).toBe('audit_sidrapport_retake_button');
        (el as HTMLButtonElement).click();
        expect(on_retake).toHaveBeenCalledTimes(1);
    });

    test('renderar status med spinner när upptagen', () => {
        const on_retake = jest.fn();
        const el = render_sidrapport_retake_control(
            helpers,
            (key) => key,
            'Startsida',
            true,
            on_retake
        );
        expect(el.tagName).toBe('SPAN');
        expect(el.getAttribute('role')).toBe('status');
        expect(el.getAttribute('aria-live')).toBe('polite');
        expect(el.querySelector('.audit-sidrapport-retake-status__label')?.textContent).toBe(
            'audit_sidrapport_retake_creating'
        );
        expect(el.querySelector('.audit-sidrapport-retake-status__spinner svg')).toBeTruthy();
        expect(el.querySelector('.audit-sidrapport-retake-status__spinner')?.getAttribute('aria-hidden')).toBe(
            'true'
        );
    });
});

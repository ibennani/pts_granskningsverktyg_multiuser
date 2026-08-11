import { jest } from '@jest/globals';
import { create_element } from '../../js/dom/create_element.js';
import { get_icon_svg } from '../../js/ui/icons.js';
import { create_sample_url_analyze_button } from '../../js/components/add_sample_form/sample_url_analyze_status.ts';

const Helpers = { create_element, get_icon_svg };

const t = (key: string) => {
    const map: Record<string, string> = {
        sample_url_analyze_button: 'Skapa sidrapport',
        sample_url_analyze_button_aria: 'Skapa sidrapport: öppna dialog',
    };
    return map[key] ?? key;
};

describe('sample_url_analyze_status', () => {
    test('create_sample_url_analyze_button skapar enkel knapp utan tooltip', () => {
        const parts = create_sample_url_analyze_button(Helpers, t);

        expect(parts.wrapper.classList.contains('sample-url-analyze-button-wrap')).toBe(true);
        expect(parts.wrapper.classList.contains('generic-tooltip-wrapper')).toBe(false);
        expect(parts.wrapper.children[0]).toBe(parts.button);
        expect(parts.button.textContent).toContain('Skapa sidrapport');
        expect(parts.button.getAttribute('aria-label')).toBe('Skapa sidrapport: öppna dialog');
        expect(parts.button.hasAttribute('disabled')).toBe(false);
    });
});

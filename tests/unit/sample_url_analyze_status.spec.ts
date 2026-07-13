import { jest } from '@jest/globals';
import { create_element } from '../../js/dom/create_element.js';
import { get_icon_svg } from '../../js/ui/icons.js';
import {
    create_sample_url_analyze_button,
    set_sample_url_analyze_status,
} from '../../js/components/add_sample_form/sample_url_analyze_status.ts';

const Helpers = { create_element, get_icon_svg };

const t = (key: string) => {
    const map: Record<string, string> = {
        sample_url_analyze_button: 'Hämta information',
        sample_url_analyze_button_aria: 'Hämta information från webbadress',
        sample_url_analyze_status_loading: 'Hämtar info från webbsidan',
        sample_url_analyze_status_success: 'Hämtning klar',
        sample_url_analyze_status_failed: 'Hämtningen misslyckades',
    };
    return map[key] ?? key;
};

function build_host(parts: ReturnType<typeof create_sample_url_analyze_button>) {
    return {
        url_analyze_button_parts: parts,
        get_t_internally: () => t,
        Helpers,
    };
}

async function flush_raf(): Promise<void> {
    await Promise.resolve();
}

describe('sample_url_analyze_status', () => {
    beforeEach(() => {
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
    test('create_sample_url_analyze_button använder generic-tooltip-wrapper', () => {
        const parts = create_sample_url_analyze_button(Helpers, t);

        expect(parts.wrapper.classList.contains('generic-tooltip-wrapper')).toBe(true);
        expect(parts.wrapper.children[0]).toBe(parts.button);
        expect(parts.button.textContent).toContain('Hämta information');
        expect(parts.tooltip.is_mounted()).toBe(false);
    });

    test('set_sample_url_analyze_status uppdaterar aria-live-text vid laddning', async () => {
        const parts = create_sample_url_analyze_button(Helpers, t);
        document.body.appendChild(parts.wrapper);

        set_sample_url_analyze_status(build_host(parts), 'loading');
        await flush_raf();

        const tooltip_el = parts.tooltip.get_tooltip_element();
        const text_el = parts.tooltip.get_text_element();

        expect(parts.button.getAttribute('data-file-download-busy')).toBe('true');
        expect(text_el?.getAttribute('aria-live')).toBe('polite');
        expect(text_el?.textContent).toBe('Hämtar info från webbsidan');
        expect(tooltip_el?.classList.contains('generic-tooltip--active')).toBe(true);
        expect(tooltip_el?.querySelector('.generic-tooltip-spinner')).not.toBeNull();
        expect(parts.button.querySelector('.sample-url-analyze-button__label')?.textContent).toBe(
            'Hämta information'
        );
    });

    test('set_sample_url_analyze_status visar klar-ikon i tooltip', async () => {
        const parts = create_sample_url_analyze_button(Helpers, t);

        set_sample_url_analyze_status(build_host(parts), 'success');
        await flush_raf();

        expect(parts.button.getAttribute('data-file-download-busy')).toBe('false');
        expect(parts.tooltip.get_text_element()?.textContent).toBe('Hämtning klar');
        expect(parts.tooltip.get_tooltip_element()?.querySelector('.generic-tooltip__icon--ready')).not.toBeNull();
    });

    test('set_sample_url_analyze_status avmonterar tooltip i idle', async () => {
        const parts = create_sample_url_analyze_button(Helpers, t);

        set_sample_url_analyze_status(build_host(parts), 'loading');
        await flush_raf();
        set_sample_url_analyze_status(build_host(parts), 'idle');

        expect(parts.button.getAttribute('data-file-download-busy')).toBe('false');
        expect(parts.tooltip.is_mounted()).toBe(false);
    });
});

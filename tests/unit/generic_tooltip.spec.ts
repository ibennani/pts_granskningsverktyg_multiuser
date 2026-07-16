import { jest } from '@jest/globals';
import { create_element } from '../../js/dom/create_element.js';
import { get_icon_svg } from '../../js/ui/icons.js';
import {
    create_tooltip_wrapper,
    GenericTooltip,
    wrap_with_static_tooltip,
} from '../../js/utils/generic_tooltip.ts';

const Helpers = { create_element, get_icon_svg };

async function flush_raf(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe('generic_tooltip', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        const overlay = document.getElementById('app-overlay');
        if (overlay) {
            overlay.remove();
        }
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('mount_empty_shell skapar tom textspan med role status', () => {
        const icon = create_element('span', { text_content: '○' });
        const { wrapper, tooltip } = create_tooltip_wrapper(Helpers, {
            content: icon,
            mode: 'static',
            idle_text: 'Status',
            use_overlay: false,
        });
        document.body.appendChild(wrapper);

        tooltip.mount_empty_shell();

        const tooltip_el = tooltip.get_tooltip_element();
        const text_el = tooltip.get_text_element();
        expect(tooltip_el).not.toBeNull();
        expect(text_el?.getAttribute('role')).toBe('status');
        expect(text_el?.textContent).toBe('');
    });

    test('set_content fyller text och ikon med aria-hidden på ikonen', async () => {
        const icon = create_element('span', { text_content: '○' });
        const { wrapper, tooltip } = create_tooltip_wrapper(Helpers, {
            content: icon,
            mode: 'feedback',
            use_overlay: false,
        });
        document.body.appendChild(wrapper);

        tooltip.show();
        tooltip.set_content('Laddar', '<span class="generic-tooltip-spinner">x</span>', 'generating');
        await flush_raf();

        const tooltip_el = tooltip.get_tooltip_element();
        const text_el = tooltip.get_text_element();
        const icon_el = tooltip_el?.querySelector('.generic-tooltip__icon');

        expect(text_el?.textContent).toBe('Laddar');
        expect(icon_el?.getAttribute('aria-hidden')).toBe('true');
        expect(icon_el?.classList.contains('generic-tooltip__icon--generating')).toBe(true);
        expect(tooltip_el?.classList.contains('generic-tooltip--active')).toBe(true);
    });

    test('update_text uppdaterar befintlig textspan', async () => {
        const icon = create_element('span', { text_content: '○' });
        const { tooltip } = create_tooltip_wrapper(Helpers, {
            content: icon,
            mode: 'feedback',
            use_overlay: false,
        });

        tooltip.show();
        tooltip.set_content('Första');
        await flush_raf();
        tooltip.update_text('Andra');

        expect(tooltip.get_text_element()?.textContent).toBe('Andra');
    });

    test('hide tar bort tooltip ur DOM', async () => {
        const icon = create_element('span', { text_content: '○' });
        const { wrapper, tooltip } = create_tooltip_wrapper(Helpers, {
            content: icon,
            mode: 'feedback',
            use_overlay: false,
        });
        document.body.appendChild(wrapper);

        tooltip.show();
        tooltip.set_content('Hej');
        await flush_raf();
        expect(tooltip.is_mounted()).toBe(true);

        tooltip.hide();
        expect(tooltip.is_mounted()).toBe(false);
        expect(wrapper.querySelector('[data-generic-tooltip]')).toBeNull();
    });

    test('hide avbryter väntande requestAnimationFrame', async () => {
        const icon = create_element('span', { text_content: '○' });
        const tooltip = new GenericTooltip();
        const wrapper = create_element('span', { class_name: 'generic-tooltip-wrapper' });
        wrapper.appendChild(icon);
        tooltip.init({
            wrapper,
            deps: Helpers,
            options: { mode: 'feedback', use_overlay: false },
        });

        tooltip.show();
        tooltip.set_content('Ska inte synas');
        tooltip.hide();
        await flush_raf();

        expect(tooltip.is_mounted()).toBe(false);
    });

    test('statiskt läge monterar vid focusin och avmonterar vid focusout', async () => {
        const icon = create_element('span', {
            text_content: '○',
            attributes: { tabindex: '0' },
        });
        const wrapper = wrap_with_static_tooltip(Helpers, icon, 'Godkänd', { use_overlay: false });
        document.body.appendChild(wrapper);

        icon.focus();
        await flush_raf();

        const tooltip_el = wrapper.querySelector('[data-generic-tooltip]');
        expect(tooltip_el).not.toBeNull();
        expect(tooltip_el?.querySelector('.generic-tooltip__text')?.textContent).toBe('Godkänd');

        icon.blur();
        await flush_raf();

        expect(wrapper.querySelector('[data-generic-tooltip]')).toBeNull();
    });

    test('wrap_with_static_tooltip returnerar wrapper med innehåll', () => {
        const icon = create_element('span', { text_content: '✓' });
        const wrapper = wrap_with_static_tooltip(Helpers, icon, 'Godkänd', { use_overlay: true });

        expect(wrapper.classList.contains('generic-tooltip-wrapper')).toBe(true);
        expect(wrapper.children[0]).toBe(icon);
        expect(wrapper.querySelector('[data-generic-tooltip]')).toBeNull();
    });
});

/**
 * @fileoverview Enhetstester för låsning av bifoga-media-knappen under auto-skärmdump.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { create_element } from '../../js/dom/create_element.js';
import { get_icon_svg } from '../../js/ui/icons.js';

const open_attach_media_modal = jest.fn();

jest.unstable_mockModule('../../js/components/media/AttachMediaModal.js', () => ({
    open_attach_media_modal,
}));

const {
    render_sample_screenshot_section,
    update_sample_attach_media_button,
    handle_sample_attach_media_click,
} = await import('../../js/components/add_sample_form/sample_attach_media.ts');

const Helpers = {
    create_element,
    get_icon_svg,
    escape_html: (value: string) => value,
};

const t = (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
        sample_screenshot_title: 'Skärmavbild',
        sample_screenshot_instruction: 'Bifoga skärmavbild.',
        sample_screenshot_section_label: 'granskningsdelens skärmavbildning',
        attach_media_aria_label_for: 'för',
        edit_attached_media_button: `Redigera bifogad media (${params?.count ?? 0} st)`,
        attach_media_button: 'Bifoga media',
        sample_screenshot_capturing_button: 'Tar skärmavbild …',
    };
    return map[key] ?? key;
};

function build_component(overrides: Record<string, unknown> = {}) {
    return {
        get_t_internally: () => t,
        Helpers,
        sample_attached_media_filenames: ['bild.png'],
        sample_url_screenshot_in_progress: false,
        sample_attach_media_btn: null,
        current_editing_sample_id: null,
        save_form_data_immediately: jest.fn(),
        _persist_new_sample_draft: jest.fn(),
        ...overrides,
    };
}

describe('sample_attach_media', () => {
    beforeEach(() => {
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        open_attach_media_modal.mockClear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('update_sample_attach_media_button sätter data-file-download-busy vid pågående skärmdump', async () => {
        const component = build_component();
        const section = render_sample_screenshot_section(component, { attachedMediaFilenames: ['bild.png'] });
        document.body.appendChild(section);

        update_sample_attach_media_button({
            ...component,
            sample_url_screenshot_in_progress: true,
        });
        await Promise.resolve();

        const btn = component.sample_attach_media_btn as HTMLButtonElement;
        expect(btn.getAttribute('data-file-download-busy')).toBe('true');
        expect(btn.hasAttribute('disabled')).toBe(false);
        expect(btn.getAttribute('aria-disabled')).toBeNull();
        expect(btn.querySelector('.attach-media-button-label')?.textContent).toBe('Tar skärmavbild …');
    });

    test('update_sample_attach_media_button återställer data-file-download-busy efter skärmdump', () => {
        const component = build_component({ sample_url_screenshot_in_progress: true });
        const section = render_sample_screenshot_section(component, { attachedMediaFilenames: ['bild.png'] });
        document.body.appendChild(section);

        update_sample_attach_media_button({
            ...component,
            sample_url_screenshot_in_progress: false,
        });

        const btn = component.sample_attach_media_btn as HTMLButtonElement;
        expect(btn.getAttribute('data-file-download-busy')).toBe('false');
        expect(btn.querySelector('.attach-media-button-label')?.textContent).toBe('Redigera bifogad media (1 st)');
    });

    test('handle_sample_attach_media_click ignorerar klick när knappen är upptagen', () => {
        const component = build_component();
        const section = render_sample_screenshot_section(component, { attachedMediaFilenames: ['bild.png'] });
        document.body.appendChild(section);
        const btn = component.sample_attach_media_btn as HTMLButtonElement;
        btn.setAttribute('data-file-download-busy', 'true');

        handle_sample_attach_media_click(component, {
            preventDefault: jest.fn(),
            currentTarget: btn,
        } as unknown as Event);

        expect(open_attach_media_modal).not.toHaveBeenCalled();
    });
});

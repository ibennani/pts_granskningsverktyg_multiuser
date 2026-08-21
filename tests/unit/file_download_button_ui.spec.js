import { jest } from '@jest/globals';
import { create_element } from '../../js/dom/create_element.js';
import { get_icon_svg } from '../../js/ui/icons.js';
import { create_tooltip_wrapper } from '../../js/utils/generic_tooltip.ts';
import {
    create_file_download_button,
    is_file_download_trigger_busy,
    READY_RESET_MS,
    run_file_download_flow,
    set_file_download_idle,
    set_file_download_trigger_busy,
} from '../../js/utils/file_download_button_ui.ts';
import { DownloadFileTooLargeError, FILE_DOWNLOAD_MAX_BYTES } from '../../js/utils/download_filename_utils.ts';
import { ExportPdfHtmlTooLargeError } from '../../js/export/export_pdf_html_size_error.ts';
import { ExportPdfFailedError } from '../../js/export/export_pdf_user_errors.ts';
import { SCREENSHOTS_APPENDIX_PDF_MAX_BYTES } from '../../shared/constants/pdf_export_limits.js';
import { set_language } from '../../js/translation_logic.ts';

const Helpers = {
    create_element,
    get_icon_svg,
};

const t = (key, params) => {
    const map = {
        file_download_generating: 'Genererar fil för nedladdning',
        file_download_ready: 'Nu kan du ladda ner filen',
        file_download_failed: 'Det gick inte att generera filen',
        file_download_too_large: 'Filen är för stor för nedladdning. Maxstorlek är {max_size}.',
        export_screenshots_appendix_too_large:
            'Bilagan med skärmbilder är för stor ({actual_size}). Maxgräns: {max_size}',
    };
    let text = map[key] ?? key;
    if (params) {
        for (const [name, value] of Object.entries(params)) {
            text = text.replace(`{${name}}`, String(value));
        }
    }
    return text;
};

async function flush_raf() {
    await Promise.resolve();
}

describe('generic_tooltip integration', () => {
    test('create_tooltip_wrapper har bara trigger i DOM i viloläge', () => {
        const btn = create_element('button', { text_content: 'Ladda ner' });
        const { wrapper, tooltip } = create_tooltip_wrapper(Helpers, {
            content: btn,
            mode: 'feedback',
            use_overlay: false,
        });

        expect(wrapper.children[0]).toBe(btn);
        expect(wrapper.children.length).toBe(1);
        expect(tooltip.is_mounted()).toBe(false);
    });
});

describe('file_download_button_ui', () => {
    beforeAll(async () => {
        await set_language('sv-SE');
    });

    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            callback(0);
            return 1;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    test('create_file_download_button sätter busy och visar status i tooltip vid klick', async () => {
        let resolve_download;
        const download_promise = new Promise((resolve) => {
            resolve_download = resolve;
        });

        const parts = create_file_download_button({
            Helpers,
            label: 'Exportera',
            t,
            icon_name: 'export',
            on_download: () => download_promise,
        });

        document.body.appendChild(parts.wrapper);
        const initial_button_html = parts.button.innerHTML;

        parts.button.click();
        await flush_raf();

        const tooltip_el = parts.tooltip.get_tooltip_element();
        const text_el = parts.tooltip.get_text_element();

        expect(parts.button.getAttribute('data-file-download-busy')).toBe('true');
        expect(parts.button.innerHTML).toBe(initial_button_html);
        expect(parts.button.querySelector('.generic-tooltip-spinner')).toBeNull();
        expect(text_el?.textContent).toBe('Genererar fil för nedladdning');
        expect(tooltip_el?.querySelector('.generic-tooltip__icon--generating .generic-tooltip-spinner'))
            .not.toBeNull();
        expect(tooltip_el?.getAttribute('data-has-tooltip-content')).toBe('true');
        expect(tooltip_el?.classList.contains('generic-tooltip--active')).toBe(true);

        resolve_download();
        await Promise.resolve();
        await flush_raf();

        expect(parts.button.innerHTML).toBe(initial_button_html);
        expect(parts.tooltip.get_text_element()?.textContent).toBe('Nu kan du ladda ner filen');
        expect(parts.tooltip.get_tooltip_element()?.querySelector('.generic-tooltip__icon--ready')).not.toBeNull();

        jest.advanceTimersByTime(READY_RESET_MS);
        await Promise.resolve();

        expect(parts.button.getAttribute('data-file-download-busy')).toBe('false');
        expect(parts.tooltip.is_mounted()).toBe(false);
    });

    test('tom tooltip finns inte i DOM i viloläge', () => {
        const parts = create_file_download_button({
            Helpers,
            label: 'Exportera',
            t,
            on_download: () => Promise.resolve(),
        });

        expect(parts.tooltip.is_mounted()).toBe(false);
    });

    test('ignorerar klick medan busy', async () => {
        let call_count = 0;
        let resolve_first;
        const parts = create_file_download_button({
            Helpers,
            label: 'Exportera',
            t,
            on_download: () =>
                new Promise((resolve) => {
                    call_count += 1;
                    resolve_first = resolve;
                }),
        });

        parts.button.click();
        parts.button.click();

        expect(call_count).toBe(1);
        resolve_first();
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(READY_RESET_MS);
        await Promise.resolve();
    });

    test('visar kryss och feltext i tooltip vid misslyckad generering', async () => {
        const parts = create_file_download_button({
            Helpers,
            label: 'Exportera',
            t,
            on_download: () => Promise.reject(new Error('fail')),
        });

        const initial_button_html = parts.button.innerHTML;

        parts.button.click();
        await Promise.resolve();
        await Promise.resolve();
        await flush_raf();

        const tooltip_el = parts.tooltip.get_tooltip_element();

        expect(parts.button.getAttribute('data-file-download-busy')).toBe('true');
        expect(parts.button.innerHTML).toBe(initial_button_html);
        expect(parts.tooltip.get_text_element()?.textContent).toBe('Det gick inte att generera filen');
        expect(tooltip_el?.querySelector('.generic-tooltip__icon--error')).not.toBeNull();
        expect(parts.button.querySelector('.file-download-btn__status-icon--error')).toBeNull();

        jest.advanceTimersByTime(READY_RESET_MS);
        await Promise.resolve();

        expect(parts.button.getAttribute('data-file-download-busy')).toBe('false');
        expect(parts.tooltip.is_mounted()).toBe(false);
    });

    test('visar storleksfel när nedladdning överskrider max', async () => {
        const parts = create_file_download_button({
            Helpers,
            label: 'Exportera',
            t,
            on_download: async () => {
                throw new DownloadFileTooLargeError(FILE_DOWNLOAD_MAX_BYTES + 1, FILE_DOWNLOAD_MAX_BYTES);
            },
        });

        parts.button.click();
        await Promise.resolve();
        await Promise.resolve();
        await flush_raf();

        expect(parts.tooltip.get_text_element()?.textContent).toContain('Maxstorlek');
        expect(parts.tooltip.get_tooltip_element()?.textContent).toContain('Maxstorlek');
        expect(parts.tooltip.get_text_element()?.textContent).not.toBe('Nu kan du ladda ner filen');
        expect(parts.button.querySelector('.file-download-btn__status-icon--error')).toBeNull();
        expect(parts.button.querySelector('.file-download-btn__status-icon--ready')).toBeNull();
    });

    test('visar klartext i tooltip vid för stor skärmbildsbilaga', async () => {
        const parts = create_file_download_button({
            Helpers,
            label: 'Exportera',
            t,
            on_download: async () => {
                throw new ExportPdfHtmlTooLargeError(
                    22 * 1024 * 1024,
                    SCREENSHOTS_APPENDIX_PDF_MAX_BYTES,
                    'export_screenshots_appendix_too_large'
                );
            },
        });

        parts.button.click();
        await Promise.resolve();
        await Promise.resolve();
        await flush_raf();

        const tooltip_text = parts.tooltip.get_text_element()?.textContent;
        expect(tooltip_text).toContain('Bilagan med skärmbilder är för stor');
        expect(tooltip_text).toContain('22 MByte');
        expect(tooltip_text).toContain('Maxgräns: 20 Mbyte');
        expect(tooltip_text).not.toContain('htmlContent');

        jest.advanceTimersByTime(READY_RESET_MS);
        await Promise.resolve();
    });

    test('visar klartext i tooltip vid PDF-genereringsfel', async () => {
        const parts = create_file_download_button({
            Helpers,
            label: 'Exportera PDF',
            t,
            on_download: async () => {
                throw new ExportPdfFailedError(
                    'Det gick inte att skapa PDF-filen. Försök igen om en stund.'
                );
            },
        });

        parts.button.click();
        await Promise.resolve();
        await Promise.resolve();
        await flush_raf();

        const tooltip_text = parts.tooltip.get_text_element()?.textContent;
        expect(tooltip_text).toBe('Det gick inte att skapa PDF-filen. Försök igen om en stund.');
        expect(tooltip_text).not.toContain('Kunde inte exportera PDF');

        jest.advanceTimersByTime(READY_RESET_MS);
        await Promise.resolve();
    });

    test('run_file_download_flow kan anropas direkt', async () => {
        const btn = create_element('button', {
            class_name: 'file-download-btn',
            attributes: { 'data-file-download-busy': 'false' },
            html_content:
                '<span class="file-download-btn__label">Test</span>' +
                '<span class="file-download-btn__status-icon"></span>',
        });
        const { wrapper, tooltip } = create_tooltip_wrapper(Helpers, {
            content: btn,
            mode: 'feedback',
            use_overlay: false,
        });
        const parts = { wrapper, button: btn, tooltip };

        const flow_promise = run_file_download_flow(parts, t, Helpers, async () => {}, {
            idle_icon_html: get_icon_svg('save', ['currentColor'], 16),
        });
        await Promise.resolve();
        jest.advanceTimersByTime(READY_RESET_MS);
        await flow_promise;

        expect(btn.getAttribute('data-file-download-busy')).toBe('false');
    });

    test('set_file_download_idle rensar status', async () => {
        const btn = create_element('button', {
            class_name: 'file-download-btn',
            attributes: { 'data-file-download-busy': 'true' },
            html_content:
                '<span class="file-download-btn__label">Test</span>' +
                '<span class="file-download-btn__status-icon">x</span>',
        });
        const { wrapper, tooltip } = create_tooltip_wrapper(Helpers, {
            content: btn,
            mode: 'feedback',
            use_overlay: false,
        });
        tooltip.show();
        tooltip.set_content('status');
        await flush_raf();

        set_file_download_idle({ wrapper, button: btn, tooltip }, get_icon_svg('save', ['currentColor'], 16), '');

        expect(btn.getAttribute('data-file-download-busy')).toBe('false');
        expect(tooltip.is_mounted()).toBe(false);
    });

    test('is_file_download_trigger_busy används för att ignorera extra klick utan disabled', async () => {
        const btn = create_element('button', {
            class_name: 'file-download-btn',
            attributes: { 'data-file-download-busy': 'true' },
            html_content:
                '<span class="file-download-btn__label">Test</span>' +
                '<span class="file-download-btn__status-icon"></span>',
        });
        const { wrapper, tooltip } = create_tooltip_wrapper(Helpers, {
            content: btn,
            mode: 'feedback',
            use_overlay: false,
        });
        const parts = { wrapper, button: btn, tooltip };
        const download_fn = jest.fn(async () => {});

        await run_file_download_flow(parts, t, Helpers, download_fn, {
            idle_icon_html: get_icon_svg('save', ['currentColor'], 16),
        });

        expect(download_fn).not.toHaveBeenCalled();
        expect(is_file_download_trigger_busy(btn)).toBe(true);
        expect(btn.hasAttribute('disabled')).toBe(false);
        expect(btn.getAttribute('aria-disabled')).toBeNull();
    });

    test('set_file_download_trigger_busy och is_file_download_trigger_busy hänger ihop', () => {
        const btn = create_element('button', {
            attributes: { 'data-file-download-busy': 'false' },
        });
        expect(is_file_download_trigger_busy(btn)).toBe(false);
        set_file_download_trigger_busy(btn, true);
        expect(is_file_download_trigger_busy(btn)).toBe(true);
    });
});

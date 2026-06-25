import { jest } from '@jest/globals';
import { create_element } from '../../js/dom/create_element.js';
import { get_icon_svg } from '../../js/ui/icons.js';
import { create_status_icon_tooltip_wrapper } from '../../js/utils/status_icon_tooltip.ts';
import {
    create_file_download_button,
    READY_RESET_MS,
    run_file_download_flow,
    set_file_download_idle,
} from '../../js/utils/file_download_button_ui.ts';
import { DownloadFileTooLargeError, FILE_DOWNLOAD_MAX_BYTES } from '../../js/utils/download_filename_utils.ts';
import { ExportPdfHtmlTooLargeError } from '../../js/export/export_pdf_html_size_error.ts';
import { ExportPdfFailedError } from '../../js/export/export_pdf_user_errors.ts';

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

describe('status_icon_tooltip', () => {
    test('skapar aria-live före tooltip-elementet', () => {
        const btn = create_element('button', { text_content: 'Ladda ner' });
        const { wrapper, live_region, tooltip_el } = create_status_icon_tooltip_wrapper(Helpers, {
            content: btn,
            include_live_region: true,
        });

        expect(wrapper.children[0]).toBe(btn);
        expect(wrapper.children[1]).toBe(live_region);
        expect(wrapper.children[2]).toBe(tooltip_el);
        expect(live_region?.getAttribute('aria-live')).toBe('polite');
        expect(live_region?.textContent).toBe('');
    });
});

describe('file_download_button_ui', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
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

        expect(parts.button.getAttribute('data-file-download-busy')).toBe('true');
        expect(parts.button.innerHTML).toBe(initial_button_html);
        expect(parts.button.querySelector('.file-download-spinner')).toBeNull();
        expect(parts.live_region?.textContent).toBe('Genererar fil för nedladdning');
        expect(parts.tooltip_el.querySelector('.file-download-tooltip-text')?.textContent)
            .toBe('Genererar fil för nedladdning');
        expect(parts.tooltip_el.querySelector('.file-download-tooltip-icon--generating .file-download-spinner'))
            .not.toBeNull();
        expect(parts.tooltip_el.getAttribute('data-has-tooltip-content')).toBe('true');
        expect(parts.tooltip_el.classList.contains('file-download-tooltip--active')).toBe(true);

        resolve_download();
        await Promise.resolve();
        await Promise.resolve();

        expect(parts.button.innerHTML).toBe(initial_button_html);
        expect(parts.live_region?.textContent).toBe('Nu kan du ladda ner filen');
        expect(parts.tooltip_el.querySelector('.file-download-tooltip-icon--ready')).not.toBeNull();

        jest.advanceTimersByTime(READY_RESET_MS);
        await Promise.resolve();

        expect(parts.button.getAttribute('data-file-download-busy')).toBe('false');
        expect(parts.live_region?.textContent).toBe('');
        expect(parts.tooltip_el.hasAttribute('data-has-tooltip-content')).toBe(false);
        expect(parts.tooltip_el.classList.contains('file-download-tooltip--active')).toBe(false);
    });

    test('tom tooltip visas inte i viloläge', () => {
        const parts = create_file_download_button({
            Helpers,
            label: 'Exportera',
            t,
            on_download: () => Promise.resolve(),
        });

        expect(parts.tooltip_el.textContent).toBe('');
        expect(parts.tooltip_el.hasAttribute('data-has-tooltip-content')).toBe(false);
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

        expect(parts.button.getAttribute('data-file-download-busy')).toBe('true');
        expect(parts.button.innerHTML).toBe(initial_button_html);
        expect(parts.live_region?.textContent).toBe('Det gick inte att generera filen');
        expect(parts.tooltip_el.querySelector('.file-download-tooltip-text')?.textContent)
            .toBe('Det gick inte att generera filen');
        expect(parts.tooltip_el.querySelector('.file-download-tooltip-icon--error')).not.toBeNull();
        expect(parts.button.querySelector('.file-download-btn__status-icon--error')).toBeNull();

        jest.advanceTimersByTime(READY_RESET_MS);
        await Promise.resolve();

        expect(parts.button.getAttribute('data-file-download-busy')).toBe('false');
        expect(parts.live_region?.textContent).toBe('');
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

        expect(parts.live_region?.textContent).toContain('Maxstorlek');
        expect(parts.tooltip_el.textContent).toContain('Maxstorlek');
        expect(parts.live_region?.textContent).not.toBe('Nu kan du ladda ner filen');
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
                    27 * 1024 * 1024,
                    25 * 1024 * 1024,
                    'export_screenshots_appendix_too_large'
                );
            },
        });

        parts.button.click();
        await Promise.resolve();
        await Promise.resolve();

        const tooltip_text = parts.tooltip_el.querySelector('.file-download-tooltip-text')?.textContent;
        expect(tooltip_text).toContain('Bilagan med skärmbilder är för stor');
        expect(tooltip_text).toContain('27 MByte');
        expect(tooltip_text).toContain('Maxgräns: 25 Mbyte');
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

        const tooltip_text = parts.tooltip_el.querySelector('.file-download-tooltip-text')?.textContent;
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
        const { wrapper, live_region, tooltip_el } = create_status_icon_tooltip_wrapper(Helpers, {
            content: btn,
            include_live_region: true,
        });
        const parts = { wrapper, button: btn, live_region, tooltip_el };

        const flow_promise = run_file_download_flow(parts, t, Helpers, async () => {}, {
            idle_icon_html: get_icon_svg('save', ['currentColor'], 16),
        });
        await Promise.resolve();
        jest.advanceTimersByTime(READY_RESET_MS);
        await flow_promise;

        expect(btn.getAttribute('data-file-download-busy')).toBe('false');
    });

    test('set_file_download_idle rensar status', () => {
        const btn = create_element('button', {
            class_name: 'file-download-btn',
            attributes: { 'data-file-download-busy': 'true' },
            html_content:
                '<span class="file-download-btn__label">Test</span>' +
                '<span class="file-download-btn__status-icon">x</span>',
        });
        const { wrapper, live_region, tooltip_el } = create_status_icon_tooltip_wrapper(Helpers, {
            content: btn,
            include_live_region: true,
        });
        live_region.textContent = 'status';
        tooltip_el.textContent = 'status';

        set_file_download_idle(
            { wrapper, button: btn, live_region, tooltip_el },
            get_icon_svg('save', ['currentColor'], 16),
            ''
        );

        expect(btn.getAttribute('data-file-download-busy')).toBe('false');
        expect(live_region.textContent).toBe('');
    });
});

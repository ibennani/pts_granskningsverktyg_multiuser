/**
 * @fileoverview Enhetlig UX för knappar som genererar filnedladdning.
 */

import '../../css/components/file_download_button.css';

import { get_icon_svg as default_get_icon_svg } from '../ui/icons.js';
import {
    is_download_file_too_large_error,
    format_file_download_max_size_label,
} from './download_filename_utils.js';
import {
    is_export_pdf_html_too_large_error,
    build_export_pdf_html_too_large_message,
    type ExportPdfHtmlTooLargeError,
} from '../export/export_pdf_html_size_error.js';
import { is_export_pdf_failed_error } from '../export/export_pdf_user_errors.js';
import {
    create_status_icon_tooltip_wrapper,
    find_file_download_live_region,
    type StatusIconTooltipParts,
} from './status_icon_tooltip.js';

export const READY_RESET_MS = 3000;

export type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

export type FileDownloadHelpers = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
    load_css_safely?: (path: string) => Promise<void>;
};

export type FileDownloadButtonParts = StatusIconTooltipParts & {
    button: HTMLElement;
};

export type CreateFileDownloadButtonOptions = {
    Helpers: FileDownloadHelpers;
    label: string;
    on_download: () => void | Promise<void>;
    t: TranslationFn;
    variant?: string;
    extra_class_names?: string[];
    icon_name?: string | null;
    icon_size?: number;
    idle_tooltip_text?: string;
    id?: string | null;
    aria_describedby?: string | null;
    aria_label?: string | null;
    tag?: 'button' | 'a';
    href?: string;
    omit_small?: boolean;
};

function resolve_get_icon_svg(Helpers: FileDownloadHelpers) {
    return Helpers.get_icon_svg ?? default_get_icon_svg;
}

function sync_tooltip_content_attr(tooltip_el: HTMLElement): void {
    const text_el = tooltip_el.querySelector('.file-download-tooltip-text');
    const has_content = text_el
        ? Boolean(text_el.textContent?.trim())
        : Boolean(tooltip_el.textContent?.trim());
    if (has_content) {
        tooltip_el.setAttribute('data-has-tooltip-content', 'true');
    } else {
        tooltip_el.removeAttribute('data-has-tooltip-content');
    }
}

function set_tooltip_active(parts: FileDownloadButtonParts, active: boolean): void {
    parts.tooltip_el.classList.toggle('file-download-tooltip--active', active);
}

function icon_html(Helpers: FileDownloadHelpers, icon_name: string, size: number): string {
    const svg = resolve_get_icon_svg(Helpers)(icon_name, ['currentColor'], size);
    if (icon_name === 'loader') {
        return `<span class="file-download-spinner">${svg}</span>`;
    }
    return svg;
}

type FileDownloadStatusState = 'generating' | 'ready' | 'error';

function status_icon_markup(
    Helpers: FileDownloadHelpers,
    state: FileDownloadStatusState,
    size: number
): string {
    if (state === 'generating') return icon_html(Helpers, 'loader', size);
    if (state === 'ready') return icon_html(Helpers, 'check', size);
    return icon_html(Helpers, 'close', size);
}

const TOOLTIP_STATUS_ICON_CLASS = 'file-download-tooltip-icon';

function clear_tooltip_status_classes(tooltip_el: HTMLElement): void {
    tooltip_el.classList.remove('file-download-tooltip--with-status-icon');
    tooltip_el.querySelectorAll(`.${TOOLTIP_STATUS_ICON_CLASS}`).forEach((el) => {
        el.classList.forEach((cls) => {
            if (cls.startsWith(`${TOOLTIP_STATUS_ICON_CLASS}--`)) {
                el.classList.remove(cls);
            }
        });
    });
}

function set_tooltip_status_with_icon(
    parts: FileDownloadButtonParts,
    text: string,
    icon_html_str: string,
    state: FileDownloadStatusState
): void {
    if (parts.live_region) {
        parts.live_region.textContent = text;
    }
    clear_tooltip_status_classes(parts.tooltip_el);
    parts.tooltip_el.classList.add('file-download-tooltip--with-status-icon');
    parts.tooltip_el.replaceChildren();
    const text_el = document.createElement('span');
    text_el.className = 'file-download-tooltip-text';
    text_el.textContent = text;
    const icon_el = document.createElement('span');
    icon_el.className = `${TOOLTIP_STATUS_ICON_CLASS} ${TOOLTIP_STATUS_ICON_CLASS}--${state}`;
    icon_el.setAttribute('aria-hidden', 'true');
    icon_el.innerHTML = icon_html_str;
    parts.tooltip_el.append(text_el, icon_el);
    sync_tooltip_content_attr(parts.tooltip_el);
}

function find_trigger(parts: FileDownloadButtonParts): HTMLElement {
    return parts.button;
}

function is_busy(trigger: HTMLElement): boolean {
    return trigger.getAttribute('data-file-download-busy') === 'true';
}

function set_busy(trigger: HTMLElement, busy: boolean): void {
    trigger.setAttribute('data-file-download-busy', busy ? 'true' : 'false');
}

function update_status_text(
    parts: FileDownloadButtonParts,
    text: string,
    icon_html_str: string,
    state: FileDownloadStatusState
): void {
    set_tooltip_status_with_icon(parts, text, icon_html_str, state);
}

export function set_file_download_idle(
    parts: FileDownloadButtonParts,
    _idle_icon_html: string,
    idle_tooltip_text = ''
): void {
    const trigger = find_trigger(parts);
    set_busy(trigger, false);
    if (parts.live_region) {
        parts.live_region.textContent = '';
    }
    set_tooltip_active(parts, false);
    clear_tooltip_status_classes(parts.tooltip_el);
    parts.tooltip_el.replaceChildren();
    parts.tooltip_el.textContent = idle_tooltip_text;
    sync_tooltip_content_attr(parts.tooltip_el);
}

function apply_generating_state(
    parts: FileDownloadButtonParts,
    t: TranslationFn,
    Helpers: FileDownloadHelpers,
    icon_size: number
): void {
    const trigger = find_trigger(parts);
    set_busy(trigger, true);
    const msg = t('file_download_generating');
    const icon_markup = status_icon_markup(Helpers, 'generating', icon_size);
    update_status_text(parts, msg, icon_markup, 'generating');
    set_tooltip_active(parts, true);
}

function apply_ready_state(
    parts: FileDownloadButtonParts,
    t: TranslationFn,
    Helpers: FileDownloadHelpers,
    icon_size: number
): void {
    const msg = t('file_download_ready');
    const icon_markup = status_icon_markup(Helpers, 'ready', icon_size);
    update_status_text(parts, msg, icon_markup, 'ready');
    set_tooltip_active(parts, true);
}

function resolve_error_message(t: TranslationFn, message_key: string): string {
    if (message_key === 'file_download_too_large') {
        return t(message_key, { max_size: format_file_download_max_size_label() });
    }
    return t(message_key);
}

function apply_error_state(
    parts: FileDownloadButtonParts,
    t: TranslationFn,
    Helpers: FileDownloadHelpers,
    icon_size: number,
    message_key = 'file_download_failed',
    custom_message?: string
): void {
    const msg = custom_message ?? resolve_error_message(t, message_key);
    const icon_markup = status_icon_markup(Helpers, 'error', icon_size);
    set_tooltip_status_with_icon(parts, msg, icon_markup, 'error');
    set_tooltip_active(parts, true);
}

export async function run_file_download_flow(
    parts: FileDownloadButtonParts,
    t: TranslationFn,
    Helpers: FileDownloadHelpers,
    download_fn: () => void | Promise<void>,
    options: { idle_icon_html?: string; idle_tooltip_text?: string; icon_size?: number } = {}
): Promise<void> {
    const trigger = find_trigger(parts);
    if (is_busy(trigger)) return;

    const icon_size = options.icon_size ?? 16;
    const idle_icon_html = options.idle_icon_html ?? '';
    const idle_tooltip = options.idle_tooltip_text ?? '';

    apply_generating_state(parts, t, Helpers, icon_size);

    try {
        await Promise.resolve(download_fn());
        apply_ready_state(parts, t, Helpers, icon_size);
        await new Promise((resolve) => setTimeout(resolve, READY_RESET_MS));
        set_file_download_idle(parts, idle_icon_html, idle_tooltip);
    } catch (error) {
        if (is_export_pdf_html_too_large_error(error)) {
            apply_error_state(
                parts,
                t,
                Helpers,
                icon_size,
                'file_download_failed',
                build_export_pdf_html_too_large_message(t, error as ExportPdfHtmlTooLargeError)
            );
        } else if (is_export_pdf_failed_error(error)) {
            apply_error_state(
                parts,
                t,
                Helpers,
                icon_size,
                'file_download_failed',
                error.user_message
            );
        } else {
            const message_key = is_download_file_too_large_error(error)
                ? 'file_download_too_large'
                : 'file_download_failed';
            apply_error_state(parts, t, Helpers, icon_size, message_key);
        }
        await new Promise((resolve) => setTimeout(resolve, READY_RESET_MS));
        set_file_download_idle(parts, idle_icon_html, idle_tooltip);
    }
}

function bind_download_handler(
    parts: FileDownloadButtonParts,
    t: TranslationFn,
    Helpers: FileDownloadHelpers,
    download_fn: () => void | Promise<void>,
    options: { idle_icon_html?: string; idle_tooltip_text?: string; icon_size?: number }
): void {
    const trigger = find_trigger(parts);
    trigger.addEventListener('click', (event: Event) => {
        if (trigger.tagName.toLowerCase() === 'a') {
            event.preventDefault();
        }
        if (is_busy(trigger)) {
            event.stopImmediatePropagation();
            return;
        }
        void run_file_download_flow(parts, t, Helpers, download_fn, options);
    });
}

export function wrap_file_download_trigger(
    trigger: HTMLElement,
    t: TranslationFn,
    Helpers: FileDownloadHelpers,
    download_fn: () => void | Promise<void>,
    options: {
        idle_tooltip_text?: string;
        idle_icon_html?: string;
        icon_size?: number;
    } = {}
): FileDownloadButtonParts {
    if (!trigger.classList.contains('file-download-btn')) {
        trigger.classList.add('file-download-btn');
    }
    if (!trigger.querySelector('.file-download-btn__status-icon')) {
        const first_span = trigger.querySelector('span:not(.file-download-btn__status-icon)');
        if (first_span && !first_span.classList.contains('file-download-btn__label')) {
            first_span.classList.add('file-download-btn__label');
        }
        const status_wrap = Helpers.create_element('span', {
            class_name: 'file-download-btn__status-icon',
            attributes: { 'aria-hidden': 'true' },
        });
        if (options.idle_icon_html) {
            status_wrap.innerHTML = options.idle_icon_html;
        }
        trigger.appendChild(status_wrap);
    }

    const parent = trigger.parentElement;
    if (parent?.classList.contains('file-download-tooltip-wrapper')) {
        const wrapper = parent;
        const tooltip_el = wrapper.querySelector('[data-file-download-tooltip]');
        const live_region = find_file_download_live_region(wrapper);
        const parts: FileDownloadButtonParts = {
            wrapper,
            button: trigger,
            live_region,
            tooltip_el: tooltip_el instanceof HTMLElement ? tooltip_el : wrapper,
        };
        bind_download_handler(parts, t, Helpers, download_fn, options);
        return parts;
    }

    const { wrapper, live_region, tooltip_el } = create_status_icon_tooltip_wrapper(Helpers, {
        content: trigger,
        idle_tooltip_text: options.idle_tooltip_text ?? '',
        include_live_region: true,
    });

    trigger.parentNode?.replaceChild(wrapper, trigger);

    const parts: FileDownloadButtonParts = {
        wrapper,
        button: trigger,
        live_region,
        tooltip_el,
    };
    bind_download_handler(parts, t, Helpers, download_fn, options);
    return parts;
}

export function create_file_download_button(
    opts: CreateFileDownloadButtonOptions
): FileDownloadButtonParts {
    const {
        Helpers,
        label,
        on_download,
        t,
        variant = 'button-default',
        extra_class_names = [],
        icon_name = 'save',
        icon_size = 16,
        idle_tooltip_text = '',
        id = null,
        aria_describedby = null,
        aria_label = null,
        tag = 'button',
        href = '#',
        omit_small = false,
    } = opts;

    const class_names = ['button', variant, 'file-download-btn', ...extra_class_names];
    if (!omit_small) {
        class_names.splice(1, 0, 'button-small');
    }
    const attributes: Record<string, string> = {
        'data-file-download-busy': 'false',
    };
    if (tag === 'button') {
        attributes.type = 'button';
    } else {
        attributes.href = href;
    }
    if (id) attributes.id = id;
    if (aria_describedby) attributes['aria-describedby'] = aria_describedby;
    if (aria_label) attributes['aria-label'] = aria_label;

    const idle_icon = icon_name ? icon_html(Helpers, icon_name, icon_size) : '';

    const trigger = Helpers.create_element(tag, {
        class_name: class_names,
        attributes,
        html_content:
            `<span class="file-download-btn__label">${label}</span>` +
            `<span class="file-download-btn__status-icon" aria-hidden="true">${idle_icon}</span>`,
    });

    const { wrapper, live_region, tooltip_el } = create_status_icon_tooltip_wrapper(Helpers, {
        content: trigger,
        idle_tooltip_text,
        include_live_region: true,
    });

    const parts: FileDownloadButtonParts = {
        wrapper,
        button: trigger,
        live_region,
        tooltip_el,
    };

    bind_download_handler(parts, t, Helpers, on_download, {
        idle_icon_html: idle_icon,
        idle_tooltip_text,
        icon_size,
    });

    return parts;
}

/**
 * @fileoverview Statusfält i modalen Bifoga media (aria-live och dubblettfel).
 */

import {
    build_attach_media_duplicate_filenames_message,
    type AttachMediaDuplicateScope
} from './attach_media_duplicate_filename_status.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    escape_html?: (value: string) => string;
    safe_set_inner_html?: (
        element: HTMLElement,
        html: string,
        options?: { allow_html?: boolean; sanitize?: boolean }
    ) => void;
};

type AttachMediaStatusOptions = {
    t: TranslateFn;
    Helpers: HelpersLike;
    media_scope: AttachMediaDuplicateScope;
    on_status_message?: (message: string, type: 'info' | 'error' | 'success') => void;
};

export type AttachMediaStatusHandlers = {
    status_el: HTMLElement;
    show_status: (
        message: string,
        type?: 'info' | 'error' | 'success',
        options?: { html?: boolean }
    ) => void;
    show_duplicate_filenames_error: (filenames: string[]) => void;
};

/**
 * Skapar statusfält och visningsfunktioner för modalen Bifoga media.
 */
export function create_attach_media_status_handlers(
    options: AttachMediaStatusOptions
): AttachMediaStatusHandlers {
    const { t, Helpers, media_scope, on_status_message } = options;
    const escape_html = (value: string): string =>
        typeof Helpers.escape_html === 'function' ? Helpers.escape_html(value) : value;

    const status_el = Helpers.create_element('p', {
        class_name: 'attach-media-status',
        attributes: { 'aria-live': 'polite' }
    });
    status_el.hidden = true;

    const show_status = (
        message: string,
        type: 'info' | 'error' | 'success' = 'info',
        html_options?: { html?: boolean }
    ) => {
        status_el.hidden = false;
        status_el.className = `attach-media-status attach-media-status--${type}`;
        status_el.setAttribute('aria-live', 'polite');
        if (html_options?.html && typeof Helpers.safe_set_inner_html === 'function') {
            Helpers.safe_set_inner_html(status_el, message, { allow_html: true });
        } else {
            status_el.textContent = message;
        }
        if (type === 'error') {
            status_el.setAttribute('role', 'alert');
        } else {
            status_el.removeAttribute('role');
        }
        on_status_message?.(message, type);
    };

    const show_duplicate_filenames_error = (filenames: string[]) => {
        const html = build_attach_media_duplicate_filenames_message(
            t,
            media_scope,
            filenames,
            escape_html
        );
        if (!html) return;
        show_status(html, 'error', { html: true });
    };

    return { status_el, show_status, show_duplicate_filenames_error };
}

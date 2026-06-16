/**
 * @file Delad säker markdown-rendering (samma regler som infoblock och kravtexter).
 */

import { marked, auto_convert_code_like_to_codeblocks } from './markdown.js';

export interface SafeMarkdownHelpers {
    escape_html?: (value: string) => string;
    sanitize_html?: (value: string) => string;
}

function fallback_escape_html(value: string): string {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Parsar markdown till HTML med samma renderer som infoblock: HTML-taggar i källtext
 * escapes, markdown (fet, kursiv, kod, listor) renderas normalt.
 */
export function render_safe_markdown_html(
    markdown_string: unknown,
    helpers: SafeMarkdownHelpers = {}
): string {
    const escape_html = helpers.escape_html ?? fallback_escape_html;
    const raw = String(markdown_string ?? '');
    if (!raw.trim()) return '';

    if (typeof marked === 'undefined' || !helpers.escape_html) {
        return escape_html(raw);
    }

    const processed_markdown = auto_convert_code_like_to_codeblocks(raw);
    const renderer = new marked.Renderer();
    renderer.link = (href, _title, text) => {
        const safe_href = escape_html(String(href ?? ''));
        const safe_text = escape_html(String(text ?? ''));
        return `<a href="${safe_href}" target="_blank" rel="noopener noreferrer">${safe_text}</a>`;
    };
    renderer.html = (html_token) => {
        const text_to_escape =
            typeof html_token === 'object' && html_token !== null && typeof (html_token as { text?: string }).text === 'string'
                ? (html_token as { text: string }).text
                : String(html_token || '');
        return escape_html(text_to_escape);
    };

    const parsed_markdown = marked.parse(processed_markdown, { renderer, breaks: true, gfm: true });
    const html = typeof parsed_markdown === 'string' ? parsed_markdown : '';
    if (helpers.sanitize_html) {
        return helpers.sanitize_html(html);
    }
    return html;
}

export function apply_safe_markdown_to_element(
    element: HTMLElement,
    markdown_string: unknown,
    helpers: SafeMarkdownHelpers = {}
): void {
    const html = render_safe_markdown_html(markdown_string, helpers);
    if (!html) {
        element.textContent = '';
        return;
    }
    element.innerHTML = html;
}

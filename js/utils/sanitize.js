import { get_translation_t } from './translation_access.js';
import { get_external_link_icon_html } from '../ui/icons.js';

/**
 * Sanerar vanlig textinmatning (ej HTML) genom att trimma, ta bort farliga script-taggar
 * och säkerställa att resultatet alltid är en sträng.
 * Denna funktion ska användas för vanliga formulärfält där vi inte ska tolka HTML.
 * @param {string} input
 * @param {{ trim?: boolean }} options
 * @returns {string}
 */
export function sanitize_plain_input(input, options = {}) {
    const { trim = true } = options;
    if (typeof input !== 'string') return '';
    const without_scripts = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return trim ? without_scripts.trim() : without_scripts;
}

/**
 * Sanerar en array av vanliga textvärden (ej HTML) med samma regler som sanitize_plain_input.
 * @param {string[]} values
 * @param {{ trim?: boolean }} options
 * @returns {string[]}
 */
export function sanitize_plain_array(values, options = {}) {
    if (!Array.isArray(values)) return [];
    return values.map(v => sanitize_plain_input(v, options));
}

export function sanitize_html(html_string) {
    if (typeof html_string !== 'string' || !html_string) return '';

    // Create a temporary div to parse HTML safely
    const temp_div = document.createElement('div');
    temp_div.innerHTML = html_string;

    // Remove dangerous elements and attributes
    const dangerous_elements = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'];
    dangerous_elements.forEach(tag => {
        temp_div.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Remove dangerous attributes
    const dangerous_attributes = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'];
    temp_div.querySelectorAll('*').forEach(el => {
        dangerous_attributes.forEach(attr => {
            if (el.hasAttribute(attr)) {
                el.removeAttribute(attr);
            }
        });
        // Ensure all links open in new tab safely and add external link icon
        if (el.tagName === 'A') {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
            const t = get_translation_t();
            const t_for_icon = (k) => (k === 'opens_in_new_tab' ? '(Öppnas i ny flik)' : t(k));
            el.innerHTML = (el.innerHTML || '').trim() + get_external_link_icon_html(t_for_icon);
        }
    });

    return temp_div.innerHTML;
}

export function safe_set_inner_html(element, content, options = {}) {
    if (!element || typeof content !== 'string') return;

    const { allow_html = false, sanitize = true } = options;

    if (allow_html && sanitize) {
        element.innerHTML = sanitize_html(content);
    } else if (allow_html) {
        element.innerHTML = content;
    } else {
        element.textContent = content;
    }
}

export function sanitize_and_linkify_html(raw_html_string) {
    if (typeof raw_html_string !== 'string' || !raw_html_string) return '';
    const template = document.createElement('template');
    template.innerHTML = raw_html_string;
    const content = template.content;
    content.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
    content.querySelectorAll('a').forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        const t = get_translation_t();
        const t_for_icon = (k) => (k === 'opens_in_new_tab' ? '(Öppnas i ny flik)' : t(k));
        link.innerHTML = (link.innerHTML || '').trim() + get_external_link_icon_html(t_for_icon);
    });
    const temp_div = document.createElement('div');
    temp_div.appendChild(content);
    return temp_div.innerHTML;
}


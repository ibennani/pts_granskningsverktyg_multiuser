// js/utils/helpers.js
export { generate_uuid_v4 } from './uuid.js';
export { get_current_user_name } from '../user/current_user.js';
export {
    get_app_base,
    resolve_asset_href,
    load_css,
    load_css_with_retry,
    load_css_safely
} from './assets.js';

export {
    format_iso_to_local_datetime,
    format_iso_to_local_date,
    format_iso_to_relative_time
} from './date_format.js';


export function get_current_iso_datetime_utc() {
    return new Date().toISOString();
}

export { escape_html } from './html_escape.js';
export { get_external_link_icon_html, get_icon_svg } from '../ui/icons.js';
export {
    sanitize_plain_input,
    sanitize_plain_array,
    sanitize_html,
    safe_set_inner_html,
    sanitize_and_linkify_html
} from './sanitize.js';
export { create_element } from '../dom/create_element.js';

export function add_protocol_if_missing(url_string) {
    if (typeof url_string !== 'string' || !url_string.trim()) return '';
    const trimmed_url = url_string.trim();
    return /^(?:f|ht)tps?:\/\//i.test(trimmed_url) ? trimmed_url : `https://${trimmed_url}`;
}

/**
 * Generell trimning för textarea-innehåll: trimmar varje rad, tar bort tomrader först och sist.
 * Tomrader mitt i texten bevaras.
 */
export function trim_textarea_preserve_lines(value) {
    if (typeof value !== 'string') return value;
    const lines = value.split('\n').map(line => line.trim());
    while (lines.length > 0 && lines[0] === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\n');
}

export function init_auto_resize_for_textarea(textarea_element) {
    if (!textarea_element || textarea_element.tagName.toLowerCase() !== 'textarea') return;
    const _perform_resize = () => {
        textarea_element.style.height = 'auto';
        textarea_element.style.height = `${textarea_element.scrollHeight}px`;
    };
    if (textarea_element.dataset.gvAutoResizeInit === '1') {
        setTimeout(_perform_resize, 0);
        return;
    }
    textarea_element.dataset.gvAutoResizeInit = '1';
    textarea_element.addEventListener('input', _perform_resize);
    setTimeout(_perform_resize, 0);
}

export function natural_sort(a, b) {
    const re = /(\d+)/g;
    const a_parts = String(a).split(re);
    const b_parts = String(b).split(re);
    const len = Math.max(a_parts.length, b_parts.length);
    for (let i = 0; i < len; i++) {
        const a_part = a_parts[i] || '';
        const b_part = b_parts[i] || '';
        const a_num = parseInt(a_part, 10);
        const b_num = parseInt(b_part, 10);
        if (!isNaN(a_num) && !isNaN(b_num)) {
            if (a_num < b_num) return -1;
            if (a_num > b_num) return 1;
        } else {
            if (a_part < b_part) return -1;
            if (a_part > b_part) return 1;
        }
    }
    return 0;
}

export function format_number_locally(number, lang_code = 'en-GB', options = {}) {
    if (typeof number !== 'number' || isNaN(number)) {
        return '---';
    }

    const defaultOptions = {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
        return new Intl.NumberFormat(lang_code, finalOptions).format(number);
    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn(`[Helpers] Error formatting number for locale "${lang_code}":`, e);
        return number.toFixed(finalOptions.maximumFractionDigits);
    }
}

export function sanitize_id_for_css_selector(id_string) {
    if (typeof id_string !== 'string') return '';
    return id_string.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/**
 * Hjälpfunktion för att avgöra om aktuell regelfil kan redigeras.
 * En regelfil är redigerbar endast när vi är i regelfilsredigeringsläge
 * och den inte är markerad som publicerad i state.
 * @param {object} state - Hela appens state från getState()
 * @returns {boolean}
 */
export function can_edit_rulefile(state) {
    if (!state || typeof state !== 'object') return false;
    if (state.auditStatus !== 'rulefile_editing') return false;
    if (state.ruleFileIsPublished === true) return false;
    return true;
}


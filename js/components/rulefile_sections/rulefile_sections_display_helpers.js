/**
 * @fileoverview Hjälpfunktioner för att visa metadata i regelfilssektioner (listor, datum, länkar).
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function format_simple_value(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') {
        if (value.text) return value.text;
        if (value.label) return value.label;
        if (value.name) return value.name;
        if (value.title) return value.title;
        try {
            return JSON.stringify(value);
        } catch (error) {
            console.warn('[RulefileSectionsViewComponent] Could not stringify value', value, error);
            return '';
        }
    }
    return String(value);
}

/**
 * @param {object} Helpers
 * @param {Array<[string, unknown]>} entries
 */
export function create_definition_list(Helpers, entries) {
    const dl = Helpers.create_element('dl', { class_name: 'metadata-definition-list' });
    entries.forEach(([label, value]) => {
        if (value === undefined || value === null || value === '') {
            return;
        }
        dl.appendChild(Helpers.create_element('dt', { text_content: String(label) }));
        if (Array.isArray(value)) {
            const list = Helpers.create_element('ul', { class_name: 'metadata-inline-list' });
            value.filter(Boolean).forEach(item => {
                list.appendChild(Helpers.create_element('li', { text_content: format_simple_value(item) }));
            });
            dl.appendChild(Helpers.create_element('dd', {})).appendChild(list);
        } else {
            dl.appendChild(Helpers.create_element('dd', { text_content: format_simple_value(value) }));
        }
    });
    return dl;
}

/**
 * @param {string} iso_string
 * @returns {string}
 */
export function format_date_display(iso_string) {
    if (!iso_string) return '';
    try {
        const date = new Date(iso_string);
        if (Number.isNaN(date.getTime())) return iso_string;
        const locale = window.Translation?.getCurrentLocale?.()
            || window.Translation?.currentLocale
            || (typeof navigator !== 'undefined' ? navigator.language : 'en-GB');
        return date.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (error) {
        console.warn('[RulefileSectionsViewComponent] Failed to format date', iso_string, error);
        return iso_string;
    }
}

/**
 * @param {object} Helpers
 * @param {object} Translation
 * @param {string} source_url
 */
export function create_source_link(Helpers, Translation, source_url) {
    const clean_url = Helpers.add_protocol_if_missing ? Helpers.add_protocol_if_missing(source_url) : source_url;
    if (!clean_url) return null;
    const t = Translation?.t || (k => (k === 'opens_in_new_tab' ? '(Öppnas i ny flik)' : k));
    const icon_html = Helpers.get_external_link_icon_html ? Helpers.get_external_link_icon_html(t) : ' ↗';
    return Helpers.create_element('a', {
        html_content: (Helpers.escape_html ? Helpers.escape_html(source_url) : source_url) + icon_html,
        attributes: {
            href: clean_url,
            target: '_blank',
            rel: 'noopener noreferrer'
        }
    });
}

/**
 * @param {object} Helpers
 * @param {(key: string) => string} t
 * @param {unknown[]} items
 * @param {string} empty_key
 * @param {string} [class_name]
 */
export function create_list(Helpers, t, items, empty_key, class_name = 'metadata-list') {
    if (!Array.isArray(items) || items.length === 0) {
        return Helpers.create_element('p', { class_name: 'metadata-empty', text_content: t(empty_key) });
    }
    const ul = Helpers.create_element('ul', { class_name });
    items.filter(Boolean).forEach(item => {
        const content = format_simple_value(item);
        if (!content) return;
        ul.appendChild(Helpers.create_element('li', { text_content: content }));
    });
    return ul;
}

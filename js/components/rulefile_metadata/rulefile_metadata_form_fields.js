/**
 * Formulärfält för redigering av regelfilsmetadata (textfält, textarea, språkval).
 * @module js/components/rulefile_metadata/rulefile_metadata_form_fields
 */

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 * @param {string} label_key
 * @param {string} name
 * @param {string} [value]
 * @param {string} [type]
 * @param {object} [options]
 * @returns {HTMLElement}
 */
export function create_field(ctx, label_key, name, value = '', type = 'text', options = {}) {
    const { Helpers, Translation } = ctx;
    const { required = false } = options;
    const container = Helpers.create_element('div', { class_name: 'form-group' });
    const labelText = Translation.t(label_key);
    const label = Helpers.create_element('label', { attributes: { for: name }, text_content: labelText });
    container.appendChild(label);

    if (type === 'textarea') {
        const textarea = Helpers.create_element('textarea', {
            class_name: 'form-control',
            attributes: { id: name, name, rows: '3', ...(required ? { required: 'required' } : {}) }
        });
        textarea.value = value ?? '';
        container.appendChild(textarea);
        Helpers.init_auto_resize_for_textarea?.(textarea);
    } else {
        let input_value = value ?? '';
        if (type === 'date' && input_value) {
            const iso_like = String(input_value);
            let parsed = null;

            if (/[T ]\d{2}:\d{2}/.test(iso_like) || iso_like.includes('T')) {
                const d = new Date(iso_like);
                if (!Number.isNaN(d.getTime())) parsed = d;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(iso_like)) {
                parsed = null;
            } else {
                const d = new Date(iso_like);
                if (!Number.isNaN(d.getTime())) parsed = d;
            }

            if (parsed) {
                const yyyy = parsed.getFullYear();
                const mm = String(parsed.getMonth() + 1).padStart(2, '0');
                const dd = String(parsed.getDate()).padStart(2, '0');
                input_value = `${yyyy}-${mm}-${dd}`;
            } else if (!/^\d{4}-\d{2}-\d{2}$/.test(iso_like)) {
                input_value = '';
            }
        }

        const input_type = type === 'date' ? 'text' : type;
        const attributes = { id: name, name, type: input_type, ...(required ? { required: 'required' } : {}) };
        if (type === 'date') {
            attributes.inputmode = 'numeric';
            attributes.autocomplete = 'off';
        }

        const input = Helpers.create_element('input', {
            class_name: 'form-control',
            attributes
        });
        input.value = input_value;
        container.appendChild(input);
    }

    return container;
}

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 * @param {string} name
 * @param {string} value
 * @returns {HTMLElement}
 */
export function create_language_select_field(ctx, name, value) {
    const { Helpers, Translation } = ctx;
    const container = Helpers.create_element('div', { class_name: 'form-group' });
    const t = Translation.t;
    const labelText = t('rulefile_metadata_field_language');
    const label = Helpers.create_element('label', { attributes: { for: name }, text_content: labelText });
    container.appendChild(label);

    const select = Helpers.create_element('select', {
        class_name: 'form-control',
        attributes: { id: name, name }
    });

    const supported =
        (Translation?.get_supported_languages && Translation.get_supported_languages()) ||
        (typeof window !== 'undefined' && window.Translation?.get_supported_languages && window.Translation.get_supported_languages()) ||
        {};
    const codes = Object.keys(supported);

    const current_lang_code =
        (Translation?.get_current_language_code && Translation.get_current_language_code()) ||
        (typeof window !== 'undefined' && window.Translation?.get_current_language_code && window.Translation.get_current_language_code()) ||
        null;

    let initial = (value || '').toString().trim();
    if (!initial) {
        if (current_lang_code && codes.includes(current_lang_code)) {
            initial = current_lang_code;
        } else if (codes.length > 0) {
            initial = codes[0];
        }
    }

    codes.forEach((code) => {
        const option = Helpers.create_element('option', {
            attributes: { value: code },
            text_content: supported[code] || code
        });
        select.appendChild(option);
    });

    if (initial) {
        select.value = initial;
    }

    container.appendChild(select);
    return container;
}

/**
 * Inline-fält, kryssrutor och små knappar för redigerbara listor i regelfilsmetadata.
 * @module js/components/rulefile_metadata/rulefile_metadata_list_controls
 */

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 */
export function create_inline_input(ctx, label_key, value, onChange, options = {}) {
    const { Helpers, Translation } = ctx;
    const { type = 'text', textarea = false, rawLabel = null } = options;
    const wrapper = Helpers.create_element('div', { class_name: 'inline-field' });
    const inputId = `inline-${Math.random().toString(36).substring(2, 10)}`;
    const labelText = rawLabel ?? Translation.t(label_key);
    const label = Helpers.create_element('label', { attributes: { for: inputId }, text_content: labelText });
    wrapper.appendChild(label);

    let input;
    if (textarea) {
        input = Helpers.create_element('textarea', {
            class_name: 'form-control form-control-compact',
            attributes: { id: inputId, rows: '3' }
        });
        input.value = value ?? '';
        Helpers.init_auto_resize_for_textarea?.(input);
        input.addEventListener('input', event => onChange(event.target.value));
    } else {
        input = Helpers.create_element('input', {
            class_name: 'form-control form-control-compact',
            attributes: { id: inputId, type }
        });
        input.value = value ?? '';
        input.addEventListener('input', event => onChange(event.target.value));
    }

    wrapper.appendChild(input);
    return wrapper;
}

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 */
export function create_checkbox_input(ctx, label_key, checked, onChange) {
    const { Helpers, Translation } = ctx;
    const wrapper = Helpers.create_element('div', { class_name: 'form-check-inline' });
    const inputId = `checkbox-${Math.random().toString(36).substring(2, 10)}`;
    const input = Helpers.create_element('input', {
        class_name: 'form-check-input',
        attributes: { id: inputId, type: 'checkbox' }
    });
    input.checked = !!checked;
    input.addEventListener('change', event => onChange(event.target.checked));
    const label = Helpers.create_element('label', {
        attributes: { for: inputId },
        text_content: Translation.t(label_key),
        class_name: 'form-check-label'
    });
    wrapper.append(input, label);
    return wrapper;
}

/**
 * @param {{ Helpers: object, Translation: object }} ctx
 */
export function create_small_button(ctx, text_or_key, icon_name, onClick, variant = 'secondary', options = {}) {
    const { Helpers, Translation } = ctx;
    const { plainText = false, ariaLabel = null } = options;
    const resolveText = (value) => plainText ? value : Translation.t(value);
    const computeHtml = (value) => {
        const label = resolveText(value);
        const safeLabel = Helpers.escape_html ? Helpers.escape_html(label) : label;
        return `<span>${safeLabel}</span>` + (icon_name && Helpers.get_icon_svg ? Helpers.get_icon_svg(icon_name) : '');
    };

    const button = Helpers.create_element('button', {
        class_name: ['button', `button-${variant}`, 'button-small'],
        attributes: { type: 'button' },
        html_content: computeHtml(text_or_key)
    });

    const resolvedAria = ariaLabel || resolveText(text_or_key);
    if (resolvedAria) {
        button.setAttribute('aria-label', resolvedAria);
    }

    button.addEventListener('click', onClick);

    button.updateButtonText = (newText, newAria) => {
        button.innerHTML = computeHtml(newText);
        const aria = newAria || resolveText(newText);
        if (aria) {
            button.setAttribute('aria-label', aria);
        }
    };

    return button;
}

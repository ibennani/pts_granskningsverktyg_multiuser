/**
 * Brygga: behåller import med .js-suffix och kompletterar innehållstypeditorn
 * med en redigerbar DOM-selector utan att duplicera grundformuläret.
 */
export * from './rulefile_content_type_edit_ui.ts';

import { render_content_type_edit_form as render_base_content_type_edit_form } from './rulefile_content_type_edit_ui.ts';

function is_selector_syntax_valid(selector) {
    const value = String(selector || '').trim();
    if (!value) return true;
    try {
        document.querySelector(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Wrapper runt befintlig editor. detectionSelector är ett frivilligt webb-fält och
 * äldre regelfiler fortsätter därför fungera oförändrat.
 */
export function render_content_type_edit_form(ctx, container, working_metadata, rule_file_content, options) {
    const result = render_base_content_type_edit_form(
        ctx,
        container,
        working_metadata,
        rule_file_content,
        options
    );

    const form = result.form;
    const fields = form.querySelector('.content-type-edit-fields');
    const location = options.location;
    const child = location?.child || {};
    if (!fields) return result;

    const t = ctx?.Translation?.t;
    const label_text = t?.('rulefile_content_types_field_detection_selector') || 'DOM-selector för automatisk identifiering';
    const help_text = t?.('rulefile_content_types_field_detection_selector_help') ||
        'CSS-selector som körs mot sidans renderade DOM. Exempel: h1,h2,h3,h4,h5,h6,[role="heading"].';
    const invalid_text = t?.('rulefile_content_types_field_detection_selector_invalid') ||
        'DOM-selectorn är inte en giltig CSS-selector.';

    const group = document.createElement('div');
    group.className = 'form-group';
    const id = `content-type-selector-${Math.random().toString(36).substring(2, 8)}`;

    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = label_text;
    group.appendChild(label);

    const hint = document.createElement('p');
    hint.className = 'field-hint';
    hint.id = `${id}-help`;
    hint.textContent = help_text;
    group.appendChild(hint);

    const input = document.createElement('textarea');
    input.className = 'form-control content-type-edit-selector-input';
    input.id = id;
    input.rows = 2;
    input.dataset.contentTypeField = 'detectionSelector';
    input.setAttribute('aria-describedby', hint.id);
    input.value = child.detectionSelector || '';
    group.appendChild(input);

    const default_selected = fields.querySelector('[data-content-type-field="defaultSelected"]');
    const default_group = default_selected?.closest('.form-group');
    if (default_group) {
        fields.insertBefore(group, default_group);
    } else {
        fields.appendChild(group);
    }

    const validate = () => {
        input.setCustomValidity(is_selector_syntax_valid(input.value) ? '' : invalid_text);
    };
    input.addEventListener('input', () => {
        validate();
        const value = input.value;
        if (value.trim()) child.detectionSelector = value;
        else delete child.detectionSelector;
        options.on_change?.();
    });
    validate();

    const base_sync = result.sync_from_form;
    result.sync_from_form = (should_trim) => {
        const next_location = base_sync(should_trim);
        const target = next_location?.child;
        if (target) {
            const value = should_trim ? input.value.trim() : input.value;
            if (value) target.detectionSelector = value;
            else delete target.detectionSelector;
        }
        return next_location;
    };

    return result;
}

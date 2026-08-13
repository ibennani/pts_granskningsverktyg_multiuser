/**
 * @fileoverview Utökar befintlig innehållstypeditor med redigerbar DOM-selector.
 */
import { render_content_type_edit_form as render_base_content_type_edit_form } from './rulefile_content_type_edit_ui_base.js';

function is_selector_syntax_valid(selector: unknown): boolean {
    const value = String(selector || '').trim();
    if (!value) return true;
    try {
        document.querySelector(value);
        return true;
    } catch {
        return false;
    }
}

function translate_or_fallback(t: any, key: string, fallback: string): string {
    const value = t?.(key);
    return value && value !== key && value !== `**${key}**` ? String(value) : fallback;
}

export function render_content_type_edit_form(
    ctx: any,
    container: HTMLElement,
    working_metadata: Record<string, unknown>,
    rule_file_content: Record<string, unknown>,
    options: any
): any {
    const result = render_base_content_type_edit_form(
        ctx,
        container,
        working_metadata,
        rule_file_content,
        options
    ) as any;

    const form = result.form as HTMLFormElement;
    const fields = form.querySelector('.content-type-edit-fields');
    const child = options?.location?.child as Record<string, any> | undefined;
    if (!(fields instanceof HTMLElement) || !child) return result;

    const t = ctx?.Translation?.t;
    const label_text = translate_or_fallback(
        t,
        'rulefile_content_types_field_detection_selector',
        'DOM-selector för automatisk identifiering'
    );
    const help_text = translate_or_fallback(
        t,
        'rulefile_content_types_field_detection_selector_help',
        'CSS-selector som körs mot sidans renderade DOM. Exempel: h1,h2,h3,h4,h5,h6,[role="heading"].'
    );
    const invalid_text = translate_or_fallback(
        t,
        'rulefile_content_types_field_detection_selector_invalid',
        'DOM-selectorn är inte en giltig CSS-selector.'
    );

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
    input.value = String(child.detectionSelector || '');
    group.appendChild(input);

    const default_selected = fields.querySelector('[data-content-type-field="defaultSelected"]');
    const default_group = default_selected?.closest('.form-group');
    if (default_group) fields.insertBefore(group, default_group);
    else fields.appendChild(group);

    const validate = (): void => {
        input.setCustomValidity(is_selector_syntax_valid(input.value) ? '' : invalid_text);
    };
    input.addEventListener('input', () => {
        validate();
        const value = input.value;
        if (value.trim()) child.detectionSelector = value;
        else delete child.detectionSelector;
        options?.on_change?.();
    });
    validate();

    const base_sync = result.sync_from_form as (should_trim: boolean) => any;
    result.sync_from_form = (should_trim: boolean) => {
        const next_location = base_sync(should_trim);
        const target = next_location?.child as Record<string, any> | undefined;
        if (target) {
            const value = should_trim ? input.value.trim() : input.value;
            if (value) target.detectionSelector = value;
            else delete target.detectionSelector;
        }
        return next_location;
    };

    return result;
}

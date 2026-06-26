/**
 * @file Slutdatumfält i metadataformuläret (textinmatning enligt locale).
 */

import {
    metadata_form_get_lang_code,
    metadata_form_parse_start_date,
    metadata_form_start_date_error_text,
    metadata_form_normalize_start_date_display
} from './metadata_form_start_date.js';

type TranslationLike = {
    t: (key: string, params?: Record<string, unknown>) => string;
    get_current_language_code?: () => string;
};

type HelpersLike = {
    create_element: (tag: string, options?: Record<string, unknown>) => HTMLElement;
    get_locale_date_format_example?: (lang_code: string) => string;
    parse_locale_date_text_to_iso_date?: (text: string, lang_code: string) => { ok: boolean; iso_date?: string; reason?: string };
    normalize_locale_date_text_display?: (text: string, lang_code: string) => string;
};

export function metadata_form_parse_end_date(
    Helpers: HelpersLike | null | undefined,
    Translation: TranslationLike | null | undefined,
    raw_value: string
): { ok: true; iso_date: string | null } | { ok: false } {
    return metadata_form_parse_start_date(Helpers, Translation, raw_value);
}

export function metadata_form_end_date_error_text(
    Helpers: HelpersLike | null | undefined,
    Translation: TranslationLike | null | undefined
): string {
    const t = Translation?.t || ((key: string) => key);
    const example = Helpers?.get_locale_date_format_example?.(metadata_form_get_lang_code(Translation)) || '';
    return t('metadata_end_date_invalid', { example });
}

export function metadata_form_normalize_end_date_display(
    Helpers: HelpersLike | null | undefined,
    Translation: TranslationLike | null | undefined,
    raw_value: string
): string {
    return metadata_form_normalize_start_date_display(Helpers, Translation, raw_value);
}

export function metadata_form_create_end_date_field(
    Helpers: HelpersLike,
    Translation: TranslationLike,
    handlers: { on_blur: () => void; on_input: () => void },
    initial_value = ''
): { form_group: HTMLElement; input_element: HTMLInputElement; error_element: HTMLElement } {
    const t = Translation.t;
    const lang_code = metadata_form_get_lang_code(Translation);
    const example = Helpers.get_locale_date_format_example?.(lang_code) || '';
    const form_group = Helpers.create_element('div', { class_name: 'form-group' }) as HTMLElement;
    const label = Helpers.create_element('label', {
        attributes: { for: 'auditEndDate' },
        text_content: t('end_time')
    });
    const input_element = Helpers.create_element('input', {
        id: 'auditEndDate',
        class_name: 'form-control',
        attributes: {
            type: 'text',
            autocomplete: 'off',
            inputmode: 'numeric',
            'aria-describedby': 'auditEndDate-format-hint'
        }
    }) as HTMLInputElement;
    input_element.value = initial_value;
    const hint_el = Helpers.create_element('p', {
        id: 'auditEndDate-format-hint',
        class_name: 'form-help-text',
        text_content: t('locale_date_input_format_hint', { example })
    });
    const error_el = Helpers.create_element('p', {
        id: 'auditEndDate-error',
        class_name: 'form-error-text',
        attributes: { role: 'alert', hidden: 'hidden' },
        text_content: t('metadata_end_date_invalid', { example })
    });
    form_group.appendChild(label);
    form_group.appendChild(hint_el);
    form_group.appendChild(input_element);
    form_group.appendChild(error_el);
    input_element.addEventListener('blur', handlers.on_blur);
    input_element.addEventListener('input', handlers.on_input);
    return { form_group, input_element, error_element: error_el };
}

export function metadata_form_set_end_date_error_visible(
    input_element: HTMLInputElement | null,
    error_element: HTMLElement | null,
    show_error: boolean,
    message?: string
): void {
    if (!input_element || !error_element) return;
    if (message) {
        error_element.textContent = message;
    }
    error_element.hidden = !show_error;
    const hint_id = 'auditEndDate-format-hint';
    const error_id = 'auditEndDate-error';
    input_element.setAttribute(
        'aria-describedby',
        show_error ? `${hint_id} ${error_id}` : hint_id
    );
}

export function metadata_form_is_end_before_start(end_iso: string | null, start_iso: string | null): boolean {
    if (!end_iso || !start_iso) return false;
    return end_iso.slice(0, 10) < start_iso.slice(0, 10);
}

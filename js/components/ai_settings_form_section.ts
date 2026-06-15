/**
 * @file Formulärsektion för AI-inställningar (visas när AI är aktiverat).
 */

import {
    append_labeled_field,
    type AiSettingsData,
    type LlmTestResult,
    merge_model_names,
    populate_model_select,
    get_connection_test_status_text,
    AI_SETTINGS_DEFAULTS
} from './ai_settings_view_helpers.ts';

type CreateElementFn = (tag: string, options?: Record<string, unknown>) => HTMLElement;

export interface AiSettingsFormRefs {
    provider_select_ref: HTMLSelectElement | null;
    base_url_input_ref: HTMLInputElement | null;
    model_select_ref: HTMLSelectElement | null;
    api_key_input_ref: HTMLInputElement | null;
    timeout_input_ref: HTMLInputElement | null;
}

export interface AiSettingsFormSectionContext {
    Helpers: { create_element: CreateElementFn };
    refs: AiSettingsFormRefs;
    settings: AiSettingsData;
    discovered_models: string[];
    selected_model: string;
    test_in_progress: boolean;
    test_result: LlmTestResult | null;
    connection_test_passed: boolean;
    t: (key: string, params?: Record<string, unknown>) => string;
    on_test_click: () => void;
    on_model_change: (model: string) => void;
    on_connection_fields_change: () => void;
    on_form_input: () => void;
}

function append_post_test_fields(
    form: HTMLElement,
    ctx: AiSettingsFormSectionContext
): void {
    const { Helpers, refs, settings: s, t } = ctx;

    const model_group = Helpers.create_element('div', { class_name: 'form-group' });
    refs.model_select_ref = Helpers.create_element('select', {
        attributes: {
            id: 'ai-settings-model',
            'aria-describedby': 'ai-settings-model-help'
        },
        class_name: 'form-control'
    }) as HTMLSelectElement;
    const model_options = ctx.discovered_models.length > 0
        ? ctx.discovered_models
        : merge_model_names([], s.model || '');
    const selected_model = ctx.selected_model || s.model || '';
    populate_model_select(Helpers, refs.model_select_ref, model_options, selected_model, t);
    append_labeled_field(Helpers, model_group, {
        label_for: 'ai-settings-model',
        label_text: t('ai_settings_model_label'),
        help_id: 'ai-settings-model-help',
        help_text: t('ai_settings_model_help'),
        control: refs.model_select_ref
    });
    form.appendChild(model_group);
    refs.model_select_ref.addEventListener('change', () => {
        ctx.on_model_change(refs.model_select_ref?.value || '');
        ctx.on_form_input();
    });

    const key_group = Helpers.create_element('div', { class_name: 'form-group' });
    refs.api_key_input_ref = Helpers.create_element('input', {
        attributes: {
            type: 'password',
            id: 'ai-settings-api-key',
            autocomplete: 'off',
            'aria-describedby': 'ai-settings-api-key-help'
        },
        class_name: 'form-control'
    }) as HTMLInputElement;
    const key_help = s.api_key_configured
        ? t('ai_settings_api_key_configured', { masked: s.api_key_masked || '****' })
        : t('ai_settings_api_key_help');
    append_labeled_field(Helpers, key_group, {
        label_for: 'ai-settings-api-key',
        label_text: t('ai_settings_api_key_label'),
        help_id: 'ai-settings-api-key-help',
        help_text: key_help,
        control: refs.api_key_input_ref
    });
    form.appendChild(key_group);

    const timeout_group = Helpers.create_element('div', { class_name: 'form-group' });
    refs.timeout_input_ref = Helpers.create_element('input', {
        attributes: {
            type: 'number',
            id: 'ai-settings-timeout',
            min: '1000',
            max: '600000',
            step: '1000',
            value: String(s.timeout_ms ?? 60000),
            'aria-describedby': 'ai-settings-timeout-help'
        },
        class_name: 'form-control'
    }) as HTMLInputElement;
    append_labeled_field(Helpers, timeout_group, {
        label_for: 'ai-settings-timeout',
        label_text: t('ai_settings_timeout_label'),
        help_id: 'ai-settings-timeout-help',
        help_text: t('ai_settings_timeout_help'),
        control: refs.timeout_input_ref
    });
    form.appendChild(timeout_group);
    refs.timeout_input_ref.addEventListener('input', ctx.on_form_input);
}

export function render_ai_settings_form_section(
    plate: HTMLElement,
    ctx: AiSettingsFormSectionContext
): HTMLElement {
    const { Helpers, refs, settings: s, t } = ctx;
    const form = Helpers.create_element('div', { class_name: 'ai-settings-form' });
    form.appendChild(Helpers.create_element('h2', { text_content: t('ai_settings_connection_heading') }));

    const provider_group = Helpers.create_element('div', { class_name: 'form-group' });
    refs.provider_select_ref = Helpers.create_element('select', {
        attributes: { id: 'ai-settings-provider' },
        class_name: 'form-control'
    }) as HTMLSelectElement;
    [{ value: 'ollama', label: t('ai_settings_provider_ollama') }].forEach((opt_data) => {
        const opt = Helpers.create_element('option', {
            attributes: { value: opt_data.value },
            text_content: opt_data.label
        });
        if (opt_data.value === s.provider) opt.selected = true;
        refs.provider_select_ref?.appendChild(opt);
    });
    append_labeled_field(Helpers, provider_group, {
        label_for: 'ai-settings-provider',
        label_text: t('ai_settings_provider_label'),
        help_id: 'ai-settings-provider-help',
        help_text: t('ai_settings_provider_help'),
        control: refs.provider_select_ref
    });
    form.appendChild(provider_group);
    refs.provider_select_ref.addEventListener('change', () => {
        ctx.on_connection_fields_change();
        ctx.on_form_input();
    });

    const url_group = Helpers.create_element('div', { class_name: 'form-group' });
    refs.base_url_input_ref = Helpers.create_element('input', {
        attributes: {
            type: 'url',
            id: 'ai-settings-base-url',
            value: s.base_url || AI_SETTINGS_DEFAULTS.base_url,
            'aria-describedby': 'ai-settings-base-url-help'
        },
        class_name: ['form-control', 'form-control--wide']
    }) as HTMLInputElement;
    append_labeled_field(Helpers, url_group, {
        label_for: 'ai-settings-base-url',
        label_text: t('ai_settings_base_url_label'),
        help_id: 'ai-settings-base-url-help',
        help_text: t('ai_settings_base_url_help'),
        control: refs.base_url_input_ref
    });
    form.appendChild(url_group);
    refs.base_url_input_ref.addEventListener('input', ctx.on_form_input);
    refs.base_url_input_ref.addEventListener('change', ctx.on_connection_fields_change);

    const test_row = Helpers.create_element('div', { class_name: 'ai-settings-test-row' });
    const test_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-secondary'],
        text_content: ctx.test_in_progress ? t('ai_settings_testing') : t('ai_settings_test'),
        attributes: { type: 'button' }
    });
    test_btn.addEventListener('click', ctx.on_test_click);
    test_row.appendChild(test_btn);

    const status_text = get_connection_test_status_text(t, ctx.test_in_progress, ctx.test_result);
    const status_classes = ['ai-settings-test-status'];
    if (ctx.test_in_progress) status_classes.push('ai-settings-test-status--pending');
    else if (ctx.test_result?.ok) status_classes.push('ai-settings-test-status--ok');
    else if (ctx.test_result && !ctx.test_result.ok) status_classes.push('ai-settings-test-status--error');

    test_row.appendChild(Helpers.create_element('p', {
        class_name: status_classes,
        text_content: status_text,
        attributes: {
            'aria-live': 'polite',
            'aria-atomic': 'true',
            id: 'ai-settings-test-status'
        }
    }));
    form.appendChild(test_row);

    if (ctx.connection_test_passed) {
        append_post_test_fields(form, ctx);
    }

    plate.appendChild(form);
    return form;
}

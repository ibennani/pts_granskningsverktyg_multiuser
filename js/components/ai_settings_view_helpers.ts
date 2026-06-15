/**
 * @file Hjälpfunktioner för AI-inställningsvyn (formulärfält och testresultat).
 */

export const AI_SETTINGS_DEFAULTS = {
    provider: 'ollama',
    base_url: 'http://127.0.0.1:11434',
    model: '',
    enabled: false,
    timeout_ms: 60000,
    api_key_configured: false,
    api_key_masked: null
};

export interface LlmTestResult {
    ok: boolean;
    status: string;
    message: string;
    models: string[];
    model_available: boolean | null;
}

export interface AiSettingsData {
    provider: string;
    base_url: string;
    model: string;
    enabled: boolean;
    timeout_ms: number;
    api_key_configured?: boolean;
    api_key_masked?: string | null;
}

type CreateElementFn = (tag: string, options?: Record<string, unknown>) => HTMLElement;

export function append_labeled_field(
    Helpers: { create_element: CreateElementFn },
    group: HTMLElement,
    {
        label_for,
        label_text,
        help_id,
        help_text,
        control
    }: {
        label_for: string;
        label_text: string;
        help_id?: string;
        help_text?: string;
        control: HTMLElement;
    }
) {
    group.appendChild(Helpers.create_element('label', {
        class_name: 'form-field-label',
        text_content: label_text,
        attributes: { for: label_for }
    }));
    if (help_text && help_id) {
        group.appendChild(Helpers.create_element('p', {
            class_name: 'form-help',
            text_content: help_text,
            attributes: { id: help_id }
        }));
    }
    group.appendChild(control);
}

export function render_ai_settings_test_result(
    Helpers: { create_element: CreateElementFn },
    plate: HTMLElement,
    t: (key: string, params?: Record<string, unknown>) => string,
    test_in_progress: boolean,
    result: LlmTestResult | null
) {
    if (!result && !test_in_progress) return;

    const section = Helpers.create_element('section', {
        class_name: 'ai-settings-test-section',
        attributes: { 'aria-labelledby': 'ai-settings-test-result-heading' }
    });
    section.appendChild(Helpers.create_element('h2', {
        attributes: { id: 'ai-settings-test-result-heading' },
        text_content: t('ai_settings_test_result_heading')
    }));
    section.appendChild(Helpers.create_element('p', {
        class_name: 'ai-settings-test-section-intro',
        text_content: t('ai_settings_test_result_intro')
    }));

    const box = Helpers.create_element('div', {
        class_name: [
            'ai-settings-test-result',
            test_in_progress ? 'ai-settings-test-result--pending' : (result?.ok ? 'ai-settings-test-result--ok' : 'ai-settings-test-result--error')
        ],
        attributes: {
            'aria-live': 'polite',
            'aria-atomic': 'true',
            role: 'status'
        }
    });
    if (test_in_progress) {
        box.textContent = t('ai_settings_testing');
        section.appendChild(box);
        plate.appendChild(section);
        return;
    }
    if (!result) return;
    box.appendChild(Helpers.create_element('p', {
        class_name: 'ai-settings-test-result-summary',
        text_content: result.ok ? t('ai_settings_test_ok') : t('ai_settings_test_failed')
    }));
    if (result.message) {
        box.appendChild(Helpers.create_element('p', {
            class_name: 'ai-settings-test-result-message',
            text_content: result.message
        }));
    }
    if (result.model_available === false) {
        box.appendChild(Helpers.create_element('p', {
            class_name: 'ai-settings-test-result-message',
            text_content: t('ai_settings_model_not_found')
        }));
    }
    if (Array.isArray(result.models) && result.models.length > 0) {
        const list = Helpers.create_element('ul', { class_name: 'ai-settings-model-list' });
        result.models.slice(0, 15).forEach((name: string) => {
            list.appendChild(Helpers.create_element('li', { text_content: name }));
        });
        box.appendChild(list);
    }
    section.appendChild(box);
    plate.appendChild(section);
}

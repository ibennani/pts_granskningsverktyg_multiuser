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

export function merge_model_names(discovered_models: string[], saved_model: string): string[] {
    const names = new Set<string>();
    discovered_models.forEach((name) => {
        if (name) names.add(name);
    });
    if (saved_model) names.add(saved_model);
    return [...names].sort((a, b) => a.localeCompare(b, 'sv'));
}

/** Sorterad unik modellista från anslutningstest. */
export function normalize_discovered_models(models: string[]): string[] {
    const names = new Set<string>();
    models.forEach((name) => {
        if (name) names.add(name);
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'sv'));
}

/** Uppdaterar modellista och val efter lyckat anslutningstest. */
export function resolve_model_selection_after_discovery(
    discovered_models: string[],
    current_selection: string
): { discovered_models: string[]; selected_model: string } {
    const models = normalize_discovered_models(discovered_models);
    if (current_selection && models.includes(current_selection)) {
        return { discovered_models: models, selected_model: current_selection };
    }
    if (models.length === 1) {
        return { discovered_models: models, selected_model: models[0] };
    }
    return { discovered_models: models, selected_model: '' };
}

export function populate_model_select(
    Helpers: { create_element: CreateElementFn },
    select: HTMLSelectElement,
    models: string[],
    selected_model: string,
    t: (key: string) => string
) {
    select.replaceChildren();
    if (models.length === 0) {
        select.appendChild(Helpers.create_element('option', {
            attributes: { value: '' },
            text_content: t('ai_settings_model_empty_option')
        }));
        return;
    }
    if (!selected_model || !models.includes(selected_model)) {
        select.appendChild(Helpers.create_element('option', {
            attributes: { value: '' },
            text_content: t('ai_settings_model_choose_option')
        }));
    }
    models.forEach((name) => {
        const opt = Helpers.create_element('option', {
            attributes: { value: name },
            text_content: name
        }) as HTMLOptionElement;
        if (name === selected_model) opt.selected = true;
        select.appendChild(opt);
    });
}

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

/** Kort statustext bredvid testknappen (aria-live). */
export function get_connection_test_status_text(
    t: (key: string) => string,
    test_in_progress: boolean,
    result: LlmTestResult | null
): string {
    if (test_in_progress) return t('ai_settings_testing');
    if (!result) return '';
    if (result.ok) return t('ai_settings_test_connection_ok');
    return t('ai_settings_test_connection_failed');
}

/**
 * Admin-vy för konfiguration av LLM-anslutning (Ollama m.fl.).
 */

import { get_llm_settings, test_llm_connection, update_llm_settings } from '../api/client.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import {
    AI_SETTINGS_DEFAULTS,
    append_labeled_field,
    type AiSettingsData,
    type LlmTestResult,
    render_ai_settings_test_result
} from './ai_settings_view_helpers.ts';
import './ai_settings_view_component.css';

export class AiSettingsViewComponent {
    CSS_PATH = './ai_settings_view_component.css';
    root: HTMLElement | null = null;
    deps: any = null;
    router: any = null;
    Helpers: any = null;
    Translation: any = null;
    NotificationComponent: any = null;
    settings: AiSettingsData | null = null;
    _save_in_progress = false;
    _test_in_progress = false;
    _test_result: LlmTestResult | null = null;
    provider_select_ref: HTMLSelectElement | null = null;
    base_url_input_ref: HTMLInputElement | null = null;
    model_input_ref: HTMLInputElement | null = null;
    api_key_input_ref: HTMLInputElement | null = null;
    timeout_input_ref: HTMLInputElement | null = null;
    enabled_checkbox_ref: HTMLInputElement | null = null;

    async init({ root, deps }: { root: HTMLElement; deps: any }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this.NotificationComponent = deps.NotificationComponent;
        this.settings = null;
        this._save_in_progress = false;
        this._test_in_progress = false;
        this._test_result = null;

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
        this._handle_save = this._handle_save.bind(this);
        this._handle_test = this._handle_test.bind(this);
        this._handle_back = this._handle_back.bind(this);
    }

    destroy() {
        this.root = null;
        this.deps = null;
        this.router = null;
    }

    get_t() {
        return this.Translation?.t ? this.Translation.t.bind(this.Translation) : (k: string) => k;
    }

    async _load_settings() {
        try {
            this.settings = await get_llm_settings();
        } catch {
            this.settings = { ...AI_SETTINGS_DEFAULTS };
        }
    }

    _read_form_values() {
        return {
            provider: this.provider_select_ref?.value || 'ollama',
            base_url: this.base_url_input_ref?.value?.trim() || '',
            model: this.model_input_ref?.value?.trim() || '',
            enabled: this.enabled_checkbox_ref?.checked === true,
            timeout_ms: parseInt(this.timeout_input_ref?.value ?? '60000', 10),
            api_key: this.api_key_input_ref?.value?.trim() || ''
        };
    }

    _handle_back() {
        if (typeof this.router === 'function') {
            this.router('start', {});
        }
    }

    _show_message(message: string, type: string) {
        const nc = this.NotificationComponent || app_runtime_refs.notification_component;
        if (nc?.show_global_message) nc.show_global_message(message, type);
    }

    async _handle_test() {
        const t = this.get_t();
        if (this._test_in_progress) return;
        this._test_in_progress = true;
        this._test_result = null;
        if (this.root) await this.render();
        const form = this._read_form_values();
        try {
            this._test_result = await test_llm_connection({
                provider: form.provider,
                base_url: form.base_url,
                model: form.model,
                timeout_ms: form.timeout_ms,
                api_key: form.api_key || undefined
            });
        } catch (err: unknown) {
            this._test_result = {
                ok: false,
                status: 'error',
                message: (err instanceof Error ? err.message : null) || t('ai_settings_test_error'),
                models: [],
                model_available: null
            };
        } finally {
            this._test_in_progress = false;
            if (this.root) await this.render();
        }
    }

    async _handle_save() {
        const t = this.get_t();
        if (this._save_in_progress) return;
        const form = this._read_form_values();
        if (!form.base_url || !form.model) {
            this._show_message(t('ai_settings_required_fields'), 'warning');
            return;
        }
        this._save_in_progress = true;
        if (this.root) await this.render();
        const body: Record<string, unknown> = {
            provider: form.provider,
            base_url: form.base_url,
            model: form.model,
            enabled: form.enabled,
            timeout_ms: form.timeout_ms
        };
        if (form.api_key) body.api_key = form.api_key;
        try {
            this.settings = await update_llm_settings(body);
            this._show_message(t('ai_settings_saved_ok'), 'success');
            if (this.api_key_input_ref) this.api_key_input_ref.value = '';
        } catch (err: unknown) {
            this._show_message((err instanceof Error ? err.message : null) || t('ai_settings_save_error'), 'error');
        } finally {
            this._save_in_progress = false;
            if (this.root) await this.render();
        }
    }

    async render() {
        if (!this.root || !this.Helpers?.create_element) return;
        const t = this.get_t();
        if (!this.settings) await this._load_settings();
        const s: AiSettingsData = this.settings || AI_SETTINGS_DEFAULTS;

        this.root.innerHTML = '';
        const plate = this.Helpers.create_element('div', { class_name: 'content-plate ai-settings-plate' });
        plate.appendChild(this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            text_content: t('ai_settings_view_title'),
            attributes: { tabindex: '-1' }
        }));
        plate.appendChild(this.Helpers.create_element('p', {
            class_name: 'ai-settings-intro',
            text_content: t('ai_settings_view_intro')
        }));

        const form = this.Helpers.create_element('div', { class_name: 'ai-settings-form' });
        form.appendChild(this.Helpers.create_element('h2', { text_content: t('ai_settings_connection_heading') }));

        const provider_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        this.provider_select_ref = this.Helpers.create_element('select', {
            attributes: { id: 'ai-settings-provider' },
            class_name: 'form-control'
        });
        [{ value: 'ollama', label: t('ai_settings_provider_ollama') }].forEach((opt_data) => {
            const opt = this.Helpers.create_element('option', {
                attributes: { value: opt_data.value },
                text_content: opt_data.label
            });
            if (opt_data.value === s.provider) opt.selected = true;
            if (this.provider_select_ref) this.provider_select_ref.appendChild(opt);
        });
        append_labeled_field(this.Helpers, provider_group, {
            label_for: 'ai-settings-provider',
            label_text: t('ai_settings_provider_label'),
            control: this.provider_select_ref
        });
        form.appendChild(provider_group);

        const url_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        this.base_url_input_ref = this.Helpers.create_element('input', {
            attributes: {
                type: 'url',
                id: 'ai-settings-base-url',
                value: s.base_url || AI_SETTINGS_DEFAULTS.base_url,
                'aria-describedby': 'ai-settings-base-url-help'
            },
            class_name: ['form-control', 'form-control--wide']
        });
        append_labeled_field(this.Helpers, url_group, {
            label_for: 'ai-settings-base-url',
            label_text: t('ai_settings_base_url_label'),
            help_id: 'ai-settings-base-url-help',
            help_text: t('ai_settings_base_url_help'),
            control: this.base_url_input_ref
        });
        form.appendChild(url_group);

        const model_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        this.model_input_ref = this.Helpers.create_element('input', {
            attributes: {
                type: 'text',
                id: 'ai-settings-model',
                value: s.model || '',
                'aria-describedby': 'ai-settings-model-help'
            },
            class_name: 'form-control'
        });
        append_labeled_field(this.Helpers, model_group, {
            label_for: 'ai-settings-model',
            label_text: t('ai_settings_model_label'),
            help_id: 'ai-settings-model-help',
            help_text: t('ai_settings_model_help'),
            control: this.model_input_ref
        });
        form.appendChild(model_group);

        const key_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        this.api_key_input_ref = this.Helpers.create_element('input', {
            attributes: {
                type: 'password',
                id: 'ai-settings-api-key',
                autocomplete: 'off',
                'aria-describedby': 'ai-settings-api-key-help'
            },
            class_name: 'form-control'
        });
        const key_help = s.api_key_configured
            ? t('ai_settings_api_key_configured', { masked: s.api_key_masked || '****' })
            : t('ai_settings_api_key_help');
        append_labeled_field(this.Helpers, key_group, {
            label_for: 'ai-settings-api-key',
            label_text: t('ai_settings_api_key_label'),
            help_id: 'ai-settings-api-key-help',
            help_text: key_help,
            control: this.api_key_input_ref
        });
        form.appendChild(key_group);

        const timeout_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        this.timeout_input_ref = this.Helpers.create_element('input', {
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
        });
        append_labeled_field(this.Helpers, timeout_group, {
            label_for: 'ai-settings-timeout',
            label_text: t('ai_settings_timeout_label'),
            help_id: 'ai-settings-timeout-help',
            help_text: t('ai_settings_timeout_help'),
            control: this.timeout_input_ref
        });
        form.appendChild(timeout_group);

        const enabled_row = this.Helpers.create_element('div', { class_name: 'ai-settings-enabled-row' });
        this.enabled_checkbox_ref = this.Helpers.create_element('input', {
            attributes: {
                type: 'checkbox',
                id: 'ai-settings-enabled'
            }
        }) as HTMLInputElement;
        this.enabled_checkbox_ref.checked = s.enabled === true;
        enabled_row.appendChild(this.enabled_checkbox_ref);
        enabled_row.appendChild(this.Helpers.create_element('label', {
            class_name: 'form-field-label',
            text_content: t('ai_settings_enabled_label'),
            attributes: { for: 'ai-settings-enabled' }
        }));
        form.appendChild(enabled_row);

        const btn_row = this.Helpers.create_element('div', { class_name: 'ai-settings-buttons' });
        const test_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary'],
            text_content: this._test_in_progress ? t('ai_settings_testing') : t('ai_settings_test'),
            attributes: { type: 'button' }
        });
        test_btn.addEventListener('click', this._handle_test);
        const save_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            text_content: this._save_in_progress ? t('ai_settings_saving') : t('ai_settings_save'),
            attributes: { type: 'button' }
        });
        save_btn.addEventListener('click', this._handle_save);
        const back_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary'],
            text_content: t('ai_settings_back_without_save'),
            attributes: { type: 'button' }
        });
        back_btn.addEventListener('click', this._handle_back);
        btn_row.appendChild(test_btn);
        btn_row.appendChild(save_btn);
        btn_row.appendChild(back_btn);
        form.appendChild(btn_row);

        plate.appendChild(form);
        render_ai_settings_test_result(this.Helpers, plate, t, this._test_in_progress, this._test_result);
        this.root.appendChild(plate);
    }
}

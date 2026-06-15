/**
 * Admin-vy för konfiguration av LLM-anslutning (Ollama m.fl.).
 */

import { get_llm_settings, test_llm_connection, update_llm_settings } from '../api/client.js';
import { invalidate_llm_availability_cache, refresh_llm_availability } from '../logic/llm_availability.ts';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import {
    AI_SETTINGS_DEFAULTS,
    type AiSettingsData,
    type LlmTestResult,
    merge_model_names,
    resolve_model_selection_after_discovery
} from './ai_settings_view_helpers.ts';
import { render_ai_settings_form_section } from './ai_settings_form_section.ts';
import {
    AI_SETTINGS_DRAFT_DEBOUNCE_MS,
    clear_ai_settings_draft,
    read_ai_settings_draft,
    write_ai_settings_draft,
    type AiSettingsDraft
} from './ai_settings_draft.ts';
import {
    apply_ai_settings_draft_to_view,
    capture_ai_settings_focus,
    merge_ai_settings_for_render,
    resolve_enabled_from_saved_and_draft,
    restore_ai_settings_focus
} from './ai_settings_view_state.ts';
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
    _initial_load_done = false;
    _session_draft: AiSettingsDraft | null = null;
    _draft_timer: ReturnType<typeof setTimeout> | null = null;
    _save_in_progress = false;
    _test_in_progress = false;
    _test_result: LlmTestResult | null = null;
    _discovered_models: string[] = [];
    _selected_model = '';
    _enabled_ui: boolean | null = null;
    provider_select_ref: HTMLSelectElement | null = null;
    base_url_input_ref: HTMLInputElement | null = null;
    model_select_ref: HTMLSelectElement | null = null;
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
        this._reset_view_state();

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
        this._handle_save = this._handle_save.bind(this);
        this._handle_test = this._handle_test.bind(this);
        this._handle_back = this._handle_back.bind(this);
        this._handle_enabled_change = this._handle_enabled_change.bind(this);
        this._handle_connection_fields_change = this._handle_connection_fields_change.bind(this);
        this._handle_form_input = this._handle_form_input.bind(this);
    }

    _reset_view_state() {
        this.settings = null;
        this._initial_load_done = false;
        this._session_draft = null;
        this._clear_draft_timer();
        this._save_in_progress = false;
        this._test_in_progress = false;
        this._test_result = null;
        this._discovered_models = [];
        this._selected_model = '';
        this._enabled_ui = null;
    }

    destroy() {
        this._persist_draft_now();
        this._clear_draft_timer();
        this.root = null;
        this.deps = null;
        this.router = null;
    }

    get_t() {
        return this.Translation?.t ? this.Translation.t.bind(this.Translation) : (k: string) => k;
    }

    _clear_draft_timer() {
        if (this._draft_timer) {
            clearTimeout(this._draft_timer);
            this._draft_timer = null;
        }
    }

    _get_saved_settings(): AiSettingsData {
        return this.settings || AI_SETTINGS_DEFAULTS;
    }

    _get_enabled_ui(saved: AiSettingsData): boolean {
        return resolve_enabled_from_saved_and_draft(saved, this._session_draft, this._enabled_ui);
    }

    _get_render_settings(saved: AiSettingsData): AiSettingsData {
        return merge_ai_settings_for_render(saved, this._session_draft);
    }

    async _ensure_initial_load() {
        if (this._initial_load_done) return;
        try {
            this.settings = await get_llm_settings();
        } catch {
            this.settings = { ...AI_SETTINGS_DEFAULTS };
        }
        this._session_draft = read_ai_settings_draft();
        if (this._session_draft) {
            apply_ai_settings_draft_to_view(this._session_draft, this);
        } else {
            this._apply_saved_connection_state();
        }
        this._initial_load_done = true;
    }

    _apply_saved_connection_state() {
        const s = this.settings;
        if (!s?.base_url || !s.model) return;
        this._discovered_models = merge_model_names([], s.model);
        this._selected_model = s.model;
        this._test_result = {
            ok: true,
            status: 'ok',
            message: '',
            models: this._discovered_models,
            model_available: true
        };
    }

    _connection_test_passed(): boolean {
        return this._test_result?.ok === true;
    }

    _schedule_draft_persist() {
        this._clear_draft_timer();
        this._draft_timer = setTimeout(() => {
            this._draft_timer = null;
            this._persist_draft_now();
        }, AI_SETTINGS_DRAFT_DEBOUNCE_MS);
    }

    _persist_draft_now() {
        if (!this.root) return;
        const saved = this._get_saved_settings();
        const form = this._read_form_values(saved);
        const draft: AiSettingsDraft = {
            schemaVersion: 1,
            updatedAt: Date.now(),
            enabled: this._get_enabled_ui(saved),
            provider: form.provider,
            base_url: form.base_url,
            model: form.model,
            timeout_ms: form.timeout_ms,
            discovered_models: [...this._discovered_models],
            selected_model: this._selected_model,
            test_result: this._test_result
        };
        this._session_draft = draft;
        write_ai_settings_draft(draft);
    }

    _handle_form_input() {
        this._schedule_draft_persist();
    }

    async _handle_connection_fields_change() {
        if (!this._test_result && this._discovered_models.length === 0) {
            this._schedule_draft_persist();
            return;
        }
        this._test_result = null;
        this._discovered_models = [];
        this._selected_model = '';
        this._schedule_draft_persist();
        await this._render_preserving_focus();
    }

    _read_form_values(settings: AiSettingsData) {
        const enabled = this._get_enabled_ui(settings);
        if (!enabled) {
            return {
                provider: settings.provider,
                base_url: settings.base_url,
                model: settings.model,
                enabled: false,
                timeout_ms: settings.timeout_ms,
                api_key: ''
            };
        }
        return {
            provider: this.provider_select_ref?.value || settings.provider || 'ollama',
            base_url: this.base_url_input_ref?.value?.trim() || settings.base_url || '',
            model: this.model_select_ref?.value?.trim() || settings.model || '',
            enabled: true,
            timeout_ms: this.timeout_input_ref
                ? parseInt(this.timeout_input_ref.value ?? '60000', 10)
                : (settings.timeout_ms ?? AI_SETTINGS_DEFAULTS.timeout_ms),
            api_key: this.api_key_input_ref?.value?.trim() || ''
        };
    }

    _handle_back() {
        clear_ai_settings_draft();
        this._session_draft = null;
        if (typeof this.router === 'function') {
            this.router('start', {});
        }
    }

    _show_message(message: string, type: string) {
        const nc = this.NotificationComponent || app_runtime_refs.notification_component;
        if (nc?.show_global_message) nc.show_global_message(message, type);
    }

    async _handle_enabled_change() {
        this._enabled_ui = this.enabled_checkbox_ref?.checked === true;
        this._persist_draft_now();
        await this._render_preserving_focus();
    }

    async _handle_test() {
        const t = this.get_t();
        if (this._test_in_progress) return;
        const saved = this._get_saved_settings();
        const form = this._read_form_values(saved);
        if (!form.base_url) {
            this._show_message(t('ai_settings_test_requires_url'), 'warning');
            return;
        }
        this._selected_model = form.model || this._selected_model;
        this._test_in_progress = true;
        if (!this._connection_test_passed()) {
            this._test_result = null;
        }
        await this._render_preserving_focus();
        const timeout_ms = this.timeout_input_ref
            ? parseInt(this.timeout_input_ref.value ?? '60000', 10)
            : (saved.timeout_ms ?? AI_SETTINGS_DEFAULTS.timeout_ms);
        try {
            this._test_result = await test_llm_connection({
                provider: form.provider,
                base_url: form.base_url,
                model: '',
                timeout_ms,
                api_key: form.api_key || undefined
            });
            if (this._test_result.ok && this._test_result.models.length > 0) {
                const resolved = resolve_model_selection_after_discovery(
                    this._test_result.models,
                    this._selected_model
                );
                this._discovered_models = resolved.discovered_models;
                this._selected_model = resolved.selected_model;
            } else if (!this._test_result.ok) {
                this._discovered_models = [];
                this._selected_model = '';
            }
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
            this._persist_draft_now();
            await this._render_preserving_focus();
        }
    }

    async _handle_save() {
        const t = this.get_t();
        if (this._save_in_progress) return;
        const saved = this._get_saved_settings();
        const form = this._read_form_values(saved);
        if (form.enabled) {
            if (!form.base_url) {
                this._show_message(t('ai_settings_required_fields'), 'warning');
                return;
            }
            if (!form.model) {
                this._show_message(t('ai_settings_model_required'), 'warning');
                return;
            }
        }
        this._save_in_progress = true;
        await this._render_preserving_focus();
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
            clear_ai_settings_draft();
            this._session_draft = null;
            this._enabled_ui = null;
            this._test_result = null;
            this._discovered_models = [];
            this._selected_model = '';
            if (this.settings.enabled === true) {
                this._apply_saved_connection_state();
            }
            invalidate_llm_availability_cache();
            void refresh_llm_availability(true);
            this._show_message(t('ai_settings_saved_ok'), 'success');
        } catch (err: unknown) {
            this._show_message((err instanceof Error ? err.message : null) || t('ai_settings_save_error'), 'error');
        } finally {
            this._save_in_progress = false;
            await this._render_preserving_focus();
        }
    }

    _append_enabled_toggle(plate: HTMLElement, settings: AiSettingsData, t: (key: string) => string) {
        const enabled_row = this.Helpers.create_element('div', { class_name: 'ai-settings-enabled-row' });
        this.enabled_checkbox_ref = this.Helpers.create_element('input', {
            attributes: {
                type: 'checkbox',
                id: 'ai-settings-enabled',
                'data-draft-ignore': 'true'
            }
        }) as HTMLInputElement;
        this.enabled_checkbox_ref.checked = this._get_enabled_ui(settings);
        this.enabled_checkbox_ref.addEventListener('change', this._handle_enabled_change);
        enabled_row.appendChild(this.enabled_checkbox_ref);
        enabled_row.appendChild(this.Helpers.create_element('label', {
            class_name: 'form-field-label',
            text_content: t('ai_settings_enabled_label'),
            attributes: { for: 'ai-settings-enabled' }
        }));
        plate.appendChild(enabled_row);
    }

    _append_action_buttons(plate: HTMLElement, t: (key: string) => string) {
        const btn_row = this.Helpers.create_element('div', { class_name: 'ai-settings-buttons' });
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
        btn_row.appendChild(save_btn);
        btn_row.appendChild(back_btn);
        plate.appendChild(btn_row);
    }

    async _render_preserving_focus() {
        const focus_info = capture_ai_settings_focus(this.root);
        await this.render();
        restore_ai_settings_focus(this.root, focus_info);
    }

    async render() {
        if (!this.root || !this.Helpers?.create_element) return;
        const t = this.get_t();
        await this._ensure_initial_load();
        const saved = this._get_saved_settings();
        const display_settings = this._get_render_settings(saved);
        const ai_enabled = this._get_enabled_ui(saved);

        this.root.innerHTML = '';
        this.provider_select_ref = null;
        this.base_url_input_ref = null;
        this.model_select_ref = null;
        this.api_key_input_ref = null;
        this.timeout_input_ref = null;

        const plate = this.Helpers.create_element('div', {
            class_name: 'content-plate ai-settings-plate',
            attributes: { 'data-draft-ignore': 'true' }
        });
        plate.appendChild(this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            text_content: t('ai_settings_view_title'),
            attributes: { tabindex: '-1' }
        }));
        plate.appendChild(this.Helpers.create_element('p', {
            class_name: 'ai-settings-intro',
            text_content: t('ai_settings_view_intro')
        }));
        this._append_enabled_toggle(plate, saved, t);

        if (ai_enabled) {
            const connection_test_passed = this._connection_test_passed();
            render_ai_settings_form_section(plate, {
                Helpers: this.Helpers,
                refs: this,
                settings: display_settings,
                discovered_models: this._discovered_models,
                selected_model: this._selected_model,
                test_in_progress: this._test_in_progress,
                test_result: this._test_result,
                connection_test_passed,
                t,
                on_test_click: this._handle_test,
                on_model_change: (model) => {
                    this._selected_model = model;
                },
                on_connection_fields_change: this._handle_connection_fields_change,
                on_form_input: this._handle_form_input
            });
            if (connection_test_passed) {
                this._append_action_buttons(plate, t);
            }
        } else {
            this._append_action_buttons(plate, t);
        }
        this.root.appendChild(plate);
    }
}

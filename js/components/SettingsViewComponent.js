// js/components/SettingsViewComponent.js

import { get_current_user_preferences, update_current_user_preferences, change_my_password } from '../api/client.js';
import { get_current_user_name } from '../utils/helpers.js';
import './settings_view_component.css';

export class SettingsViewComponent {
    constructor() {
        this.CSS_PATH = './settings_view_component.css';
        this.root = null;
        this.deps = null;
        this.Translation = null;
        this.Helpers = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.language_select_ref = null;
        this.theme_select_ref = null;
        this.review_sort_select_ref = null;
        this.user_preferences = null;
        this.password_change_success = false;
        this.password_change_error = null;
        this.new_password_input_ref = null;
        this.new_password_confirm_input_ref = null;
        this.change_password_button_ref = null;
    }

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.language_select_ref = null;
        this.theme_select_ref = null;
        this.review_sort_select_ref = null;
        this.user_preferences = null;
        this.handle_language_change = this.handle_language_change.bind(this);
        this.handle_theme_change = this.handle_theme_change.bind(this);
        this.handle_review_sort_change = this.handle_review_sort_change.bind(this);
        this.handle_change_password_click = this.handle_change_password_click.bind(this);
        this.password_change_success = false;
        this.password_change_error = null;

        try {
            this.user_preferences = await get_current_user_preferences();
        } catch {
            this.user_preferences = null;
        }

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
    }

    async handle_language_change(event) {
        const lang = event.target?.value;
        if (lang && typeof this.Translation?.set_language === 'function') {
            this.user_preferences = this.user_preferences || {};
            this.user_preferences.language_preference = lang;
            await this.Translation.set_language(lang);
            try {
                await update_current_user_preferences({ language_preference: lang });
            } catch {
                /* ignorerar sparfel */
            }
        }
    }

    async handle_review_sort_change(event) {
        const value = event.target?.value;
        if (value === 'by_criteria' || value === 'by_sample') {
            try {
                await update_current_user_preferences({ review_sort_preference: value });
                if (this.dispatch && this.StoreActionTypes) {
                    const mode = value === 'by_criteria' ? 'requirement_samples' : 'sample_requirements';
                    this.dispatch({
                        type: this.StoreActionTypes.SET_REQUIREMENT_AUDIT_SIDEBAR_SETTINGS,
                        payload: { selectedMode: mode }
                    });
                }
            } catch {
                /* ignorerar sparfel */
            }
        }
    }

    async handle_theme_change(event) {
        const theme = event.target?.value;
        if (theme === 'system') {
            localStorage.removeItem('theme_preference');
            const prefers_dark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
            document.documentElement.setAttribute('data-theme', prefers_dark ? 'dark' : 'light');
            try {
                await update_current_user_preferences({ theme_preference: null });
            } catch {
                /* ignorerar sparfel */
            }
        } else if (theme === 'light' || theme === 'dark' || theme === 'alternative') {
            localStorage.setItem('theme_preference', theme);
            document.documentElement.setAttribute('data-theme', theme);
            try {
                await update_current_user_preferences({ theme_preference: theme });
            } catch {
                /* ignorerar sparfel */
            }
        }
    }

    async handle_change_password_click() {
        const t = this.Translation.t;
        const new_pw = (this.new_password_input_ref?.value || '').trim();
        const new_pw_confirm = (this.new_password_confirm_input_ref?.value || '').trim();
        this.password_change_error = null;
        if (new_pw.length < 8) {
            this.password_change_error = t('login_reset_password_too_short');
            this.render();
            return;
        }
        if (new_pw !== new_pw_confirm) {
            this.password_change_error = t('login_reset_password_mismatch');
            this.render();
            return;
        }
        try {
            await change_my_password(new_pw);
            this.password_change_success = true;
            this.password_change_error = null;
            this.render();
            requestAnimationFrame(() => {
                const heading = document.getElementById('settings-password-changed-heading');
                if (heading) {
                    heading.focus({ preventScroll: true });
                }
            });
        } catch (err) {
            this.password_change_error = err?.message || t('settings_password_error_generic');
            this.render();
        }
    }

    render() {
        if (!this.root || !this.Helpers?.create_element) return;

        const t = this.Translation.t;
        this.root.innerHTML = '';

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate settings-plate' });

        plate.appendChild(this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            text_content: t('menu_link_my_settings'),
            attributes: { tabindex: '-1' }
        }));

        const user_name = get_current_user_name();
        const greeting_text = user_name
            ? t('settings_greeting').replace('{name}', user_name)
            : t('settings_greeting_guest');
        plate.appendChild(this.Helpers.create_element('p', {
            class_name: 'settings-greeting',
            text_content: greeting_text
        }));

        plate.appendChild(this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('settings_intro')
        }));

        plate.appendChild(this.Helpers.create_element('h2', {
            text_content: t('settings_general_heading')
        }));

        const review_sort_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        review_sort_group.appendChild(this.Helpers.create_element('label', {
            attributes: { for: 'settings-review-sort-select' },
            text_content: t('settings_review_sort_label')
        }));
        this.review_sort_select_ref = this.Helpers.create_element('select', {
            id: 'settings-review-sort-select',
            class_name: 'form-control',
            attributes: { 'aria-label': t('settings_review_sort_label') }
        });
        const review_sort_pref = this.user_preferences?.review_sort_preference || 'by_criteria';
        this.review_sort_select_ref.appendChild(this.Helpers.create_element('option', {
            attributes: { value: 'by_criteria' },
            text_content: t('settings_review_sort_by_criteria')
        }));
        this.review_sort_select_ref.appendChild(this.Helpers.create_element('option', {
            attributes: { value: 'by_sample' },
            text_content: t('settings_review_sort_by_sample')
        }));
        this.review_sort_select_ref.value = review_sort_pref === 'by_criteria' ? 'by_criteria' : 'by_sample';
        this.review_sort_select_ref.addEventListener('change', this.handle_review_sort_change);
        review_sort_group.appendChild(this.review_sort_select_ref);
        plate.appendChild(review_sort_group);

        const lang_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        lang_group.appendChild(this.Helpers.create_element('label', {
            attributes: { for: 'settings-language-select' },
            text_content: t('settings_language_label')
        }));
        this.language_select_ref = this.Helpers.create_element('select', {
            id: 'settings-language-select',
            class_name: 'form-control',
            attributes: { 'aria-label': t('settings_language_label') }
        });
        const supported = this.Translation?.get_supported_languages?.() || {};
        for (const code in supported) {
            this.language_select_ref.appendChild(this.Helpers.create_element('option', {
                attributes: { value: code },
                text_content: supported[code]
            }));
        }
        const lang_pref = this.user_preferences?.language_preference || this.Translation?.get_current_language_code?.() || 'sv-SE';
        this.language_select_ref.value = lang_pref;
        this.language_select_ref.addEventListener('change', this.handle_language_change);
        lang_group.appendChild(this.language_select_ref);
        plate.appendChild(lang_group);

        const theme_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        theme_group.appendChild(this.Helpers.create_element('label', {
            attributes: { for: 'settings-theme-select' },
            text_content: t('settings_theme_label')
        }));
        this.theme_select_ref = this.Helpers.create_element('select', {
            id: 'settings-theme-select',
            class_name: 'form-control',
            attributes: { 'aria-label': t('settings_theme_label') }
        });
        const theme_pref = this.user_preferences?.theme_preference;
        const saved = theme_pref === 'light' || theme_pref === 'dark' || theme_pref === 'alternative' ? theme_pref : localStorage.getItem('theme_preference');
        const current_pref = (saved === 'light' || saved === 'dark' || saved === 'alternative') ? saved : 'system';
        const theme_options = [
            { value: 'light', label_key: 'light_mode' },
            { value: 'dark', label_key: 'dark_mode' },
            { value: 'alternative', label_key: 'settings_theme_alternative' },
            { value: 'system', label_key: 'settings_theme_system' }
        ];
        theme_options.forEach(({ value, label_key }) => {
            this.theme_select_ref.appendChild(this.Helpers.create_element('option', {
                attributes: { value },
                text_content: t(label_key)
            }));
        });
        this.theme_select_ref.value = current_pref === 'light' || current_pref === 'dark' || current_pref === 'alternative' ? current_pref : 'system';
        this.theme_select_ref.addEventListener('change', this.handle_theme_change);
        theme_group.appendChild(this.theme_select_ref);
        plate.appendChild(theme_group);

        const password_section = this.Helpers.create_element('div', { class_name: 'settings-password-section' });
        if (this.password_change_success) {
            const changed_heading = this.Helpers.create_element('h2', {
                id: 'settings-password-changed-heading',
                text_content: t('settings_password_changed_heading'),
                attributes: { tabindex: '-1' }
            });
            password_section.appendChild(changed_heading);
            password_section.appendChild(this.Helpers.create_element('p', {
                class_name: 'view-intro-text',
                text_content: t('settings_password_changed_intro')
            }));
        } else {
            password_section.appendChild(this.Helpers.create_element('h2', {
                text_content: t('settings_change_password_heading')
            }));
            password_section.appendChild(this.Helpers.create_element('p', {
                class_name: 'view-intro-text',
                text_content: t('settings_change_password_intro')
            }));
            const error_id = 'settings-password-error';
            if (this.password_change_error) {
                const error_el = this.Helpers.create_element('p', {
                    id: error_id,
                    class_name: 'settings-password-error',
                    text_content: this.password_change_error,
                    attributes: { role: 'alert', 'aria-live': 'polite' }
                });
                password_section.appendChild(error_el);
            }
            const new_group = this.Helpers.create_element('div', { class_name: 'form-group' });
            new_group.appendChild(this.Helpers.create_element('label', {
                attributes: { for: 'settings-new-password' },
                text_content: t('login_new_password_label')
            }));
            const new_input_attrs = { type: 'password', autocomplete: 'new-password' };
            if (this.password_change_error) {
                new_input_attrs['aria-describedby'] = error_id;
            }
            this.new_password_input_ref = this.Helpers.create_element('input', {
                id: 'settings-new-password',
                class_name: 'form-control',
                attributes: new_input_attrs
            });
            new_group.appendChild(this.new_password_input_ref);
            password_section.appendChild(new_group);
            const confirm_group = this.Helpers.create_element('div', { class_name: 'form-group' });
            confirm_group.appendChild(this.Helpers.create_element('label', {
                attributes: { for: 'settings-new-password-confirm' },
                text_content: t('login_new_password_confirm_label')
            }));
            this.new_password_confirm_input_ref = this.Helpers.create_element('input', {
                id: 'settings-new-password-confirm',
                class_name: 'form-control',
                attributes: { type: 'password', autocomplete: 'new-password' }
            });
            confirm_group.appendChild(this.new_password_confirm_input_ref);
            password_section.appendChild(confirm_group);
            const change_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                text_content: t('settings_change_password_button'),
                attributes: { type: 'button' }
            });
            change_btn.addEventListener('click', this.handle_change_password_click);
            this.change_password_button_ref = change_btn;
            password_section.appendChild(change_btn);
        }
        plate.appendChild(password_section);

        this.root.appendChild(plate);
    }

    destroy() {
        if (this.review_sort_select_ref) {
            this.review_sort_select_ref.removeEventListener('change', this.handle_review_sort_change);
        }
        if (this.language_select_ref) {
            this.language_select_ref.removeEventListener('change', this.handle_language_change);
        }
        if (this.theme_select_ref) {
            this.theme_select_ref.removeEventListener('change', this.handle_theme_change);
        }
        if (this.change_password_button_ref) {
            this.change_password_button_ref.removeEventListener('click', this.handle_change_password_click);
        }
        this.new_password_input_ref = null;
        this.new_password_confirm_input_ref = null;
        this.change_password_button_ref = null;
        this.root = null;
        this.deps = null;
    }
}

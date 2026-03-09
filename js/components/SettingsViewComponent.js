// js/components/SettingsViewComponent.js

import { get_current_user_preferences, update_current_user_preferences } from '../api/client.js';
import { get_current_user_name } from '../utils/helpers.js';
import './settings_view_component.css';

export const SettingsViewComponent = {
    CSS_PATH: './settings_view_component.css',

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

        try {
            this.user_preferences = await get_current_user_preferences();
        } catch {
            this.user_preferences = null;
        }

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
    },

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
    },

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
    },

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
        } else if (theme === 'light' || theme === 'dark') {
            localStorage.setItem('theme_preference', theme);
            document.documentElement.setAttribute('data-theme', theme);
            try {
                await update_current_user_preferences({ theme_preference: theme });
            } catch {
                /* ignorerar sparfel */
            }
        }
    },

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
        const saved = theme_pref === 'light' || theme_pref === 'dark' ? theme_pref : localStorage.getItem('theme_preference');
        const current_pref = (saved === 'light' || saved === 'dark') ? saved : 'system';
        const theme_options = [
            { value: 'light', label_key: 'light_mode' },
            { value: 'dark', label_key: 'dark_mode' },
            { value: 'system', label_key: 'settings_theme_system' }
        ];
        theme_options.forEach(({ value, label_key }) => {
            this.theme_select_ref.appendChild(this.Helpers.create_element('option', {
                attributes: { value },
                text_content: t(label_key)
            }));
        });
        this.theme_select_ref.value = current_pref === 'light' || current_pref === 'dark' ? current_pref : 'system';
        this.theme_select_ref.addEventListener('change', this.handle_theme_change);
        theme_group.appendChild(this.theme_select_ref);
        plate.appendChild(theme_group);

        this.root.appendChild(plate);
    },

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
        this.root = null;
        this.deps = null;
    }
};

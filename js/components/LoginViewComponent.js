// js/components/LoginViewComponent.js

import { login, set_auth_token, get_current_user_preferences, reset_password_with_code } from '../api/client.js';
import './login_view_component.css';

export const LoginViewComponent = {
    CSS_PATH: './login_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.on_login_callback = deps.params?.on_login;
        this.mode = 'login';
        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
    },

    render() {
        if (!this.root || !this.Translation || !this.Helpers) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate login-plate' });

        plate.appendChild(this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            text_content: t('login_title'),
            attributes: { tabindex: '-1' }
        }));

        const label_name = this.Helpers.create_element('label', {
            attributes: { for: 'login-user-input' },
            text_content: t('login_who_are_you')
        });
        plate.appendChild(label_name);

        const name_input = this.Helpers.create_element('input', {
            id: 'login-user-input',
            type: 'text',
            class_name: 'form-control',
            attributes: {
                'aria-label': t('login_who_are_you'),
                autocomplete: 'username'
            }
        });
        plate.appendChild(name_input);

        const label_password = this.Helpers.create_element('label', {
            attributes: { for: 'login-password-input' },
            text_content: t('login_password_label')
        });
        plate.appendChild(label_password);

        const password_input = this.Helpers.create_element('input', {
            id: 'login-password-input',
            type: 'password',
            class_name: 'form-control',
            attributes: {
                'aria-label': t('login_password_label'),
                autocomplete: 'current-password'
            }
        });
        plate.appendChild(password_input);

        const login_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            text_content: t('login_button'),
            attributes: { type: 'button' }
        });

        const forgot_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary'],
            text_content: t('login_forgot_link'),
            attributes: { type: 'button' }
        });

        const reset_label_code = this.Helpers.create_element('label', {
            attributes: { for: 'login-reset-code-input' },
            text_content: t('login_reset_code_label')
        });
        const reset_code_input = this.Helpers.create_element('input', {
            id: 'login-reset-code-input',
            type: 'text',
            class_name: 'form-control',
            attributes: {
                'aria-label': t('login_reset_code_label')
            }
        });

        const reset_label_password = this.Helpers.create_element('label', {
            attributes: { for: 'login-reset-password-input' },
            text_content: t('login_new_password_label')
        });
        const reset_password_input = this.Helpers.create_element('input', {
            id: 'login-reset-password-input',
            type: 'password',
            class_name: 'form-control',
            attributes: {
                'aria-label': t('login_new_password_label'),
                autocomplete: 'new-password'
            }
        });

        const reset_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            text_content: t('login_reset_button'),
            attributes: { type: 'button' }
        });

        const mode_container = this.Helpers.create_element('div', {
            class_name: 'login-mode-container'
        });

        const render_mode = () => {
            mode_container.innerHTML = '';
            if (this.mode === 'login') {
                mode_container.appendChild(login_btn);
                mode_container.appendChild(forgot_btn);
            } else {
                mode_container.appendChild(this.Helpers.create_element('p', {
                    class_name: 'view-intro-text',
                    text_content: t('login_reset_intro')
                }));
                mode_container.appendChild(reset_label_code);
                mode_container.appendChild(reset_code_input);
                mode_container.appendChild(reset_label_password);
                mode_container.appendChild(reset_password_input);
                mode_container.appendChild(reset_btn);
            }
        };

        login_btn.addEventListener('click', async () => {
            const username = (name_input.value || '').trim();
            const password = password_input.value || '';
            if (!username) {
                this.NotificationComponent?.show_global_message?.(t('login_select_first'), 'warning');
                return;
            }
            if (!password) {
                this.NotificationComponent?.show_global_message?.(t('login_password_required'), 'warning');
                return;
            }
            try {
                const data = await login(username, password);
                set_auth_token(data.token);
                const user = await get_current_user_preferences();
                const user_name = user?.name || username;
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('gv_current_user_name', user_name);
                }
                window.__GV_CURRENT_USER_NAME__ = user_name;
                if (typeof this.on_login_callback === 'function') {
                    this.on_login_callback();
                }
            } catch (err) {
                const msg = err?.message || (err?.status === 401 ? 'Fel användarnamn eller lösenord' : 'Inloggning misslyckades');
                this.NotificationComponent?.show_global_message?.(msg, 'error');
            }
        });

        forgot_btn.addEventListener('click', () => {
            this.mode = 'reset';
            render_mode();
        });

        reset_btn.addEventListener('click', async () => {
            const code = (reset_code_input.value || '').trim();
            const new_password = (reset_password_input.value || '').trim();
            if (!code) {
                this.NotificationComponent?.show_global_message?.(t('login_reset_code_required'), 'warning');
                return;
            }
            if (!new_password || new_password.length < 8) {
                this.NotificationComponent?.show_global_message?.(t('login_reset_password_too_short'), 'warning');
                return;
            }
            try {
                const data = await reset_password_with_code(code, new_password);
                set_auth_token(data.token);
                const user = await get_current_user_preferences();
                const user_name = user?.name || '';
                if (user_name && typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('gv_current_user_name', user_name);
                }
                if (user_name) {
                    window.__GV_CURRENT_USER_NAME__ = user_name;
                }
                this.NotificationComponent?.show_global_message?.(t('login_reset_success'), 'success');
                if (typeof this.on_login_callback === 'function') {
                    this.on_login_callback();
                }
            } catch (err) {
                const msg = err?.message || 'Återställning av lösenord misslyckades';
                this.NotificationComponent?.show_global_message?.(msg, 'error');
            }
        });

        plate.appendChild(mode_container);
        render_mode();

        this.root.appendChild(plate);
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.on_login_callback = null;
        this.root = null;
        this.deps = null;
    }
};

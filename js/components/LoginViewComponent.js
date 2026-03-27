// js/components/LoginViewComponent.js

import { login, set_auth_token, set_current_user_admin, get_current_user_preferences, reset_password_with_code, get_admin_contacts } from '../api/client.js';
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
        this.login_error_message = '';
        this.reset_error_message = '';
        this._should_focus_error = false;
        this._last_error_mode = null;
        this.admin_contacts = [];
        this._admin_contacts_loaded = false;
        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
    },

    render() {
        if (!this.root || !this.Translation || !this.Helpers) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate login-plate' });

        const welcome_heading = this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            class_name: 'login-welcome-heading',
            text_content: t('login_welcome_heading'),
            attributes: { tabindex: '-1' }
        });
        plate.appendChild(welcome_heading);

        const form_section_heading = this.Helpers.create_element('h2', {
            class_name: 'login-form-section-heading',
            text_content: t('login_title')
        });
        plate.appendChild(form_section_heading);

        const error_message = this.mode === 'login' ? this.login_error_message : this.reset_error_message;
        let error_block = null;
        if (error_message) {
            error_block = this.Helpers.create_element('p', {
                class_name: 'login-inline-error',
                text_content: error_message,
                attributes: { tabindex: '-1', id: 'login-inline-error' }
            });
            plate.appendChild(error_block);
        }

        const label_name = this.Helpers.create_element('label', {
            attributes: { for: 'login-user-input' },
            text_content: t('login_who_are_you')
        });

        const name_input = this.Helpers.create_element('input', {
            id: 'login-user-input',
            class_name: 'form-control',
            attributes: { type: 'text', autocomplete: 'username' }
        });

        const label_password = this.Helpers.create_element('label', {
            attributes: { for: 'login-password-input' },
            text_content: t('login_password_label')
        });

        const password_input = this.Helpers.create_element('input', {
            id: 'login-password-input',
            class_name: 'form-control',
            attributes: { type: 'password', autocomplete: 'current-password' }
        });

        if (this.mode === 'login') {
            plate.appendChild(label_name);
            plate.appendChild(name_input);
            plate.appendChild(label_password);
            plate.appendChild(password_input);
        }

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

        const reset_code_label = this.Helpers.create_element('label', {
            attributes: { for: 'login-reset-code-input' },
            text_content: t('login_reset_code_label')
        });
        const reset_code_input = this.Helpers.create_element('input', {
            id: 'login-reset-code-input',
            class_name: 'form-control',
            attributes: { type: 'text' }
        });

        const reset_password_label = this.Helpers.create_element('label', {
            attributes: { for: 'login-reset-password-input' },
            text_content: t('login_new_password_label')
        });
        const reset_password_input = this.Helpers.create_element('input', {
            id: 'login-reset-password-input',
            class_name: 'form-control',
            attributes: { type: 'password', autocomplete: 'new-password' }
        });

        const reset_password_confirm_label = this.Helpers.create_element('label', {
            attributes: { for: 'login-reset-password-confirm-input' },
            text_content: t('login_new_password_confirm_label')
        });
        const reset_password_confirm_input = this.Helpers.create_element('input', {
            id: 'login-reset-password-confirm-input',
            class_name: 'form-control',
            attributes: { type: 'password', autocomplete: 'new-password' }
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
                const intro = this.Helpers.create_element('p', {
                    class_name: 'view-intro-text',
                    text_content: t('login_reset_intro')
                });
                mode_container.appendChild(intro);

                const contacts_wrapper = this.Helpers.create_element('div', {
                    class_name: 'login-reset-contacts'
                });

                if (Array.isArray(this.admin_contacts) && this.admin_contacts.length > 0) {
                    const contacts_intro = this.Helpers.create_element('p', {
                        text_content: t('login_reset_contacts_intro')
                    });
                    contacts_wrapper.appendChild(contacts_intro);
                    const list = this.Helpers.create_element('div', {
                        class_name: 'login-reset-contacts-list',
                        attributes: { role: 'list' }
                    });
                    this.admin_contacts.forEach((admin) => {
                        const item = this.Helpers.create_element('div', {
                            class_name: 'login-reset-contacts-item',
                            text_content: String(admin.name || '').trim(),
                            attributes: { role: 'listitem' }
                        });
                        list.appendChild(item);
                    });
                    contacts_wrapper.appendChild(list);
                } else if (this._admin_contacts_loaded) {
                    const fallback = this.Helpers.create_element('p', {
                        text_content: t('login_reset_contacts_fallback')
                    });
                    contacts_wrapper.appendChild(fallback);
                }
                mode_container.appendChild(contacts_wrapper);

                mode_container.appendChild(reset_code_label);
                mode_container.appendChild(reset_code_input);

                const password_group = this.Helpers.create_element('div', {
                    class_name: 'login-reset-password-group'
                });
                password_group.appendChild(reset_password_label);
                password_group.appendChild(reset_password_input);
                password_group.appendChild(reset_password_confirm_label);
                password_group.appendChild(reset_password_confirm_input);
                mode_container.appendChild(password_group);

                mode_container.appendChild(reset_btn);
            }
        };

        login_btn.addEventListener('click', async () => {
            const username = (name_input.value || '').trim();
            const password = password_input.value || '';
            if (!username) {
                this.login_error_message = t('login_select_first');
                this._should_focus_error = true;
                this._last_error_mode = 'login';
                this.render();
                return;
            }
            if (!password) {
                this.login_error_message = t('login_password_required');
                this._should_focus_error = true;
                this._last_error_mode = 'login';
                this.render();
                return;
            }
            this.login_error_message = '';
            try {
                const data = await login(username, password);
                set_auth_token(data.token);
                const user = await get_current_user_preferences();
                const user_name = user?.name || username;
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('gv_current_user_name', user_name);
                }
                set_current_user_admin(!!user?.is_admin);
                window.__GV_CURRENT_USER_NAME__ = user_name;
                if (typeof this.on_login_callback === 'function') {
                    this.on_login_callback();
                }
            } catch (err) {
                const msg = err?.message || (err?.status === 401 ? t('login_error_invalid_credentials') : t('login_error_generic'));
                this.login_error_message = msg;
                this._should_focus_error = true;
                this._last_error_mode = 'login';
                this.render();
            }
        });

        forgot_btn.addEventListener('click', async () => {
            this.mode = 'reset';
            this.reset_error_message = '';
            if (!this._admin_contacts_loaded) {
                try {
                    const { list } = await get_admin_contacts();
                    this.admin_contacts = Array.isArray(list)
                        ? list.filter((u) => u && (u.name || u.username))
                        : [];
                    this._admin_contacts_loaded = true;
                } catch {
                    this.admin_contacts = [];
                    this._admin_contacts_loaded = true;
                }
            }
            this.render();
        });

        reset_btn.addEventListener('click', async () => {
            const code = (reset_code_input.value || '').trim();
            const new_password = (reset_password_input.value || '').trim();
            const new_password_confirm = (reset_password_confirm_input.value || '').trim();

            if (!code) {
                this.reset_error_message = t('login_reset_code_required');
                this._should_focus_error = true;
                this._last_error_mode = 'reset';
                this.render();
                return;
            }
            if (!new_password || new_password.length < 8) {
                this.reset_error_message = t('login_reset_password_too_short');
                this._should_focus_error = true;
                this._last_error_mode = 'reset';
                this.render();
                return;
            }
            if (new_password !== new_password_confirm) {
                this.reset_error_message = t('login_reset_password_mismatch');
                this._should_focus_error = true;
                this._last_error_mode = 'reset';
                this.render();
                return;
            }

            this.reset_error_message = '';
            this._should_focus_error = false;
            try {
                const data = await reset_password_with_code(code, new_password);
                set_auth_token(data.token);
                const user = await get_current_user_preferences();
                const user_name = user?.name || '';
                if (user_name && typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('gv_current_user_name', user_name);
                }
                set_current_user_admin(!!user?.is_admin);
                if (user_name) {
                    window.__GV_CURRENT_USER_NAME__ = user_name;
                }
                this.NotificationComponent?.show_global_message?.(t('login_reset_success'), 'success');
                if (typeof this.on_login_callback === 'function') {
                    this.on_login_callback();
                }
            } catch (err) {
                const msg = err?.message || t('login_reset_error_generic');
                this.reset_error_message = msg;
                this._should_focus_error = true;
                this._last_error_mode = 'reset';
                this.render();
            }
        });

        plate.appendChild(mode_container);
        render_mode();

        this.root.appendChild(plate);

        if (this._should_focus_error && error_block && this._last_error_mode === this.mode) {
            this._should_focus_error = false;
            this._last_error_mode = null;
            try {
                error_block.focus({ preventScroll: true });
            } catch (e) {
                error_block.focus();
            }
        }
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.on_login_callback = null;
        this.root = null;
        this.deps = null;
    }
};

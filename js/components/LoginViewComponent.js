// js/components/LoginViewComponent.js

import { get_users } from '../api/client.js';

export const LoginViewComponent = {
    CSS_PATH: 'css/components/login_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.on_login_callback = deps.params?.on_login;
        this.users = [];
        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
    },

    async ensure_users() {
        if (this.users.length > 0) return;
        try {
            this.users = await get_users();
        } catch (err) {
            this.NotificationComponent?.show_global_message?.(
                (this.Translation?.t?.('login_fetch_users_error')) || 'Kunde inte hämta användare.',
                'error'
            );
        }
    },

    render() {
        if (!this.root || !this.Translation || !this.Helpers) return;
        this.ensure_users().then(() => this._render_ui());
    },

    _render_ui() {
        if (!this.root) return;

        const t = this.Translation.t;
        this.root.innerHTML = '';

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate login-plate' });

        plate.appendChild(this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            text_content: t('login_title'),
            attributes: { tabindex: '-1' }
        }));

        const label = this.Helpers.create_element('label', {
            attributes: { for: 'login-user-select' },
            text_content: t('login_who_are_you')
        });
        plate.appendChild(label);

        const users = this.users;

        const select = this.Helpers.create_element('select', {
            id: 'login-user-select',
            class_name: 'form-control',
            attributes: {
                'aria-label': t('login_who_are_you')
            }
        });

        const empty_option = this.Helpers.create_element('option', {
            text_content: t('login_select_placeholder'),
            attributes: { value: '' }
        });
        select.appendChild(empty_option);

        users.forEach((u) => {
            const opt = this.Helpers.create_element('option', {
                text_content: u.name || `Användare ${u.id}`,
                attributes: { value: u.name || '' }
            });
            select.appendChild(opt);
        });

        plate.appendChild(select);

        const login_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            text_content: t('login_button'),
            attributes: { type: 'button' }
        });
        login_btn.addEventListener('click', () => {
            const name = (select.value || '').trim();
            if (!name) {
                this.NotificationComponent?.show_global_message?.(t('login_select_first'), 'warning');
                return;
            }
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('gv_current_user_name', name);
            }
            window.__GV_CURRENT_USER_NAME__ = name;
            if (typeof this.on_login_callback === 'function') {
                this.on_login_callback();
            }
        });

        plate.appendChild(login_btn);
        this.root.appendChild(plate);
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.on_login_callback = null;
        this.root = null;
        this.deps = null;
    }
};

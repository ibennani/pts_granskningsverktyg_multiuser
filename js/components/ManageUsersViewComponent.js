// js/components/ManageUsersViewComponent.js

import { get_users } from '../api/client.js';
import { api_post, api_delete } from '../api/client.js';

export const ManageUsersViewComponent = {
    CSS_PATH: 'css/components/manage_users_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;

        this.users = [];
        this.textarea_ref = null;
        this.handle_save = this.handle_save.bind(this);

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'ManageUsersViewComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {});
        }
    },

    get_t_func() {
        return (this.Translation && typeof this.Translation.t === 'function')
            ? this.Translation.t
            : (key) => `**${key}**`;
    },

    async fetch_users() {
        try {
            this.users = await get_users();
        } catch {
            this.users = [];
        }
    },

    async handle_save() {
        const t = this.get_t_func();
        if (!this.textarea_ref) return;

        const lines = (this.textarea_ref.value || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);

        const current_names = new Set(this.users.map((u) => u.name));
        const new_names = lines.filter((n) => !current_names.has(n));
        const removed = this.users.filter((u) => !lines.includes(u.name));

        try {
            for (const name of new_names) {
                await api_post('/users', { name });
            }
            for (const u of removed) {
                await api_delete(`/users/${u.id}`);
            }
            await this.fetch_users();
            this.NotificationComponent?.show_global_message?.(t('manage_users_saved'), 'success');
            this.render();
        } catch (err) {
            this.NotificationComponent?.show_global_message?.(
                err.message || t('manage_users_save_error'),
                'error'
            );
        }
    },

    async render() {
        if (!this.root || !this.Helpers?.create_element) return;

        await this.fetch_users();

        const t = this.get_t_func();
        this.root.innerHTML = '';

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate manage-users-plate' });

        if (this.NotificationComponent?.get_global_message_element_reference) {
            const msg_el = this.NotificationComponent.get_global_message_element_reference();
            plate.appendChild(msg_el);
        }

        plate.appendChild(this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            text_content: t('manage_users_title'),
            attributes: { tabindex: '-1' }
        }));

        plate.appendChild(this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('manage_users_intro')
        }));

        const label = this.Helpers.create_element('label', {
            attributes: { for: 'manage-users-textarea' },
            text_content: t('manage_users_textarea_label')
        });
        plate.appendChild(label);

        this.textarea_ref = this.Helpers.create_element('textarea', {
            id: 'manage-users-textarea',
            class_name: 'form-control',
            attributes: { rows: '10' }
        });
        this.textarea_ref.value = this.users
            .map((u) => u.name)
            .sort((a, b) => a.localeCompare(b, 'sv'))
            .join('\n');
        plate.appendChild(this.textarea_ref);

        const save_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            text_content: t('manage_users_save'),
            attributes: { type: 'button' }
        });
        save_btn.addEventListener('click', this.handle_save);
        plate.appendChild(save_btn);

        this.root.appendChild(plate);
    },

    destroy() {
        this.textarea_ref = null;
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
    }
};

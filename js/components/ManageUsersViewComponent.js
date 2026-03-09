// js/components/ManageUsersViewComponent.js

import { get_users } from '../api/client.js';
import './manage_users_view_component.css';
import { api_post, api_delete } from '../api/client.js';

/** Trimmar text (rad för rad), sorterar i bokstavsordning (sv) och synkar till API. Används vid lämna-vyn (fire-and-forget). */
async function sync_users_to_server_with_text(text, current_users, trim_fn) {
    const normalized = typeof trim_fn === 'function' ? trim_fn(text || '') : (text || '');
    const lines = normalized.split('\n').map((s) => s.trim()).filter(Boolean);
    const lines_sorted = [...lines].sort((a, b) => a.localeCompare(b, 'sv'));
    const current_names = new Set((current_users || []).map((u) => u.name));
    const new_names = lines_sorted.filter((n) => !current_names.has(n));
    const removed = (current_users || []).filter((u) => !lines_sorted.includes(u.name));
    for (const name of new_names) {
        await api_post('/users', { name });
    }
    for (const u of removed) {
        await api_delete(`/users/${u.id}`);
    }
}

export const ManageUsersViewComponent = {
    CSS_PATH: './manage_users_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.AutosaveService = deps.AutosaveService;

        this.users = [];
        this.textarea_ref = null;
        this.plate_element_ref = null;
        this.autosave_session = null;
        this.skip_autosave_on_destroy = false;
        this.handle_save = this.handle_save.bind(this);
        this.handle_autosave_input = this.handle_autosave_input.bind(this);

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'ManageUsersViewComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {});
        }
    },

    handle_autosave_input() {
        this.autosave_session?.request_autosave();
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

    /**
     * Tar trimmat text (en rad per namn), synkar till servern i användarens ordning
     * (POST nya, DELETE borttagna). Sorterar inte – bokstavsordning sker endast vid lämna-vyn.
     */
    async _sync_users_to_server(text) {
        const trim_text = this.AutosaveService?.trim_text_preserve_lines;
        const normalized = typeof trim_text === 'function' ? trim_text(text || '') : (text || '');
        const lines = normalized.split('\n').map((s) => s.trim()).filter(Boolean);

        const current_names = new Set(this.users.map((u) => u.name));
        const new_names = lines.filter((n) => !current_names.has(n));
        const removed = this.users.filter((u) => !lines.includes(u.name));

        for (const name of new_names) {
            await api_post('/users', { name });
        }
        for (const u of removed) {
            await api_delete(`/users/${u.id}`);
        }
        await this.fetch_users();
        return true;
    },

    async handle_save() {
        const t = this.get_t_func();
        if (!this.textarea_ref) return;

        this.autosave_session?.flush({ should_trim: true, skip_render: true });

        const raw = (this.textarea_ref.value || '');

        const trim_text = this.AutosaveService?.trim_text_preserve_lines;
        const normalized = typeof trim_text === 'function' ? trim_text(raw) : raw;

        try {
            await this._sync_users_to_server(raw);
            if (this.dispatch && this.StoreActionTypes?.SET_MANAGE_USERS_TEXT) {
                this.dispatch({
                    type: this.StoreActionTypes.SET_MANAGE_USERS_TEXT,
                    payload: normalized
                });
            }
            this.NotificationComponent?.show_global_message?.(t('manage_users_saved'), 'success');
        } catch (err) {
            this.NotificationComponent?.show_global_message?.(
                err.message || t('manage_users_save_error'),
                'error'
            );
        }
    },

    async render() {
        if (!this.root || !this.Helpers?.create_element) return;

        this.autosave_session?.destroy();
        this.autosave_session = null;

        await this.fetch_users();

        const t = this.get_t_func();
        // Vid start av vyn ska listan alltid komma från servern.
        const initial_text = this.users.map((u) => u.name).join('\n');

        this.root.innerHTML = '';

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate manage-users-plate' });
        this.plate_element_ref = plate;

        if (this.NotificationComponent?.append_global_message_areas_to) {
            this.NotificationComponent.append_global_message_areas_to(plate);
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
            attributes: { for: 'manage-users-textarea' }
        });
        const label_strong = this.Helpers.create_element('strong', {
            text_content: t('manage_users_textarea_label')
        });
        label.appendChild(label_strong);
        plate.appendChild(label);

        this.textarea_ref = this.Helpers.create_element('textarea', {
            id: 'manage-users-textarea',
            class_name: 'form-control',
            attributes: { rows: '10' }
        });
        this.textarea_ref.value = initial_text;
        plate.appendChild(this.textarea_ref);

        if (this.AutosaveService?.create_session && this.dispatch && this.StoreActionTypes?.SET_MANAGE_USERS_TEXT) {
            this.autosave_session = this.AutosaveService.create_session({
                form_element: plate,
                focus_root: plate,
                debounce_ms: 250,
                on_save: ({ should_trim, trim_text }) => {
                    if (!this.textarea_ref) return;
                    const raw = (this.textarea_ref.value || '');
                    const value = should_trim && typeof trim_text === 'function' ? trim_text(raw) : raw;
                    this.dispatch({ type: this.StoreActionTypes.SET_MANAGE_USERS_TEXT, payload: value });
                }
            });
            this.textarea_ref.addEventListener('input', this.handle_autosave_input);
        }

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
        if (!this.skip_autosave_on_destroy && this.plate_element_ref && this.autosave_session) {
            this.autosave_session.flush({ should_trim: true, skip_render: true });
        }
        const state = this.getState?.() || {};
        const text_to_sync = typeof state.manageUsersText === 'string' ? state.manageUsersText : '';
        const users_snapshot = this.users || [];
        const trim_fn = this.AutosaveService?.trim_text_preserve_lines;
        const notification = this.NotificationComponent;
        const t = this.get_t_func?.() ?? ((k) => k);

        const normalized = typeof trim_fn === 'function' ? trim_fn(text_to_sync || '') : (text_to_sync || '');
        const lines_sorted = normalized.split('\n').map((s) => s.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'sv'));
        const sorted_text = lines_sorted.join('\n');

        if (this.dispatch && this.StoreActionTypes?.SET_MANAGE_USERS_TEXT && sorted_text !== text_to_sync) {
            this.dispatch({ type: this.StoreActionTypes.SET_MANAGE_USERS_TEXT, payload: sorted_text });
        }

        this.autosave_session?.destroy();
        this.autosave_session = null;
        this.textarea_ref = null;
        this.plate_element_ref = null;
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;

        // Vid lämnande: spara listan till servern i bokstavsordning (fire-and-forget)
        Promise.resolve()
            .then(() => sync_users_to_server_with_text(text_to_sync, users_snapshot, trim_fn))
            .catch((err) => {
                notification?.show_global_message?.(err?.message || t('manage_users_save_error'), 'error');
            });
    }
};

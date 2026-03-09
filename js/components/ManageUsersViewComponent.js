// js/components/ManageUsersViewComponent.js

import { get_users, create_password_reset_code } from '../api/client.js';
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
        this.reset_user_select_ref = null;
        this.reset_code_container_ref = null;
        this.autosave_session = null;
        this.skip_autosave_on_destroy = false;
        this.handle_save = this.handle_save.bind(this);
        this.handle_autosave_input = this.handle_autosave_input.bind(this);
        this.handle_create_reset_code = this.handle_create_reset_code.bind(this);

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'ManageUsersViewComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {});
        }
    },

    handle_autosave_input() {
        this.autosave_session?.request_autosave();
        this.sync_reset_user_select_from_textarea();
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

    async handle_create_reset_code({ expires_in_minutes }) {
        const t = this.get_t_func();
        if (!this.reset_user_select_ref) return;
        const identifier = this.reset_user_select_ref.value;
        if (!identifier) {
            this.NotificationComponent?.show_global_message?.(t('manage_users_password_select_user_first'), 'warning');
            return;
        }
        try {
            const payload = await create_password_reset_code(identifier, expires_in_minutes);
            if (this.reset_code_container_ref) {
                this.reset_code_container_ref.innerHTML = '';
                const info = this.Helpers.create_element('p', {
                    class_name: 'manage-users-reset-code-info',
                    text_content: t('manage_users_password_code_info', { minutes: expires_in_minutes })
                });
                const code_el = this.Helpers.create_element('div', {
                    class_name: 'manage-users-reset-code-value',
                    text_content: payload.code
                });
                this.reset_code_container_ref.appendChild(info);
                this.reset_code_container_ref.appendChild(code_el);
            }
            this.NotificationComponent?.show_global_message?.(t('manage_users_password_code_created'), 'success');
        } catch (err) {
            this.NotificationComponent?.show_global_message?.(
                err?.message || t('manage_users_password_code_error'),
                'error'
            );
        }
    },

    sync_reset_user_select_from_textarea() {
        if (!this.reset_user_select_ref || !this.textarea_ref || !this.Helpers) return;
        const t = this.get_t_func();
        const raw = this.textarea_ref.value || '';
        const names = raw.split('\n')
            .map((s) => s.trim())
            .filter((s, index, arr) => s !== '' && arr.indexOf(s) === index);

        const previous_value = this.reset_user_select_ref.value;

        this.reset_user_select_ref.innerHTML = '';
        const placeholder_option = this.Helpers.create_element('option', {
            attributes: { value: '' },
            text_content: t('manage_users_password_select_user_placeholder')
        });
        this.reset_user_select_ref.appendChild(placeholder_option);

        names.forEach((name) => {
            const opt = this.Helpers.create_element('option', {
                attributes: { value: name },
                text_content: name
            });
            this.reset_user_select_ref.appendChild(opt);
        });

        if (previous_value && names.includes(previous_value)) {
            this.reset_user_select_ref.value = previous_value;
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

        // Sektion för lösenordshantering (admin-only vy)
        const reset_section_heading = this.Helpers.create_element('h2', {
            text_content: t('manage_users_password_section_title')
        });
        plate.appendChild(reset_section_heading);

        plate.appendChild(this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('manage_users_password_section_intro')
        }));

        const reset_label = this.Helpers.create_element('label', {
            attributes: { for: 'manage-users-reset-user-select' },
            text_content: t('manage_users_password_select_user_label')
        });
        plate.appendChild(reset_label);

        this.reset_user_select_ref = this.Helpers.create_element('select', {
            id: 'manage-users-reset-user-select',
            class_name: 'form-control'
        });
        this.sync_reset_user_select_from_textarea();
        plate.appendChild(this.reset_user_select_ref);

        const reset_controls = this.Helpers.create_element('div', { class_name: 'manage-users-reset-controls' });
        const expires_label = this.Helpers.create_element('label', {
            attributes: { for: 'manage-users-reset-expires' },
            text_content: t('manage_users_password_expires_label')
        });
        const expires_select = this.Helpers.create_element('select', {
            id: 'manage-users-reset-expires',
            class_name: 'form-control manage-users-reset-expires-select'
        });
        [
            { value: 15, label: t('manage_users_password_expires_15') },
            { value: 30, label: t('manage_users_password_expires_30') },
            { value: 60, label: t('manage_users_password_expires_60') }
        ].forEach((optDef) => {
            const opt = this.Helpers.create_element('option', {
                attributes: { value: String(optDef.value) },
                text_content: optDef.label
            });
            expires_select.appendChild(opt);
        });

        const create_code_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary'],
            text_content: t('manage_users_password_create_code_button'),
            attributes: { type: 'button' }
        });
        create_code_btn.addEventListener('click', () => {
            this.handle_create_reset_code({
                expires_in_minutes: Number(expires_select.value) || 15
            });
        });

        reset_controls.appendChild(expires_label);
        reset_controls.appendChild(expires_select);
        reset_controls.appendChild(create_code_btn);
        plate.appendChild(reset_controls);

        this.reset_code_container_ref = this.Helpers.create_element('div', {
            class_name: 'manage-users-reset-code-container'
        });
        plate.appendChild(this.reset_code_container_ref);

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
        this.reset_user_select_ref = null;
        this.reset_code_container_ref = null;
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

// js/components/ManageUsersViewComponent.js

import { get_users, create_password_reset_code, create_user, update_user, delete_user } from '../api/client.js';
import './manage_users_view_component.css';
import { GenericTableComponent } from './GenericTableComponent.js';

export const ManageUsersViewComponent = {
    CSS_PATH: './manage_users_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.ModalComponent = deps.ModalComponent;

        this.users = [];
        this.mode = 'list'; // 'list' | 'detail'
        this.current_user = null; // hela user-objektet när vi hanterar användare
        this.detail_form_root = null;
        this.table_root = null;
        this.reset_code_button_focus_ref = null;
        this.sort_state = { column_index: 0, direction: 'asc' };

        this._table = Object.create(GenericTableComponent);
        await this._table.init({ root, deps: { Helpers: this.Helpers } });

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

    async render() {
        if (!this.root || !this.Helpers?.create_element) return;

        await this.fetch_users();

        const t = this.get_t_func();

        this.root.innerHTML = '';

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate manage-users-plate' });
        this.table_root = plate;

        if (this.NotificationComponent?.append_global_message_areas_to) {
            this.NotificationComponent.append_global_message_areas_to(plate);
        }

        const header_row = this.Helpers.create_element('div', { class_name: 'manage-users-header-row' });

        const heading = this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            text_content: t('manage_users_title'),
            attributes: { tabindex: '-1' }
        });
        header_row.appendChild(heading);

        const add_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary', 'manage-users-add-button'],
            text_content: t('manage_users_add_button'),
            attributes: { type: 'button' }
        });
        add_btn.addEventListener('click', () => {
            this.mode = 'detail';
            this.current_user = null;
            this.render_detail_view();
        });
        header_row.appendChild(add_btn);
        plate.appendChild(header_row);

        const intro = this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('manage_users_intro_new')
        });
        plate.appendChild(intro);

        this.render_table_view();

        this.root.appendChild(plate);
    },

    _get_display_name(user) {
        const t = this.get_t_func();
        const raw_name = (user && user.name) ? String(user.name) : '';
        const trimmed = raw_name.trim();
        if (trimmed) return trimmed;
        return t('user_fallback_name', { id: user?.id ?? '' });
    },

    render_table_view() {
        if (!this.table_root || !this._table || !this.Helpers) return;
        const t = this.get_t_func();

        const columns = [
            {
                headerLabel: t('manage_users_col_username'),
                getContent: (user) => user.username || '',
                getSortValue: (user) => user.username || ''
            },
            {
                headerLabel: t('manage_users_col_name'),
                getContent: (user) => this._get_display_name(user),
                getSortValue: (user) => this._get_display_name(user)
            },
            {
                headerLabel: t('manage_users_col_is_admin'),
                getContent: (user) => (user.is_admin ? t('yes') : t('no')),
                getSortValue: (user) => (user.is_admin ? 1 : 0)
            },
            {
                headerLabel: t('manage_users_col_actions'),
                isAction: true,
                getContent: (user) => {
                    const container = this.Helpers.create_element('div', { class_name: 'manage-users-actions-cell' });

                    const display_name = this._get_display_name(user);

                    const reset_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-secondary', 'manage-users-reset-button'],
                        text_content: t('manage_users_action_create_reset_code'),
                        attributes: {
                            type: 'button',
                            'aria-label': `${t('manage_users_action_create_reset_code')} ${t('manage_users_action_for')} ${display_name}`
                        }
                    });
                    reset_btn.addEventListener('click', () => {
                        this.open_reset_code_modal_for_user(user);
                    });

                    const manage_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-secondary', 'manage-users-manage-button'],
                        text_content: t('manage_users_action_manage_user'),
                        attributes: {
                            type: 'button',
                            'aria-label': `${t('manage_users_action_manage_user')} ${t('manage_users_action_for')} ${display_name}`
                        }
                    });
                    manage_btn.addEventListener('click', () => {
                        this.mode = 'detail';
                        this.current_user = user;
                        this.render_detail_view();
                    });

                    container.appendChild(reset_btn);
                    container.appendChild(manage_btn);
                    return container;
                }
            }
        ];

        this._table.render({
            root: this.table_root,
            columns,
            data: this.users,
            emptyMessage: t('manage_users_empty'),
            ariaLabel: t('manage_users_table_aria_label'),
            wrapperClassName: 'generic-table-wrapper manage-users-table-wrapper',
            tableClassName: 'generic-table manage-users-table',
            sortState: this.sort_state,
            onSort: (column_index, direction) => {
                this.sort_state = { column_index, direction };
                this.render_table_view();
            },
            t
        });
    },

    render_detail_view() {
        if (!this.root || !this.Helpers) return;
        const t = this.get_t_func();

        this.root.innerHTML = '';

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate manage-users-plate' });
        this.detail_form_root = plate;

        if (this.NotificationComponent?.append_global_message_areas_to) {
            this.NotificationComponent.append_global_message_areas_to(plate);
        }

        const is_edit = !!this.current_user;

        plate.appendChild(this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            text_content: is_edit ? t('manage_users_detail_title_edit') : t('manage_users_detail_title_create'),
            attributes: { tabindex: '-1' }
        }));

        plate.appendChild(this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: is_edit ? t('manage_users_detail_intro_edit') : t('manage_users_detail_intro_create')
        }));

        const form = this.Helpers.create_element('form', {
            attributes: { novalidate: 'novalidate' }
        });

        const username_id = 'manage-users-username-input';
        const first_name_id = 'manage-users-first-name-input';
        const last_name_id = 'manage-users-last-name-input';
        const is_admin_id = 'manage-users-is-admin-input';
        const password_id = 'manage-users-password-input';

        const make_field = (label_text, input_el) => {
            const wrapper = this.Helpers.create_element('div', { class_name: 'form-group' });
            const label = this.Helpers.create_element('label', {
                attributes: { for: input_el.id },
                text_content: label_text
            });
            wrapper.appendChild(label);
            wrapper.appendChild(input_el);
            return wrapper;
        };

        const username_input = this.Helpers.create_element('input', {
            id: username_id,
            type: 'text',
            class_name: 'form-control',
            attributes: {
                autocomplete: 'username'
            }
        });
        if (this.current_user?.username) {
            username_input.value = this.current_user.username;
        }
        form.appendChild(make_field(t('manage_users_field_username'), username_input));

        const first_name_input = this.Helpers.create_element('input', {
            id: first_name_id,
            type: 'text',
            class_name: 'form-control'
        });
        const last_name_input = this.Helpers.create_element('input', {
            id: last_name_id,
            type: 'text',
            class_name: 'form-control'
        });
        if (this.current_user?.name) {
            const parts = String(this.current_user.name).trim().split(/\s+/);
            if (parts.length === 1) {
                first_name_input.value = parts[0];
            } else if (parts.length > 1) {
                first_name_input.value = parts[0];
                last_name_input.value = parts.slice(1).join(' ');
            }
        }
        form.appendChild(make_field(t('manage_users_field_first_name'), first_name_input));
        form.appendChild(make_field(t('manage_users_field_last_name'), last_name_input));

        const is_admin_wrapper = this.Helpers.create_element('div', { class_name: 'form-group' });
        const is_admin_checkbox = this.Helpers.create_element('input', {
            id: is_admin_id,
            type: 'checkbox',
            class_name: 'form-checkbox'
        });
        if (this.current_user?.is_admin) {
            is_admin_checkbox.checked = true;
        }
        const is_admin_label = this.Helpers.create_element('label', {
            attributes: { for: is_admin_id },
            text_content: t('manage_users_field_is_admin')
        });
        is_admin_wrapper.appendChild(is_admin_checkbox);
        is_admin_wrapper.appendChild(is_admin_label);
        form.appendChild(is_admin_wrapper);

        const password_input = this.Helpers.create_element('input', {
            id: password_id,
            type: 'password',
            class_name: 'form-control',
            attributes: {
                autocomplete: is_edit ? 'new-password' : 'new-password'
            }
        });
        form.appendChild(make_field(t('manage_users_field_password_optional'), password_input));

        const buttons_row = this.Helpers.create_element('div', { class_name: 'manage-users-detail-buttons' });

        const primary_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            text_content: is_edit ? t('manage_users_button_update_user') : t('manage_users_button_create_user'),
            attributes: { type: 'submit' }
        });

        const cancel_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary'],
            text_content: t('manage_users_button_discard'),
            attributes: { type: 'button' }
        });

        const delete_btn = is_edit ? this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'manage-users-delete-button'],
            text_content: t('manage_users_button_delete_user'),
            attributes: { type: 'button' }
        }) : null;

        buttons_row.appendChild(primary_btn);
        buttons_row.appendChild(cancel_btn);
        if (delete_btn) {
            buttons_row.appendChild(delete_btn);
        }

        form.appendChild(buttons_row);
        plate.appendChild(form);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.handle_submit_user_form({
                username_input,
                first_name_input,
                last_name_input,
                is_admin_checkbox,
                password_input
            });
        });

        cancel_btn.addEventListener('click', () => {
            this.mode = 'list';
            this.current_user = null;
            this.render();
        });

        if (delete_btn) {
            delete_btn.addEventListener('click', () => {
                if (!this.current_user) return;
                this.open_delete_user_modal(this.current_user);
            });
        }

        this.root.appendChild(plate);
    },

    async handle_submit_user_form({ username_input, first_name_input, last_name_input, is_admin_checkbox, password_input }) {
        const t = this.get_t_func();
        const username = (username_input.value || '').trim();
        const first_name = (first_name_input.value || '').trim();
        const last_name = (last_name_input.value || '').trim();
        const is_admin = !!is_admin_checkbox.checked;
        const password = (password_input.value || '').trim();

        if (!username) {
            this.NotificationComponent?.show_global_message?.(t('manage_users_error_username_required'), 'warning');
            return;
        }
        if (!first_name || !last_name) {
            this.NotificationComponent?.show_global_message?.(t('manage_users_error_name_required'), 'warning');
            return;
        }
        if (password && password.length < 8) {
            this.NotificationComponent?.show_global_message?.(t('manage_users_error_password_too_short'), 'warning');
            return;
        }

        const body = {
            username,
            first_name,
            last_name,
            is_admin
        };
        if (password) {
            body.password = password;
        }

        try {
            if (this.current_user) {
                await update_user(this.current_user.id, body);
                this.NotificationComponent?.show_global_message?.(t('manage_users_update_success'), 'success');
            } else {
                await create_user(body);
                this.NotificationComponent?.show_global_message?.(t('manage_users_create_success'), 'success');
            }
            await this.fetch_users();
            this.mode = 'list';
            this.current_user = null;
            this.render();
        } catch (err) {
            const msg = err?.message || t('manage_users_save_error');
            this.NotificationComponent?.show_global_message?.(msg, 'error');
        }
    },

    open_delete_user_modal(user) {
        const t = this.get_t_func();
        if (!this.ModalComponent) return;

        const username = user.username || t('user_fallback_name', { id: user.id });
        this.ModalComponent.show(
            {
                h1_text: t('manage_users_delete_modal_title', { username }),
                message_text: t('manage_users_delete_modal_message')
            },
            (container, modal_instance) => {
                const actions = this.Helpers.create_element('div', { class_name: 'modal-actions' });

                const delete_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('manage_users_delete_modal_confirm'),
                    attributes: { type: 'button' }
                });
                const keep_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-secondary'],
                    text_content: t('manage_users_delete_modal_cancel'),
                    attributes: { type: 'button' }
                });

                delete_btn.addEventListener('click', async () => {
                    try {
                        await delete_user(user.id);
                        this.NotificationComponent?.show_global_message?.(t('manage_users_delete_success'), 'success');
                        await this.fetch_users();
                        this.mode = 'list';
                        this.current_user = null;
                        this.render();
                        modal_instance.close();
                    } catch (err) {
                        const msg = err?.message || t('manage_users_delete_error');
                        this.NotificationComponent?.show_global_message?.(msg, 'error');
                        modal_instance.close();
                    }
                });

                keep_btn.addEventListener('click', () => {
                    modal_instance.close();
                });

                actions.appendChild(delete_btn);
                actions.appendChild(keep_btn);
                container.appendChild(actions);
            }
        );
    },

    open_reset_code_modal_for_user(user) {
        const t = this.get_t_func();
        if (!this.ModalComponent) return;
        const username = user.username || t('user_fallback_name', { id: user.id });

        this.ModalComponent.show(
            {
                h1_text: t('manage_users_reset_modal_title', { username }),
                message_text: t('manage_users_reset_modal_intro')
            },
            (container, modal_instance) => {
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

                const controls = this.Helpers.create_element('div', { class_name: 'manage-users-reset-controls' });
                controls.appendChild(expires_label);
                controls.appendChild(expires_select);

                const code_container = this.Helpers.create_element('div', {
                    class_name: 'manage-users-reset-code-container'
                });

                const actions = this.Helpers.create_element('div', { class_name: 'modal-actions' });
                const create_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('manage_users_password_create_code_button'),
                    attributes: { type: 'button' }
                });
                const close_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-secondary'],
                    text_content: t('manage_users_reset_modal_close'),
                    attributes: { type: 'button' }
                });

                let current_code = '';
                const copy_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-secondary', 'manage-users-copy-button'],
                    text_content: t('manage_users_copy_code_button'),
                    attributes: { type: 'button' }
                });

                const copy_code_to_clipboard = async () => {
                    if (!current_code) return;
                    try {
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(current_code);
                        } else {
                            const textarea = this.Helpers.create_element('textarea', {
                                attributes: { 'aria-hidden': 'true' }
                            });
                            textarea.style.position = 'fixed';
                            textarea.style.left = '-9999px';
                            textarea.value = current_code;
                            document.body.appendChild(textarea);
                            textarea.focus();
                            textarea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textarea);
                        }
                        copy_btn.textContent = t('manage_users_copy_code_button_copied');
                        this.NotificationComponent?.show_global_message?.(t('manage_users_copy_code_success'), 'success');
                    } catch {
                        this.NotificationComponent?.show_global_message?.(t('manage_users_copy_code_error'), 'error');
                    }
                };

                copy_btn.addEventListener('click', () => {
                    copy_code_to_clipboard();
                });

                create_btn.addEventListener('click', async () => {
                    const minutes = Number(expires_select.value) || 15;
                    try {
                        const payload = await create_password_reset_code(user.username || String(user.id), minutes);
                        current_code = payload.code;
                        code_container.innerHTML = '';
                        const info = this.Helpers.create_element('p', {
                            class_name: 'manage-users-reset-code-info',
                            text_content: t('manage_users_password_code_info', { minutes })
                        });
                        const code_el = this.Helpers.create_element('div', {
                            class_name: 'manage-users-reset-code-value',
                            text_content: current_code
                        });
                        code_container.appendChild(info);
                        code_container.appendChild(code_el);
                        copy_btn.textContent = t('manage_users_copy_code_button');
                        this.NotificationComponent?.show_global_message?.(t('manage_users_password_code_created'), 'success');
                    } catch (err) {
                        const msg = err?.message || t('manage_users_password_code_error');
                        this.NotificationComponent?.show_global_message?.(msg, 'error');
                    }
                });

                close_btn.addEventListener('click', () => {
                    modal_instance.close();
                });

                actions.appendChild(create_btn);
                actions.appendChild(copy_btn);
                actions.appendChild(close_btn);

                container.appendChild(controls);
                container.appendChild(code_container);
                container.appendChild(actions);
            }
        );
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        this.users = [];
        this.mode = 'list';
        this.current_user = null;
        this.detail_form_root = null;
        this.table_root = null;
        if (this._table && typeof this._table.destroy === 'function') {
            this._table.destroy();
        }
        this._table = null;
    }
};

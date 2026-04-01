// js/components/ManageUsersViewComponent.js

import { get_users, create_user, update_user } from '../api/client.js';
import { open_delete_user_modal as open_manage_users_delete_modal } from './manage_users/manage_users_delete_modal.js';
import { open_reset_code_modal_for_user as open_manage_users_reset_code_modal } from './manage_users/manage_users_reset_code_modal.js';
import {
    generate_username_from_full_name,
    get_existing_usernames_set,
    find_available_username
} from '../logic/manage_users_username.js';
import './manage_users_view_component.css';
import { GenericTableComponent } from './GenericTableComponent.js';

export class ManageUsersViewComponent {
    constructor() {
        this.CSS_PATH = './manage_users_view_component.css';
        this.root = null;
        this.deps = null;
        this.router = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.users = [];
        this.users_loaded = false;
        this.fetch_users_error = null;
        this.user_filter_query = '';
        this._userFilterHadFocus = false;
        this._userFilterSelection = null;
        this._userFilterInputRef = null;
        this.mode = 'list';
        this.initial_user_id = null;
        this.current_user = null;
        this.detail_form_root = null;
        this.table_root = null;
        this.reset_code_button_focus_ref = null;
        this.return_focus_info = null;
        this.skip_table_focus_restore_next_render = false;
        this.detail_delete_button_ref = null;
        this.sort_state = { columnIndex: 0, direction: 'asc' };
        this._table = null;
    }

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;

        this.users = [];
        this.users_loaded = false;
        this.fetch_users_error = null;
        this.user_filter_query = '';
        this._userFilterHadFocus = false;
        this._userFilterSelection = null;
        this._userFilterInputRef = null;

        const params = deps.params || {};
        this.mode = params.mode === 'detail' ? 'detail' : 'list'; // 'list' | 'detail'
        this.initial_user_id = params.id || null;
        this.current_user = null; // hela user-objektet när vi hanterar användare
        this.detail_form_root = null;
        this.table_root = null;
        this.reset_code_button_focus_ref = null;
        this.return_focus_info = this.return_focus_info || null;
        this.skip_table_focus_restore_next_render = this.skip_table_focus_restore_next_render || false;
        this.detail_delete_button_ref = null;
        this.sort_state = { columnIndex: 0, direction: 'asc' };

        this.handle_filter_input = this.handle_filter_input.bind(this);

        this._table = new GenericTableComponent();
        await this._table.init({ root, deps: { Helpers: this.Helpers } });

        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH, 'ManageUsersViewComponent', {
                timeout: 5000,
                maxRetries: 2
            }).catch(() => {});
        }
    }

    get_t_func() {
        return (this.Translation && typeof this.Translation.t === 'function')
            ? this.Translation.t
            : (key) => `**${key}**`;
    }

    async fetch_users() {
        if (this.users_loaded) return;
        this.fetch_users_error = null;
        try {
            const data = await get_users();
            if (!Array.isArray(data)) {
                this.users = [];
                this.fetch_users_error = Object.assign(new Error('Ogiltigt svar'), { status: 0 });
            } else {
                this.users = data;
            }
        } catch (err) {
            this.users = [];
            this.fetch_users_error = err;
        } finally {
            this.users_loaded = true;
        }
    }

    async render() {
        if (!this.root || !this.Helpers?.create_element) return;

        if (typeof window !== 'undefined' && window.__gv_restore_focus_info) {
            window.__gv_restore_focus_info = null;
        }

        await this.fetch_users();

        if (this.mode === 'detail') {
            if (!this.current_user && this.initial_user_id && Array.isArray(this.users)) {
                const found = this.users.find((user) => String(user.id) === String(this.initial_user_id));
                this.current_user = found || null;
            }
            this.render_detail_view();
            return;
        }

        const t = this.get_t_func();

        this.root.innerHTML = '';

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate manage-users-plate' });

        if (this.NotificationComponent?.append_global_message_areas_to) {
            this.NotificationComponent.append_global_message_areas_to(plate);
        }

        const header_row = this.Helpers.create_element('div', { class_name: 'manage-users-header-row' });

        const left_header = this.Helpers.create_element('div', {
            class_name: 'manage-users-header-left'
        });

        const heading = this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            text_content: t('manage_users_title'),
            attributes: { tabindex: '-1' }
        });
        left_header.appendChild(heading);

        const add_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary', 'manage-users-add-button'],
            text_content: t('manage_users_add_button'),
            attributes: { type: 'button' }
        });
        add_btn.addEventListener('click', () => {
            if (this.router) {
                this.router('manage_users', { mode: 'detail' });
            } else {
                this.mode = 'detail';
                this.current_user = null;
                this.render_detail_view();
            }
        });
        left_header.appendChild(add_btn);

        this._userFilterInputRef = null;
        const filter_wrapper = this.Helpers.create_element('div', {
            class_name: ['audit-filter-wrapper', 'manage-users-filter-wrapper']
        });
        const filter_label = this.Helpers.create_element('label', {
            attributes: { for: 'manage-users-filter-input' }
        });
        const filter_label_strong = this.Helpers.create_element('strong', {
            text_content: t('manage_users_filter_label')
        });
        filter_label.appendChild(filter_label_strong);
        const filter_input = this.Helpers.create_element('input', {
            class_name: ['audit-filter-input', 'form-control', 'manage-users-filter-input'],
            attributes: {
                id: 'manage-users-filter-input',
                type: 'text',
                name: 'manage-users-filter',
                value: this.user_filter_query || ''
            }
        });
        filter_input.addEventListener('input', this.handle_filter_input);
        this._userFilterInputRef = filter_input;
        filter_wrapper.appendChild(filter_label);
        filter_wrapper.appendChild(filter_input);
        left_header.appendChild(filter_wrapper);

        header_row.appendChild(left_header);
        plate.appendChild(header_row);

        const intro = this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('manage_users_intro_new')
        });
        plate.appendChild(intro);

        const table_container = this.Helpers.create_element('div', {
            class_name: 'manage-users-table-container'
        });
        this.table_root = table_container;
        plate.appendChild(table_container);

        this.render_table_view();

        this.root.appendChild(plate);

        if (this._userFilterHadFocus && this._userFilterInputRef) {
            const input = this._userFilterInputRef;
            const selection = this._userFilterSelection;
            setTimeout(() => {
                if (!input || !document.contains(input)) return;
                try {
                    input.focus({ preventScroll: true });
                } catch {
                    input.focus();
                }
                if (selection && typeof input.setSelectionRange === 'function') {
                    try {
                        input.setSelectionRange(selection.selectionStart, selection.selectionEnd);
                    } catch (e) {
                        // Ignorera fel vid återställning av markering
                    }
                }
            }, 0);
        }
        this._userFilterHadFocus = false;
        this._userFilterSelection = null;

        this.restore_focus_to_manage_trigger_if_needed();
    }

    _get_display_name(user) {
        const t = this.get_t_func();
        const raw_name = (user && user.name) ? String(user.name) : '';
        const trimmed = raw_name.trim();
        if (trimmed) return trimmed;
        return t('user_fallback_name', { id: user?.id ?? '' });
    }

    handle_filter_input(event) {
        const target = event && event.target ? event.target : null;
        const value = target ? target.value : '';
        if (this.user_filter_query === value) return;
        let selectionStart = null;
        let selectionEnd = null;
        if (target && typeof target.selectionStart === 'number' && typeof target.selectionEnd === 'number') {
            selectionStart = target.selectionStart;
            selectionEnd = target.selectionEnd;
        }
        this.user_filter_query = value;
        this._userFilterHadFocus = document.activeElement === target;
        this._userFilterSelection = selectionStart !== null && selectionStart !== undefined && selectionEnd !== null && selectionEnd !== undefined
            ? { selectionStart, selectionEnd }
            : null;
        if (this.root) {
            this.render();
        }
    }

    render_table_view() {
        if (!this.table_root || !this._table || !this.Helpers) return;
        const t = this.get_t_func();

        if (this.skip_table_focus_restore_next_render && this._table) {
            this._table._lastFocusPosition = null;
            this._table._pendingSortFocusIndex = undefined;
            this.skip_table_focus_restore_next_render = false;
        }

        const raw_users = Array.isArray(this.users) ? this.users : [];
        const query_raw = this.user_filter_query || '';
        const query = query_raw.trim().toLowerCase();
        const has_filter = query.length > 0;
        const data = !has_filter
            ? raw_users
            : raw_users.filter((user) => {
                const username = (user && user.username ? String(user.username) : '').trim().toLowerCase();
                const display_name = this._get_display_name(user).toString().trim().toLowerCase();
                if (!query) return true;
                return username.includes(query) || display_name.includes(query);
            });
        const is_forbidden = this.fetch_users_error && this.fetch_users_error.status === 403;
        const is_load_error = this.fetch_users_error && !is_forbidden;
        const empty_message = is_forbidden
            ? t('manage_users_error_forbidden')
            : is_load_error
                ? t('manage_users_error_load_failed')
                : (has_filter ? t('manage_users_filter_no_results') : t('manage_users_empty'));

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

                    const manage_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-secondary', 'manage-users-manage-button'],
                        text_content: t('manage_users_action_manage_user'),
                        attributes: {
                            type: 'button',
                            'aria-label': `${t('manage_users_action_manage_user')} ${t('manage_users_action_for')} ${display_name}`,
                            'data-user-id': String(user.id)
                        }
                    });
                    manage_btn.addEventListener('click', () => {
                        this.return_focus_info = { type: 'manage', user_id: user.id };
                        if (this.router) {
                            this.router('manage_users', { mode: 'detail', id: user.id });
                        } else {
                            this.mode = 'detail';
                            this.current_user = user;
                            this.render_detail_view();
                        }
                    });

                    container.appendChild(manage_btn);
                    return container;
                }
            }
        ];

        this._table.render({
            root: this.table_root,
            columns,
            data,
            emptyMessage: empty_message,
            ariaLabel: t('manage_users_table_aria_label'),
            wrapperClassName: 'generic-table-wrapper manage-users-table-wrapper',
            tableClassName: 'generic-table manage-users-table',
            sortState: this.sort_state,
            onSort: (column_index, direction) => {
                this.sort_state = { columnIndex: column_index, direction };
                this.render_table_view();
            },
            t
        });
    }

    restore_focus_to_manage_trigger_if_needed() {
        if (!this.root || !this.return_focus_info) return;

        const info = this.return_focus_info;
        this.return_focus_info = null;

        try {
            let el = null;
            if (info.type === 'manage' && info.user_id) {
                const user_id_str = String(info.user_id).replace(/"/g, '\\"');
                el = this.root.querySelector(`.manage-users-manage-button[data-user-id="${user_id_str}"]`);
            }

            if (el && typeof el.focus === 'function' && document.contains(el)) {
                const focus_element = () => {
                    if (!document.contains(el)) return;
                    try {
                        el.focus({ preventScroll: true });
                    } catch (e) {
                        el.focus();
                    }
                };

                const raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';
                if (raf) {
                    window.requestAnimationFrame(() => {
                        window.requestAnimationFrame(focus_element);
                    });
                } else {
                    setTimeout(focus_element, 0);
                }
            }
        } catch (e) {
            // Ignorera fokusfel
        }
    }

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

        if (is_edit && this.current_user && (!this.return_focus_info || this.return_focus_info.user_id !== this.current_user.id)) {
            this.return_focus_info = { type: 'manage', user_id: this.current_user.id };
        }

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
        const name_id = 'manage-users-name-input';
        const is_admin_id = 'manage-users-is-admin-input';

        const make_field = (label_text, input_el) => {
            const wrapper = this.Helpers.create_element('div', { class_name: 'form-group' });
            const label = this.Helpers.create_element('label', {
                attributes: { for: input_el.id }
            });
            const strong = this.Helpers.create_element('strong', {
                text_content: label_text
            });
            label.appendChild(strong);
            wrapper.appendChild(label);
            wrapper.appendChild(input_el);
            return wrapper;
        };

        const name_input = this.Helpers.create_element('input', {
            id: name_id,
            type: 'text',
            class_name: 'form-control',
            attributes: {
                maxlength: '40',
                size: '40'
            }
        });
        if (this.current_user?.name) {
            name_input.value = String(this.current_user.name).trim();
        }
        form.appendChild(make_field(t('manage_users_field_name'), name_input));

        const username_input = this.Helpers.create_element('input', {
            id: username_id,
            type: 'text',
            class_name: 'form-control',
            attributes: {
                autocomplete: 'username',
                maxlength: '6',
                size: '6'
            }
        });
        if (this.current_user?.username) {
            username_input.value = this.current_user.username;
        }
        form.appendChild(make_field(t('manage_users_field_username'), username_input));

        name_input.addEventListener('blur', () => {
            if (is_edit) return;
            if (!username_input) return;
            const current_username = (username_input.value || '').trim();
            if (current_username) return;

            const candidate = generate_username_from_full_name(name_input.value || '');
            if (!candidate) return;

            const existing_set = get_existing_usernames_set(this.users);
            const available = find_available_username(candidate, existing_set);
            if (!available) return;

            username_input.value = available;
        });

        const is_admin_wrapper = this.Helpers.create_element('div', { class_name: 'form-group' });
        const is_admin_checkbox = this.Helpers.create_element('input', {
            id: is_admin_id,
            class_name: 'form-checkbox',
            attributes: {
                type: 'checkbox'
            }
        });
        if (this.current_user?.is_admin) {
            is_admin_checkbox.checked = true;
        }
        const is_admin_label = this.Helpers.create_element('label', {
            attributes: { for: is_admin_id },
            class_name: 'manage-users-admin-label'
        });
        const is_admin_label_strong = this.Helpers.create_element('strong', {});
        is_admin_label.appendChild(is_admin_label_strong);
        this.update_admin_label_text(name_input, is_admin_label_strong);
        is_admin_wrapper.appendChild(is_admin_checkbox);
        is_admin_wrapper.appendChild(is_admin_label);
        form.appendChild(is_admin_wrapper);

        name_input.addEventListener('input', () => {
            this.update_admin_label_text(name_input, is_admin_label_strong);
        });

        if (is_edit && this.current_user) {
            const one_time_code_section = this.Helpers.create_element('div', { class_name: 'manage-users-one-time-code-section' });
            const one_time_code_heading = this.Helpers.create_element('h2', {
                class_name: 'manage-users-one-time-code-heading',
                text_content: t('manage_users_detail_one_time_code_heading')
            });
            const one_time_code_intro = this.Helpers.create_element('p', {
                class_name: 'manage-users-one-time-code-intro',
                text_content: t('manage_users_detail_one_time_code_intro')
            });
            const reset_code_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-secondary', 'manage-users-reset-button'],
                text_content: t('manage_users_action_create_reset_code'),
                attributes: {
                    type: 'button',
                    'aria-label': `${t('manage_users_action_create_reset_code')} ${t('manage_users_action_for')} ${this._get_display_name(this.current_user)}`
                }
            });
            reset_code_btn.addEventListener('click', () => {
                this.open_reset_code_modal_for_user(this.current_user);
            });
            one_time_code_section.appendChild(one_time_code_heading);
            one_time_code_section.appendChild(one_time_code_intro);
            one_time_code_section.appendChild(reset_code_btn);
            form.appendChild(one_time_code_section);
        }

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
            class_name: ['button', 'button-danger', 'manage-users-delete-button'],
            html_content: `<span>${t('manage_users_button_delete_user')}</span>` + this.Helpers.get_icon_svg('delete'),
            attributes: { type: 'button' }
        }) : null;

        buttons_row.appendChild(primary_btn);
        buttons_row.appendChild(cancel_btn);
        if (delete_btn) {
            buttons_row.appendChild(delete_btn);
            this.detail_delete_button_ref = delete_btn;
        }

        form.appendChild(buttons_row);
        plate.appendChild(form);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.handle_submit_user_form({
                username_input,
                name_input,
                is_admin_checkbox
            });
        });

        cancel_btn.addEventListener('click', () => {
            this.skip_table_focus_restore_next_render = true;
            if (this.router) {
                this.router('manage_users', {});
            } else {
                this.mode = 'list';
                this.current_user = null;
                this.render();
            }
        });

        if (delete_btn) {
            delete_btn.addEventListener('click', async () => {
                if (!this.current_user) return;
                await this.open_delete_user_modal(this.current_user);
            });
        }

        this.root.appendChild(plate);
    }

    async handle_submit_user_form({ username_input, name_input, is_admin_checkbox }) {
        const t = this.get_t_func();
        const username = username_input ? (username_input.value || '').trim() : '';
        const raw_name = (name_input.value || '').trim();
        const is_admin = !!is_admin_checkbox.checked;

        const name_parts = raw_name.split(/\s+/).filter(Boolean);
        const first_name = name_parts[0] || '';
        const last_name = name_parts.slice(1).join(' ');

        if (!username) {
            this.NotificationComponent?.show_global_message?.(t('manage_users_error_username_required'), 'warning');
            if (username_input && typeof username_input.focus === 'function') {
                try {
                    username_input.focus({ preventScroll: true });
                } catch {
                    username_input.focus();
                }
            }
            return;
        }
        if (!/^[a-z]{6}$/.test(username)) {
            this.NotificationComponent?.show_global_message?.(t('manage_users_error_username_required'), 'warning');
            if (username_input && typeof username_input.focus === 'function') {
                try {
                    username_input.focus({ preventScroll: true });
                } catch {
                    username_input.focus();
                }
            }
            return;
        }
        if (!first_name || !last_name) {
            this.NotificationComponent?.show_global_message?.(t('manage_users_error_name_required'), 'warning');
            return;
        }

        const body = {
            name: raw_name,
            is_admin
        };
        if (username) {
            body.username = username;
        }

        try {
            if (this.current_user) {
                await update_user(this.current_user.id, body);
                this.NotificationComponent?.show_global_message?.(t('manage_users_update_success'), 'success');
                this.return_focus_info = { type: 'manage', user_id: this.current_user.id };
                await this.fetch_users();
                if (this.router) {
                    this.skip_table_focus_restore_next_render = true;
                    this.router('manage_users', {});
                } else {
                    this.mode = 'list';
                    this.current_user = null;
                    this.skip_table_focus_restore_next_render = true;
                    this.render();
                }
            } else {
                const created = await create_user(body);
                this.NotificationComponent?.show_global_message?.(t('manage_users_create_success'), 'success');
                await this.fetch_users();
                const created_user = this.users.find((u) => String(u.id) === String(created?.id)) || created;
                this.open_reset_code_modal_for_user(created_user, {
                    onClose: () => {
                        this.skip_table_focus_restore_next_render = true;
                        if (this.router) {
                            this.router('manage_users', {});
                        } else {
                            this.mode = 'list';
                            this.current_user = null;
                            this.render();
                        }
                    }
                });
            }
        } catch (err) {
            const msg = err?.message || t('manage_users_save_error');
            this.NotificationComponent?.show_global_message?.(msg, 'error');
        }
    }

    update_admin_label_text(name_input, label_content_el) {
        if (!label_content_el) return;
        const t = this.get_t_func();
        const raw_name = (name_input && name_input.value) ? name_input.value.trim() : '';
        if (raw_name) {
            label_content_el.textContent = t('manage_users_is_admin_label_with_name', { name: raw_name });
        } else {
            label_content_el.textContent = t('manage_users_is_admin_label_without_name');
        }
    }

    async open_delete_user_modal(user) {
        await open_manage_users_delete_modal(user, {
            get_t_func: () => this.get_t_func(),
            Helpers: this.Helpers,
            get_display_name: (u) => this._get_display_name(u),
            NotificationComponent: this.NotificationComponent,
            on_prepare_delete_confirmation: () => {
                this.return_focus_info = null;
                this.skip_table_focus_restore_next_render = true;
                if (this._table) {
                    this._table._lastFocusPosition = null;
                    this._table._pendingSortFocusIndex = undefined;
                }
            },
            fetch_users: () => this.fetch_users(),
            navigate_to_list_after_delete: () => {
                if (this.router) {
                    this.router('manage_users', {});
                } else {
                    this.mode = 'list';
                    this.current_user = null;
                    this.render();
                }
            },
            get_detail_delete_button_ref: () => this.detail_delete_button_ref
        });
    }

    open_reset_code_modal_for_user(user, options = {}) {
        open_manage_users_reset_code_modal(user, {
            get_t_func: () => this.get_t_func(),
            Helpers: this.Helpers,
            get_display_name: (u) => this._get_display_name(u),
            NotificationComponent: this.NotificationComponent
        }, options);
    }

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        this.users = [];
        this.users_loaded = false;
        this.mode = 'list';
        this.current_user = null;
        this.initial_user_id = null;
        this.detail_form_root = null;
        this.table_root = null;
        if (this._table && typeof this._table.destroy === 'function') {
            this._table.destroy();
        }
        this._table = null;
    }
}

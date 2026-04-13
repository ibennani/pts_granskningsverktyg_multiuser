// js/components/ManageUsersViewComponent.js

import { get_users } from '../api/client.js';
import { open_delete_user_modal as open_manage_users_delete_modal } from './manage_users/manage_users_delete_modal.js';
import { open_reset_code_modal_for_user as open_manage_users_reset_code_modal } from './manage_users/manage_users_reset_code_modal.js';
import {
    render_manage_users_table_view,
    restore_manage_users_list_focus_if_needed
} from './manage_users/manage_users_list_view.js';
import { render_manage_users_detail_view } from './manage_users/manage_users_detail_view.js';
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

    render_table_view() {
        render_manage_users_table_view({
            table_root: this.table_root,
            table_component: this._table,
            Helpers: this.Helpers,
            get_t_func: () => this.get_t_func(),
            users: this.users,
            user_filter_query: this.user_filter_query,
            fetch_users_error: this.fetch_users_error,
            sort_state: this.sort_state,
            get_display_name: (u) => this._get_display_name(u),
            reset_table_focus_skip_if_requested: () => {
                if (this.skip_table_focus_restore_next_render && this._table) {
                    this._table._lastFocusPosition = null;
                    this._table._pendingSortFocusIndex = undefined;
                    this.skip_table_focus_restore_next_render = false;
                }
            },
            on_manage_user_click: (user) => {
                this.return_focus_info = { type: 'manage', user_id: user.id };
                if (this.router) {
                    this.router('manage_users', { mode: 'detail', id: user.id });
                } else {
                    this.mode = 'detail';
                    this.current_user = user;
                    this.render_detail_view();
                }
            },
            on_sort_change: (column_index, direction) => {
                this.sort_state = { columnIndex: column_index, direction };
                this.render_table_view();
            }
        });
    }

    restore_focus_to_manage_trigger_if_needed() {
        restore_manage_users_list_focus_if_needed(this.root, () => {
            if (!this.return_focus_info) return null;
            const info = this.return_focus_info;
            this.return_focus_info = null;
            return info;
        });
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

    render_detail_view() {
        render_manage_users_detail_view({
            root: this.root,
            Helpers: this.Helpers,
            get_t_func: () => this.get_t_func(),
            NotificationComponent: this.NotificationComponent,
            current_user: this.current_user,
            users: this.users,
            get_display_name: (u) => this._get_display_name(u),
            set_detail_form_root: (plate) => {
                this.detail_form_root = plate;
            },
            set_detail_delete_button_ref: (btn) => {
                this.detail_delete_button_ref = btn;
            },
            on_return_focus_for_edit_if_needed: () => {
                if (this.current_user && (!this.return_focus_info || this.return_focus_info.user_id !== this.current_user.id)) {
                    this.return_focus_info = { type: 'manage', user_id: this.current_user.id };
                }
            },
            open_reset_code_modal_for_user: (user, opts) => this.open_reset_code_modal_for_user(user, opts),
            open_delete_user_modal: (user) => this.open_delete_user_modal(user),
            fetch_users: () => this.fetch_users(),
            router: this.router,
            set_skip_table_focus_restore_next_render: (v) => {
                this.skip_table_focus_restore_next_render = v;
            },
            set_mode_list_clear_current: () => {
                this.mode = 'list';
                this.current_user = null;
            },
            render: () => this.render(),
            set_return_focus_info: (info) => {
                this.return_focus_info = info;
            }
        });
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

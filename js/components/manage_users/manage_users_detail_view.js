/**
 * @fileoverview Detaljvy (skapa/redigera användare) och formulärinskickning.
 */

import { create_user, update_user } from '../../api/client.js';
import {
    generate_username_from_full_name,
    get_existing_usernames_set,
    find_available_username
} from '../../logic/manage_users_username.js';

/**
 * @param {object} deps
 * @param {() => (key: string, opts?: object) => string} deps.get_t_func
 * @param {HTMLInputElement | null} name_input
 * @param {HTMLElement | null} label_content_el
 */
export function update_manage_users_admin_label_text(deps, name_input, label_content_el) {
    if (!label_content_el) return;
    const t = deps.get_t_func();
    const raw_name = (name_input && name_input.value) ? name_input.value.trim() : '';
    if (raw_name) {
        label_content_el.textContent = t('manage_users_is_admin_label_with_name', { name: raw_name });
    } else {
        label_content_el.textContent = t('manage_users_is_admin_label_without_name');
    }
}

/**
 * @param {object} deps
 * @param {{ username_input: HTMLInputElement, name_input: HTMLInputElement, is_admin_checkbox: HTMLInputElement }} inputs
 */
export async function submit_manage_users_detail_form(deps, inputs) {
    const { username_input, name_input, is_admin_checkbox } = inputs;
    const t = deps.get_t_func();
    const username = username_input ? (username_input.value || '').trim() : '';
    const raw_name = (name_input.value || '').trim();
    const is_admin = !!is_admin_checkbox.checked;

    const name_parts = raw_name.split(/\s+/).filter(Boolean);
    const first_name = name_parts[0] || '';
    const last_name = name_parts.slice(1).join(' ');

    if (!username) {
        deps.NotificationComponent?.show_global_message?.(t('manage_users_error_username_required'), 'warning');
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
        deps.NotificationComponent?.show_global_message?.(t('manage_users_error_username_required'), 'warning');
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
        deps.NotificationComponent?.show_global_message?.(t('manage_users_error_name_required'), 'warning');
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
        if (deps.current_user) {
            await update_user(deps.current_user.id, body);
            deps.NotificationComponent?.show_global_message?.(t('manage_users_update_success'), 'success');
            deps.set_return_focus_info({ type: 'manage', user_id: deps.current_user.id });
            await deps.fetch_users();
            if (deps.router) {
                deps.set_skip_table_focus_restore_next_render(true);
                deps.router('manage_users', {});
            } else {
                deps.set_mode_list_clear_current();
                deps.set_skip_table_focus_restore_next_render(true);
                deps.render();
            }
        } else {
            const created = await create_user(body);
            deps.NotificationComponent?.show_global_message?.(t('manage_users_create_success'), 'success');
            await deps.fetch_users();
            const created_user = deps.users.find((u) => String(u.id) === String(created?.id)) || created;
            deps.open_reset_code_modal_for_user(created_user, {
                onClose: () => {
                    deps.set_skip_table_focus_restore_next_render(true);
                    if (deps.router) {
                        deps.router('manage_users', {});
                    } else {
                        deps.set_mode_list_clear_current();
                        deps.render();
                    }
                }
            });
        }
    } catch (err) {
        const msg = err?.message || t('manage_users_save_error');
        deps.NotificationComponent?.show_global_message?.(msg, 'error');
    }
}

/**
 * @param {object} deps
 * @param {HTMLElement | null} deps.root
 * @param {object} deps.Helpers
 * @param {() => (key: string, opts?: object) => string} deps.get_t_func
 * @param {object} [deps.NotificationComponent]
 * @param {object | null} deps.current_user
 * @param {unknown[]} deps.users
 * @param {(u: object) => string} deps.get_display_name
 * @param {(plate: HTMLElement) => void} deps.set_detail_form_root
 * @param {(btn: HTMLElement | null) => void} deps.set_detail_delete_button_ref
 * @param {() => void} deps.on_return_focus_for_edit_if_needed
 * @param {(user: object, options?: object) => void} deps.open_reset_code_modal_for_user
 * @param {(user: object) => Promise<void>} deps.open_delete_user_modal
 * @param {() => Promise<void>} deps.fetch_users
 * @param {object | null} deps.router
 * @param {(v: boolean) => void} deps.set_skip_table_focus_restore_next_render
 * @param {() => void} deps.set_mode_list_clear_current
 * @param {() => void | Promise<void>} deps.render
 */
export function render_manage_users_detail_view(deps) {
    if (!deps.root || !deps.Helpers) return;
    const t = deps.get_t_func();
    const Helpers = deps.Helpers;

    deps.root.innerHTML = '';

    const plate = Helpers.create_element('div', { class_name: 'content-plate manage-users-plate' });
    deps.set_detail_form_root(plate);

    const is_edit = !!deps.current_user;

    deps.on_return_focus_for_edit_if_needed();

    plate.appendChild(Helpers.create_element('h1', {
        id: 'main-content-heading',
        text_content: is_edit ? t('manage_users_detail_title_edit') : t('manage_users_detail_title_create'),
        attributes: { tabindex: '-1' }
    }));

    plate.appendChild(Helpers.create_element('p', {
        class_name: 'view-intro-text',
        text_content: is_edit ? t('manage_users_detail_intro_edit') : t('manage_users_detail_intro_create')
    }));

    const form = Helpers.create_element('form', {
        attributes: { novalidate: 'novalidate' }
    });

    const username_id = 'manage-users-username-input';
    const name_id = 'manage-users-name-input';
    const is_admin_id = 'manage-users-is-admin-input';

    const make_field = (label_text, input_el) => {
        const wrapper = Helpers.create_element('div', { class_name: 'form-group' });
        const label = Helpers.create_element('label', {
            attributes: { for: input_el.id }
        });
        const strong = Helpers.create_element('strong', {
            text_content: label_text
        });
        label.appendChild(strong);
        wrapper.appendChild(label);
        wrapper.appendChild(input_el);
        return wrapper;
    };

    const name_input = Helpers.create_element('input', {
        id: name_id,
        type: 'text',
        class_name: 'form-control',
        attributes: {
            maxlength: '40',
            size: '40'
        }
    });
    if (deps.current_user?.name) {
        name_input.value = String(deps.current_user.name).trim();
    }
    form.appendChild(make_field(t('manage_users_field_name'), name_input));

    const username_input = Helpers.create_element('input', {
        id: username_id,
        type: 'text',
        class_name: 'form-control',
        attributes: {
            autocomplete: 'username',
            maxlength: '6',
            size: '6'
        }
    });
    if (deps.current_user?.username) {
        username_input.value = deps.current_user.username;
    }
    form.appendChild(make_field(t('manage_users_field_username'), username_input));

    name_input.addEventListener('blur', () => {
        if (is_edit) return;
        if (!username_input) return;
        const current_username = (username_input.value || '').trim();
        if (current_username) return;

        const candidate = generate_username_from_full_name(name_input.value || '');
        if (!candidate) return;

        const existing_set = get_existing_usernames_set(deps.users);
        const available = find_available_username(candidate, existing_set);
        if (!available) return;

        username_input.value = available;
    });

    const is_admin_wrapper = Helpers.create_element('div', { class_name: 'form-group' });
    const is_admin_checkbox = Helpers.create_element('input', {
        id: is_admin_id,
        class_name: 'form-checkbox',
        attributes: {
            type: 'checkbox'
        }
    });
    if (deps.current_user?.is_admin) {
        is_admin_checkbox.checked = true;
    }
    const is_admin_label = Helpers.create_element('label', {
        attributes: { for: is_admin_id },
        class_name: 'manage-users-admin-label'
    });
    const is_admin_label_strong = Helpers.create_element('strong', {});
    is_admin_label.appendChild(is_admin_label_strong);
    update_manage_users_admin_label_text(deps, name_input, is_admin_label_strong);
    is_admin_wrapper.appendChild(is_admin_checkbox);
    is_admin_wrapper.appendChild(is_admin_label);
    form.appendChild(is_admin_wrapper);

    name_input.addEventListener('input', () => {
        update_manage_users_admin_label_text(deps, name_input, is_admin_label_strong);
    });

    if (is_edit && deps.current_user) {
        const one_time_code_section = Helpers.create_element('div', { class_name: 'manage-users-one-time-code-section' });
        const one_time_code_heading = Helpers.create_element('h2', {
            class_name: 'manage-users-one-time-code-heading',
            text_content: t('manage_users_detail_one_time_code_heading')
        });
        const one_time_code_intro = Helpers.create_element('p', {
            class_name: 'manage-users-one-time-code-intro',
            text_content: t('manage_users_detail_one_time_code_intro')
        });
        const reset_code_btn = Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'manage-users-reset-button'],
            text_content: t('manage_users_action_create_reset_code'),
            attributes: {
                type: 'button',
                'aria-label': `${t('manage_users_action_create_reset_code')} ${t('manage_users_action_for')} ${deps.get_display_name(deps.current_user)}`
            }
        });
        reset_code_btn.addEventListener('click', () => {
            deps.open_reset_code_modal_for_user(deps.current_user);
        });
        one_time_code_section.appendChild(one_time_code_heading);
        one_time_code_section.appendChild(one_time_code_intro);
        one_time_code_section.appendChild(reset_code_btn);
        form.appendChild(one_time_code_section);
    }

    const buttons_row = Helpers.create_element('div', { class_name: 'manage-users-detail-buttons' });

    const primary_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-primary'],
        text_content: is_edit ? t('manage_users_button_update_user') : t('manage_users_button_create_user'),
        attributes: { type: 'submit' }
    });

    const cancel_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-secondary'],
        text_content: t('manage_users_button_discard'),
        attributes: { type: 'button' }
    });

    const delete_btn = is_edit ? Helpers.create_element('button', {
        class_name: ['button', 'button-danger', 'manage-users-delete-button'],
        html_content: `<span>${t('manage_users_button_delete_user')}</span>` + Helpers.get_icon_svg('delete'),
        attributes: { type: 'button' }
    }) : null;

    buttons_row.appendChild(primary_btn);
    buttons_row.appendChild(cancel_btn);
    if (delete_btn) {
        buttons_row.appendChild(delete_btn);
        deps.set_detail_delete_button_ref(delete_btn);
    }

    form.appendChild(buttons_row);
    plate.appendChild(form);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await submit_manage_users_detail_form(deps, {
            username_input,
            name_input,
            is_admin_checkbox
        });
    });

    cancel_btn.addEventListener('click', () => {
        deps.set_skip_table_focus_restore_next_render(true);
        if (deps.router) {
            deps.router('manage_users', {});
        } else {
            deps.set_mode_list_clear_current();
            deps.render();
        }
    });

    if (delete_btn) {
        delete_btn.addEventListener('click', async () => {
            if (!deps.current_user) return;
            await deps.open_delete_user_modal(deps.current_user);
        });
    }

    deps.root.appendChild(plate);
}
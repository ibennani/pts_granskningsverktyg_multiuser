/**
 * @fileoverview Modal för att skapa och visa engångskod för lösenordsåterställning.
 */

import { create_password_reset_code } from '../../api/client.js';
import { app_runtime_refs } from '../../utils/app_runtime_refs.js';

/**
 * @param {object} user
 * @param {object} deps
 * @param {() => (key: string, opts?: object) => string} deps.get_t_func
 * @param {object} deps.Helpers
 * @param {(u: object) => string} deps.get_display_name
 * @param {object} [deps.NotificationComponent]
 * @param {object} [deps.ModalComponent] — standard: app_runtime_refs.modal_component
 * @param {object} [options]
 * @param {() => void} [options.onClose]
 */
export function open_reset_code_modal_for_user(user, deps, options = {}) {
    const t = deps.get_t_func();
    const ModalComponent = deps.ModalComponent ?? app_runtime_refs.modal_component;
    const Helpers = deps.Helpers;
    if (!ModalComponent?.show || !Helpers?.create_element) return;
    const username = user.username || t('user_fallback_name', { id: user.id });
    const display_name = deps.get_display_name(user);
    const onClose = typeof options.onClose === 'function' ? options.onClose : null;

    ModalComponent.show(
        {
            h1_text: t('manage_users_reset_modal_title'),
            message_text: t('manage_users_reset_modal_intro', { name: display_name })
        },
        (container, modal_instance) => {
            const expires_label = Helpers.create_element('label', {
                attributes: { for: 'manage-users-reset-expires' }
            });
            const expires_label_strong = Helpers.create_element('strong', {
                text_content: t('manage_users_password_expires_label')
            });
            expires_label.appendChild(expires_label_strong);
            const expires_select = Helpers.create_element('select', {
                id: 'manage-users-reset-expires',
                class_name: 'form-control manage-users-reset-expires-select'
            });
            const expiry_options = [
                { value: 15, label: t('manage_users_password_expires_15') },
                { value: 30, label: t('manage_users_password_expires_30') },
                { value: 60, label: t('manage_users_password_expires_60') },
                { value: 120, label: t('manage_users_password_expires_120') },
                { value: 240, label: t('manage_users_password_expires_240') }
            ];
            expiry_options.forEach((optDef) => {
                const opt = Helpers.create_element('option', {
                    attributes: { value: String(optDef.value) },
                    text_content: optDef.label
                });
                expires_select.appendChild(opt);
            });

            const controls = Helpers.create_element('div', { class_name: 'manage-users-reset-controls' });
            controls.appendChild(expires_label);
            controls.appendChild(expires_select);

            const info_heading = Helpers.create_element('h2', {
                class_name: 'manage-users-reset-info-heading',
                text_content: t('manage_users_password_info_heading', { name: display_name })
            });

            const code_container = Helpers.create_element('div', {
                class_name: 'manage-users-reset-code-container'
            });

            const actions = Helpers.create_element('div', { class_name: 'modal-actions' });
            const close_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-secondary'],
                text_content: t('manage_users_reset_modal_close'),
                attributes: { type: 'button' }
            });

            let current_code = '';
            let current_expires_at = null;
            const copy_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-primary', 'manage-users-copy-button'],
                text_content: t('manage_users_copy_code_button'),
                attributes: { type: 'button' }
            });

            const copy_info = Helpers.create_element('p', {
                class_name: 'manage-users-copy-info'
            });

            const copy_code_to_clipboard = async () => {
                if (!current_code) return;
                const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
                const app_base = Helpers?.get_app_base ? Helpers.get_app_base() : '/';
                const server_url = app_base === '/' ? origin : (origin + app_base.replace(/\/$/, ''));
                const expires_str = current_expires_at
                    ? (() => {
                        try {
                            const d = new Date(current_expires_at);
                            return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                        } catch {
                            return '';
                        }
                    })()
                    : '';
                const clipboard_text = t('manage_users_copy_clipboard_text', {
                    server_url,
                    username,
                    code: current_code,
                    expires: expires_str
                });
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(clipboard_text);
                    } else {
                        const textarea = Helpers.create_element('textarea', {
                            attributes: { 'aria-hidden': 'true' }
                        });
                        textarea.style.position = 'fixed';
                        textarea.style.left = '-9999px';
                        textarea.value = clipboard_text;
                        document.body.appendChild(textarea);
                        textarea.focus();
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                    }
                    copy_btn.textContent = t('manage_users_copy_code_button_copied');
                    copy_info.textContent = t('manage_users_copy_code_button_copied');
                    deps.NotificationComponent?.show_global_message?.(
                        t('manage_users_copy_code_button_copied'),
                        'success'
                    );
                } catch {
                    deps.NotificationComponent?.show_global_message?.(t('manage_users_copy_code_error'), 'error');
                }
            };

            copy_btn.addEventListener('click', () => {
                copy_code_to_clipboard();
            });

            const create_or_refresh_code = async () => {
                let minutes = Number(expires_select.value) || 15;
                const fallback_duration_label = (expiry_options.find((opt) => opt.value === minutes)?.label)
                    || t('manage_users_password_expires_15');
                try {
                    const payload = await create_password_reset_code(user.username || String(user.id), minutes);
                    current_code = payload.code;
                    current_expires_at = payload.expires_at || null;
                    if (payload && Number.isFinite(Number(payload.minutes)) && Number(payload.minutes) > 0) {
                        minutes = Number(payload.minutes);
                    }
                    const effective_duration_label = (expiry_options.find((opt) => opt.value === minutes)?.label)
                        || fallback_duration_label;
                    code_container.innerHTML = '';
                    const info = Helpers.create_element('p', {
                        class_name: 'manage-users-reset-code-info',
                        text_content: t('manage_users_password_code_info', { duration: effective_duration_label, name: display_name })
                    });
                    const list = Helpers.create_element('ul', {
                        class_name: 'manage-users-reset-code-list'
                    });

                    const username_item = Helpers.create_element('li', {});
                    const username_label = Helpers.create_element('strong', {
                        text_content: t('manage_users_password_code_bullet_username')
                    });
                    username_item.appendChild(username_label);
                    username_item.appendChild(document.createTextNode(` ${username}`));

                    const code_item = Helpers.create_element('li', {});
                    const code_label = Helpers.create_element('strong', {
                        text_content: t('manage_users_password_code_bullet_code')
                    });
                    const code_el = Helpers.create_element('span', {
                        class_name: 'manage-users-reset-code-value',
                        text_content: current_code
                    });
                    code_item.appendChild(code_label);
                    code_item.appendChild(document.createTextNode(' '));
                    code_item.appendChild(code_el);

                    list.appendChild(username_item);
                    list.appendChild(code_item);

                    code_container.appendChild(info);
                    code_container.appendChild(list);
                    copy_btn.textContent = t('manage_users_copy_code_button');
                    deps.NotificationComponent?.show_global_message?.(t('manage_users_password_code_created'), 'success');
                } catch (err) {
                    const msg = err?.message || t('manage_users_password_code_error');
                    deps.NotificationComponent?.show_global_message?.(msg, 'error');
                }
            };

            expires_select.addEventListener('change', () => {
                create_or_refresh_code();
            });

            close_btn.addEventListener('click', () => {
                if (onClose) onClose();
                modal_instance.close();
            });

            actions.appendChild(copy_btn);

            container.appendChild(controls);
            container.appendChild(info_heading);
            container.appendChild(code_container);
            container.appendChild(actions);
            container.appendChild(copy_info);
            container.appendChild(close_btn);

            create_or_refresh_code();
        }
    );
}

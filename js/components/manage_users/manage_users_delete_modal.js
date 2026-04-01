/**
 * @fileoverview Modal för bekräftad radering av användare i hantera användare-vyn.
 */

import { delete_user, get_user_audit_count } from '../../api/client.js';
import { app_runtime_refs } from '../../utils/app_runtime_refs.js';

/**
 * @param {object} user
 * @param {object} deps
 * @param {() => (key: string, opts?: object) => string} deps.get_t_func
 * @param {object} deps.Helpers
 * @param {(u: object) => string} deps.get_display_name
 * @param {object} [deps.NotificationComponent]
 * @param {object} [deps.ModalComponent] — standard: app_runtime_refs.modal_component
 * @param {() => void} deps.on_prepare_delete_confirmation
 * @param {() => Promise<void>} deps.fetch_users
 * @param {() => void} deps.navigate_to_list_after_delete
 * @param {() => unknown | null} [deps.get_detail_delete_button_ref]
 * @returns {Promise<void>}
 */
export async function open_delete_user_modal(user, deps) {
    const t = deps.get_t_func();
    const ModalComponent = deps.ModalComponent ?? app_runtime_refs.modal_component;
    const Helpers = deps.Helpers;
    if (!ModalComponent?.show || !Helpers?.create_element) return;

    const display_name = deps.get_display_name(user);
    let audit_count = 0;

    try {
        const result = await get_user_audit_count(user.id);
        const raw_count = result && (result.audit_count ?? result.count);
        if (Number.isFinite(Number(raw_count))) {
            audit_count = Number(raw_count);
        }
    } catch (err) {
        audit_count = 0;
    }

    ModalComponent.show(
        {
            h1_text: t('manage_users_delete_modal_title', { name: display_name }),
            message_text: t('manage_users_delete_modal_message', { name: display_name, auditCount: audit_count })
        },
        (container, modal_instance) => {
            const actions = Helpers.create_element('div', { class_name: 'modal-actions' });

            const delete_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                text_content: t('manage_users_delete_modal_confirm', { name: display_name }),
                attributes: { type: 'button' }
            });
            const keep_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-secondary'],
                text_content: t('manage_users_delete_modal_cancel', { name: display_name }),
                attributes: { type: 'button' }
            });

            delete_btn.addEventListener('click', async () => {
                try {
                    deps.on_prepare_delete_confirmation();
                    await delete_user(user.id);
                    deps.NotificationComponent?.show_global_message?.(t('manage_users_delete_success'), 'success');
                    await deps.fetch_users();
                    deps.navigate_to_list_after_delete();
                    modal_instance.close();
                } catch (err) {
                    const msg = err?.message || t('manage_users_delete_error');
                    deps.NotificationComponent?.show_global_message?.(msg, 'error');
                    modal_instance.close();
                }
            });

            keep_btn.addEventListener('click', () => {
                modal_instance.close();
                const btn = deps.get_detail_delete_button_ref ? deps.get_detail_delete_button_ref() : null;
                if (btn && typeof btn.focus === 'function' && document.contains(btn)) {
                    try {
                        btn.focus({ preventScroll: true });
                    } catch (e) {
                        btn.focus();
                    }
                }
            });

            actions.appendChild(delete_btn);
            actions.appendChild(keep_btn);
            container.appendChild(actions);
        }
    );
}

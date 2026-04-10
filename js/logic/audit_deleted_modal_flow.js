/**
 * Visar modal när granskning saknas på servern (404) och navigerar till översikten.
 */

import { app_runtime_refs } from '../utils/app_runtime_refs.js';

export function show_audit_deleted_modal_and_navigate() {
    if (typeof window === 'undefined') return;
    const current_view = window.__gv_current_view_name || null;
    const outside_audit_views = new Set([
        'start',
        'audit',
        'audit_audits',
        'audit_rules',
        'login',
        'manage_users',
        'my_settings',
        'statistics',
        'backup',
        'backup_detail',
        'backup_settings'
    ]);
    if (current_view && outside_audit_views.has(current_view)) {
        return;
    }
    if (window.__GV_AUDIT_DELETED_MODAL_SHOWN__) return;
    window.__GV_AUDIT_DELETED_MODAL_SHOWN__ = true;

    const ModalComponent = app_runtime_refs.modal_component;
    const Helpers = window.Helpers;
    const t = window.Translation?.t || ((key) => key);

    if (!ModalComponent?.show || !Helpers?.create_element) {
        const NotificationComponent = app_runtime_refs.notification_component;
        if (NotificationComponent?.show_global_message) {
            NotificationComponent.show_global_message(
                t('audit_deleted_modal_message_fallback'),
                'error'
            );
        }
        try {
            window.location.hash = '#audit_audits';
        } catch (_) {
            // ignoreras medvetet
        }
        return;
    }

    ModalComponent.show(
        {
            h1_text: t('audit_deleted_modal_title'),
            message_text: t('audit_deleted_modal_message')
        },
        (container, modal_instance) => {
            const buttons_wrapper = Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
            const ok_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                text_content: t('audit_deleted_modal_understand_button')
            });
            ok_btn.addEventListener('click', () => {
                modal_instance.close();
                try {
                    window.location.hash = '#audit_audits';
                } catch (_) {
                    // ignoreras medvetet
                }
            });
            buttons_wrapper.appendChild(ok_btn);
            container.appendChild(buttons_wrapper);
        }
    );
}

/**
 * @fileoverview Modal för att redigera gruppnamn i grupperad granskningslista.
 */

import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import type { AuditListGroup } from '../logic/audit_list_case_grouping.js';
import { set_audit_group_display_name } from '../logic/audit_list_group_display_names.js';
import { build_save_button_html_content } from '../ui/save_button_html.js';

type ModalDeps = {
    Helpers: { create_element: (...args: unknown[]) => HTMLElement };
    t: (key: string, replacements?: Record<string, unknown>) => string;
};

type ModalInstance = {
    close: (focus?: HTMLElement) => void;
};

type ModalComponentApi = {
    show: (
        opts: { h1_text: string; message_text: string },
        content_callback: (container: HTMLElement, modal: ModalInstance) => void
    ) => void;
};

type OpenGroupActorEditModalOpts = {
    on_saved?: () => void;
};

function build_actor_edit_form(
    Helpers: ModalDeps['Helpers'],
    t: ModalDeps['t'],
    actor_name: string
): { form_group: HTMLElement; input: HTMLInputElement } {
    const form_group = Helpers.create_element('div', { class_name: 'form-group' });
    const label = Helpers.create_element('label', {
        attributes: { for: 'audit-group-actor-edit-name' }
    });
    label.appendChild(
        Helpers.create_element('strong', { text_content: t('audit_group_actor_edit_modal_label') })
    );
    const help = Helpers.create_element('p', {
        class_name: 'audit-group-actor-edit-modal-help',
        text_content: t('audit_group_actor_edit_modal_help')
    });
    const input = Helpers.create_element('input', {
        id: 'audit-group-actor-edit-name',
        class_name: 'form-control',
        attributes: { type: 'text', name: 'audit-group-actor-edit-name' }
    }) as HTMLInputElement;
    input.value = actor_name;
    form_group.appendChild(label);
    form_group.appendChild(help);
    form_group.appendChild(input);
    return { form_group, input };
}

function build_modal_actions(
    Helpers: ModalDeps['Helpers'],
    t: ModalDeps['t'],
    on_save: () => void,
    on_close: () => void
): HTMLElement {
    const actions = Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
    const save_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-primary'],
        html_content: build_save_button_html_content(t('audit_group_actor_edit_modal_save')),
        attributes: { type: 'button' }
    });
    save_btn.addEventListener('click', on_save);
    const close_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        text_content: t('audit_group_actor_edit_modal_close'),
        attributes: { type: 'button' }
    });
    close_btn.addEventListener('click', on_close);
    actions.appendChild(save_btn);
    actions.appendChild(close_btn);
    return actions;
}

/** Öppnar modal för gruppens visningsnamn (aktörskolumnen) och sparar lokalt per ärendenummer. */
export function open_audit_group_actor_edit_modal(
    group: AuditListGroup,
    actor_name: string,
    deps: ModalDeps,
    trigger_button: HTMLElement,
    opts: OpenGroupActorEditModalOpts = {}
): void {
    const ModalComponent = app_runtime_refs.modal_component as ModalComponentApi | null;
    const { Helpers, t } = deps;
    if (!ModalComponent?.show || !Helpers?.create_element) return;

    ModalComponent.show(
        {
            h1_text: t('audit_group_actor_edit_modal_title'),
            message_text: ''
        },
        (container, modal) => {
            const { form_group, input } = build_actor_edit_form(Helpers, t, actor_name);
            const close_modal = () => modal.close(trigger_button);
            const save_group_name = () => {
                set_audit_group_display_name(group.group_key, input.value);
                opts.on_saved?.();
                close_modal();
            };
            container.appendChild(form_group);
            container.appendChild(
                build_modal_actions(Helpers, t, save_group_name, close_modal)
            );
            requestAnimationFrame(() => {
                try {
                    input.focus({ preventScroll: true });
                } catch {
                    input.focus();
                }
            });
        }
    );
}

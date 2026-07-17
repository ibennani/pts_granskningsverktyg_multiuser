/**
 * @fileoverview Engångsdialog för äldre granskningar utan granskningstyp.
 */

import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import {
    apply_audit_type_selection,
    has_audit_type_id,
    resolve_available_audit_types,
} from '../../shared/audit/audit_type_metadata.js';

type HelpersLike = {
    create_element: (
        tag: string,
        opts?: {
            class_name?: string | string[];
            text_content?: string;
            attributes?: Record<string, string>;
        }
    ) => HTMLElement;
};

type AuditStateLike = {
    ruleFileContent?: unknown;
    auditMetadata?: Record<string, unknown>;
};

export function audit_needs_legacy_type_prompt(state: AuditStateLike | null | undefined): boolean {
    if (!state?.ruleFileContent) return false;
    if (has_audit_type_id(state.auditMetadata ?? null)) return false;
    return resolve_available_audit_types(state.ruleFileContent).length > 1;
}

type ModalComponentLike = {
    show?: (
        config: { h1_text: string; message_text: string },
        build_content: (
            container: HTMLElement,
            modal_instance: { close: (...args: unknown[]) => void }
        ) => void
    ) => void;
};

export function show_audit_type_legacy_prompt(
    state: AuditStateLike,
    deps: {
        Helpers: HelpersLike;
        t: (key: string) => string;
        dispatch: (action: { type: string; payload: Record<string, unknown> }) => void | Promise<void>;
        StoreActionTypes: { UPDATE_METADATA: string };
    },
    trigger_element: HTMLElement | null = null
): void {
    const ModalComponent = app_runtime_refs.modal_component as ModalComponentLike | null | undefined;
    if (!ModalComponent?.show || !deps.Helpers?.create_element) return;

    const types = resolve_available_audit_types(state.ruleFileContent);
    if (types.length <= 1) return;

    ModalComponent.show(
        {
            h1_text: deps.t('audit_type_legacy_modal_title'),
            message_text: deps.t('audit_type_legacy_modal_message'),
        },
        (container, modal_instance) => {
            const field = deps.Helpers.create_element('div', { class_name: 'form-group' });
            const label = deps.Helpers.create_element('label', {
                attributes: { for: 'legacy-audit-type-select' },
                text_content: deps.t('metadata_audit_type_label'),
            });
            field.appendChild(label);
            const select = deps.Helpers.create_element('select', {
                class_name: ['form-control', 'dropdown-select'],
                attributes: {
                    id: 'legacy-audit-type-select',
                    name: 'legacyAuditTypeId',
                    required: 'required',
                },
            }) as HTMLSelectElement;
            select.appendChild(
                deps.Helpers.create_element('option', {
                    attributes: { value: '' },
                    text_content: deps.t('metadata_audit_type_select_prompt'),
                })
            );
            types.forEach((row) => {
                select.appendChild(
                    deps.Helpers.create_element('option', {
                        attributes: { value: row.id },
                        text_content: row.label,
                    })
                );
            });
            field.appendChild(select);
            container.appendChild(field);

            const actions = deps.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
            const save_btn = deps.Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                text_content: deps.t('audit_type_legacy_modal_save'),
            });
            save_btn.addEventListener('click', async () => {
                const type_id = String(select.value ?? '').trim();
                if (!type_id) {
                    select.focus();
                    return;
                }
                const next_meta = { ...(state.auditMetadata || {}) };
                if (!apply_audit_type_selection(next_meta, state.ruleFileContent, type_id)) {
                    select.focus();
                    return;
                }
                await deps.dispatch({
                    type: deps.StoreActionTypes.UPDATE_METADATA,
                    payload: next_meta,
                });
                modal_instance.close(null, { skipHistoryPop: true });
                if (trigger_element && document.contains(trigger_element)) {
                    trigger_element.focus();
                }
            });
            actions.appendChild(save_btn);
            container.appendChild(actions);
        }
    );
}

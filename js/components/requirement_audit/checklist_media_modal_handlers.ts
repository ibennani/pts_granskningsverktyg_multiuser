/**
 * @fileoverview Modal-hantering för media, fastnat och kopiera observation.
 */

import { resolve_map_entry } from '../../audit_logic.js';
import { get_current_user_name } from '../../utils/helpers.js';
import { app_runtime_refs } from '../../utils/app_runtime_refs.js';
import { is_debug_stuck_sync } from '../../app/runtime_flags.js';
import { consoleManager } from '../../utils/console_manager.js';
import { collect_attached_media_filenames } from '../../logic/audit_attached_media_references.js';
import { can_edit_observation_detail } from '../../logic/audit_observation_edit_policy.js';
import { open_attach_media_modal } from '../media/AttachMediaModal.js';
import type { ChecklistEventHandlerHost } from './checklist_event_handler_types.js';
import { build_save_button_html_content } from '../../ui/save_button_html.js';

export function handle_attach_media_click(
    host: ChecklistEventHandlerHost,
    event: Event,
    attach_btn: HTMLButtonElement
): void {
    event.preventDefault();
    const pc_item = attach_btn.closest('.pass-criterion-item[data-pc-id]');
    const check_item = attach_btn.closest('.check-item[data-check-id]');
    if (!pc_item || !check_item || !host.Helpers?.create_element) return;

    const pc_id = (pc_item as HTMLElement).dataset.pcId!;
    const check_id = (check_item as HTMLElement).dataset.checkId!;
    const t = host.Translation.t;

    const chk_open = resolve_map_entry(host.requirement_result_ref?.checkResults, check_id);
    const check_open = chk_open?.value as { passCriteria?: Record<string, unknown> } | undefined;
    const pc_open = check_open?.passCriteria
        ? resolve_map_entry(check_open.passCriteria, pc_id)
        : null;
    const existing_filenames = (pc_open?.value as { attachedMediaFilenames?: string[] } | undefined)
        ?.attachedMediaFilenames;
    const initial_filenames = Array.isArray(existing_filenames) ? existing_filenames : [];

    open_attach_media_modal({
        t,
        Helpers: host.Helpers,
        audit_id: host.get_audit_id ? host.get_audit_id() : null,
        initial_filenames,
        textarea_id: 'attach-media-filenames',
        media_scope: 'requirement',
        trigger_element: attach_btn,
        get_still_referenced_filenames_after_save: (final_filenames) => {
            const state = typeof host.get_state === 'function' ? host.get_state() : null;
            const sample_id = host.get_sample_id ? host.get_sample_id() : null;
            const requirement_id = host.get_requirement_map_key ? host.get_requirement_map_key() : null;
            if (!sample_id || !requirement_id) {
                return collect_attached_media_filenames(state as Parameters<typeof collect_attached_media_filenames>[0]);
            }
            return collect_attached_media_filenames(state as Parameters<typeof collect_attached_media_filenames>[0], {
                type: 'pc',
                sampleId: sample_id,
                requirementId: requirement_id,
                checkId: check_id,
                pcId: pc_id,
                filenames: final_filenames
            });
        },
        get_observation_detail: () => {
            const chk_live = resolve_map_entry(host.requirement_result_ref?.checkResults, check_id);
            const pc_live = (chk_live?.value as { passCriteria?: Record<string, unknown> } | undefined)?.passCriteria
                ? resolve_map_entry(
                    (chk_live!.value as { passCriteria: Record<string, unknown> }).passCriteria,
                    pc_id
                )
                : null;
            return String((pc_live?.value as { observationDetail?: string } | undefined)?.observationDetail || '');
        },
        get_observation_edit: () => {
            const state = typeof host.get_state === 'function' ? host.get_state() : null;
            if (!can_edit_observation_detail(state?.auditStatus)) return null;
            return {
                can_edit: true,
                on_save: (text: string) => {
                    host._set_pc_observation_detail(
                        host.requirement_result_ref?.checkResults,
                        check_id,
                        pc_id,
                        text
                    );
                    if (host.on_observation_change_callback) {
                        host.on_observation_change_callback();
                    }
                    host.update_dom();
                }
            };
        },
        on_save: (filenames: string[]) => {
            const chk_save = resolve_map_entry(host.requirement_result_ref?.checkResults, check_id);
            const check_result = chk_save?.value as { passCriteria?: Record<string, unknown> } | undefined;
            const pc_save = check_result?.passCriteria
                ? resolve_map_entry(check_result.passCriteria, pc_id)
                : null;
            if (pc_save?.value) {
                (pc_save.value as { attachedMediaFilenames?: string[] }).attachedMediaFilenames = filenames;
                if (host.on_attached_media_saved_callback) {
                    host.on_attached_media_saved_callback();
                } else if (host.on_observation_change_callback) {
                    host.on_observation_change_callback();
                }
                host.update_dom();
            }
        }
    });
}

function apply_stuck_description_to_result_ref(
    host: ChecklistEventHandlerHost,
    description: string
): void {
    if (!host.requirement_result_ref) return;
    host.requirement_result_ref.stuckProblemDescription = description;
    host.requirement_result_ref.lastStatusUpdate = host.Helpers?.get_current_iso_datetime_utc?.()
        || new Date().toISOString();
    host.requirement_result_ref.lastStatusUpdateBy = get_current_user_name();
}

async function persist_stuck_modal_change_and_close(
    host: ChecklistEventHandlerHost,
    modal: { close: (el: HTMLElement) => void },
    stuck_btn: HTMLButtonElement,
    t: (key: string) => string
): Promise<void> {
    host._update_dom_stuck_button(t);
    if (host.on_stuck_description_saved_callback) {
        await host.on_stuck_description_saved_callback();
    } else if (host.on_observation_change_callback) {
        host.on_observation_change_callback();
    }
    modal.close(stuck_btn);
}

function build_stuck_modal_actions(
    host: ChecklistEventHandlerHost,
    container: HTMLElement,
    modal: { close: (el: HTMLElement) => void },
    textarea: HTMLTextAreaElement,
    stuck_btn: HTMLButtonElement,
    existing_description: string,
    t: (key: string) => string
): void {
    const actions_wrapper = host.Helpers!.create_element('div', { class_name: 'modal-attach-media-actions' });
    const save_btn = host.Helpers!.create_element('button', {
        class_name: ['button', 'button-primary'],
        html_content: build_save_button_html_content(t('stuck_modal_save'))
    });
    save_btn.addEventListener('click', () => {
        void (async () => {
            const raw = textarea.value || '';
            const description = host.Helpers?.trim_textarea_preserve_lines
                ? host.Helpers.trim_textarea_preserve_lines(raw)
                : raw.trim();
            apply_stuck_description_to_result_ref(host, description);
            if (is_debug_stuck_sync()) {
                consoleManager.log('[GV-Debug] Modal: Spara klickad, textlängd:', description.length);
            }
            await persist_stuck_modal_change_and_close(host, modal, stuck_btn, t);
        })();
    });
    const discard_btn = host.Helpers!.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: t('stuck_modal_discard')
    });
    discard_btn.addEventListener('click', () => modal.close(stuck_btn));
    actions_wrapper.appendChild(save_btn);
    actions_wrapper.appendChild(discard_btn);
    if ((existing_description || '').trim() !== '') {
        const problem_solved_btn = host.Helpers!.create_element('button', {
            class_name: ['button', 'button-default', 'modal-action-right'],
            attributes: { type: 'button' },
            text_content: t('stuck_modal_problem_solved')
        });
        problem_solved_btn.addEventListener('click', () => {
            void (async () => {
                apply_stuck_description_to_result_ref(host, '');
                if (is_debug_stuck_sync()) {
                    consoleManager.log('[GV-Debug] Modal: Problemet är löst klickad');
                }
                await persist_stuck_modal_change_and_close(host, modal, stuck_btn, t);
            })();
        });
        actions_wrapper.appendChild(problem_solved_btn);
    }
    container.appendChild(actions_wrapper);
}

export function handle_stuck_click(
    host: ChecklistEventHandlerHost,
    event: Event,
    stuck_btn: HTMLButtonElement
): void {
    event.preventDefault();
    if (!host.requirement_result_ref) return;

    const ModalComponent = app_runtime_refs.modal_component as {
        show?: (opts: { h1_text: string; message_text: string }, builder: (container: HTMLElement, modal: { close: (el: HTMLElement) => void }) => void) => void;
    } | null | undefined;
    if (!ModalComponent?.show || !host.Helpers?.create_element) return;

    const t = host.Translation.t;
    const existing_description = (typeof host.requirement_result_ref.stuckProblemDescription === 'string')
        ? host.requirement_result_ref.stuckProblemDescription
        : '';

    ModalComponent.show(
        { h1_text: t('stuck_modal_h1'), message_text: t('stuck_modal_intro') },
        (container: HTMLElement, modal: { close: (el: HTMLElement) => void }) => {
            const form_group = host.Helpers!.create_element('div', { class_name: 'form-group' });
            const label = host.Helpers!.create_element('label', {
                attributes: { for: 'stuck-problem-description' },
                text_content: t('stuck_modal_label')
            });
            form_group.appendChild(label);
            const textarea = host.Helpers!.create_element('textarea', {
                id: 'stuck-problem-description',
                class_name: 'form-control',
                attributes: { rows: '5' }
            }) as HTMLTextAreaElement;
            textarea.value = existing_description;
            if (host.Helpers?.init_auto_resize_for_textarea) {
                host.Helpers.init_auto_resize_for_textarea(textarea);
            }
            form_group.appendChild(textarea);
            container.appendChild(form_group);
            build_stuck_modal_actions(host, container, modal, textarea, stuck_btn, existing_description, t);
        }
    );
}

function build_copy_observation_modal_content(
    host: ChecklistEventHandlerHost,
    container: HTMLElement,
    modal: { close: (el: HTMLElement) => void },
    observations: string[],
    check_id: string,
    pc_id: string,
    copy_btn: HTMLButtonElement,
    t: (key: string) => string
): void {
    const fieldset = host.Helpers!.create_element('fieldset', {
        class_name: 'copy-observation-radio-group',
        attributes: { 'aria-label': t('copy_observation_modal_title') }
    });
    const radio_name = `copy-observation-${check_id}-${pc_id}`;
    observations.forEach((text, index) => {
        const id = `copy-obs-${check_id}-${pc_id}-${index}`;
        const label = host.Helpers!.create_element('label', {
            class_name: 'copy-observation-radio-option',
            attributes: { for: id }
        });
        const radio = host.Helpers!.create_element('input', {
            attributes: {
                type: 'radio',
                name: radio_name,
                id,
                value: String(index),
                checked: index === 0
            }
        });
        const text_span = host.Helpers!.create_element('span', {
            class_name: 'copy-observation-radio-text',
            text_content: text
        });
        label.appendChild(radio);
        label.appendChild(text_span);
        fieldset.appendChild(label);
    });
    container.appendChild(fieldset);

    const actions_wrapper = host.Helpers!.create_element('div', { class_name: 'modal-copy-observation-actions' });
    const paste_btn = host.Helpers!.create_element('button', {
        class_name: ['button', 'button-primary'],
        attributes: { type: 'button' },
        text_content: t('copy_observation_modal_paste')
    });
    paste_btn.addEventListener('click', () => {
        const selected = container.querySelector(`input[name="${CSS.escape(radio_name)}"]:checked`) as HTMLInputElement | null;
        if (selected) {
            const idx = parseInt(selected.value, 10);
            const text_to_paste = observations[idx];
            const textarea_id = `pc-observation-${check_id}-${pc_id}`;
            const textarea = host.container_ref?.querySelector(`#${CSS.escape(textarea_id)}`) as HTMLTextAreaElement | null;
            if (textarea && typeof text_to_paste === 'string') {
                const chk_paste = resolve_map_entry(host.requirement_result_ref?.checkResults, check_id);
                const check_result_paste = chk_paste?.value as { passCriteria?: Record<string, unknown> } | undefined;
                const pc_paste = check_result_paste?.passCriteria
                    ? resolve_map_entry(check_result_paste.passCriteria, pc_id)
                    : null;
                if (pc_paste?.value) {
                    (pc_paste.value as { observationDetail?: string }).observationDetail = text_to_paste;
                    const ts = host.Helpers?.get_current_iso_datetime_utc
                        ? host.Helpers.get_current_iso_datetime_utc()
                        : new Date().toISOString();
                    (pc_paste.value as { timestamp?: string; updatedBy?: string }).updatedBy = get_current_user_name();
                    (pc_paste.value as { timestamp?: string; updatedBy?: string }).timestamp = ts;
                }
                textarea.value = text_to_paste;
                if (host.on_observation_blur_commit_callback) {
                    host.on_observation_blur_commit_callback();
                }
            }
        }
        modal.close(copy_btn);
    });
    const close_btn = host.Helpers!.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: t('copy_observation_modal_close')
    });
    close_btn.addEventListener('click', () => modal.close(copy_btn));
    actions_wrapper.appendChild(paste_btn);
    actions_wrapper.appendChild(close_btn);
    container.appendChild(actions_wrapper);
}

export function handle_copy_observation_click(
    host: ChecklistEventHandlerHost,
    event: Event,
    copy_btn: HTMLButtonElement
): void {
    event.preventDefault();
    const pc_item = copy_btn.closest('.pass-criterion-item[data-pc-id]');
    const check_item = copy_btn.closest('.check-item[data-check-id]');
    if (!pc_item || !check_item) return;

    const pc_id = (pc_item as HTMLElement).dataset.pcId!;
    const check_id = (check_item as HTMLElement).dataset.checkId!;
    const observations = host.get_observations_from_other_samples(check_id, pc_id);

    const ModalComponent = app_runtime_refs.modal_component as {
        show?: (opts: { h1_text: string; message_text: string }, builder: (container: HTMLElement, modal: { close: (el: HTMLElement) => void }) => void) => void;
    } | null | undefined;
    if (!ModalComponent?.show || !host.Helpers?.create_element) return;

    const t = host.Translation.t;

    if (observations.length === 0) {
        ModalComponent.show(
            { h1_text: t('copy_observation_modal_title'), message_text: t('copy_observation_modal_empty') },
            (container: HTMLElement, modal: { close: (el: HTMLElement) => void }) => {
                const close_btn = host.Helpers!.create_element('button', {
                    class_name: ['button', 'button-default'],
                    attributes: { type: 'button' },
                    text_content: t('copy_observation_modal_close')
                });
                close_btn.addEventListener('click', () => modal.close(copy_btn));
                container.appendChild(close_btn);
            }
        );
        return;
    }

    ModalComponent.show(
        { h1_text: t('copy_observation_modal_title'), message_text: '' },
        (container: HTMLElement, modal: { close: (el: HTMLElement) => void }) => {
            build_copy_observation_modal_content(
                host, container, modal, observations, check_id, pc_id, copy_btn, t
            );
        }
    );
}


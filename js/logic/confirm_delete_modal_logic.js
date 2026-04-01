// js/logic/confirm_delete_modal_logic.js

import * as Helpers from '../utils/helpers.js';
import { get_translation_t } from '../utils/translation_access.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';

/**
 * Bygger varningstext för radering baserat på typ (requirement, check, criterion).
 * @param {string} type - 'requirement' | 'check' | 'criterion'
 * @param {Object} params - { reqId, checkId?, pcId? }
 * @param {Function} getState
 * @param {Object} Translation - { t }
 * @param {Object} Helpers - { escape_html }
 * @returns {string|null} - Varningstext eller null om ogiltig
 */
export function build_delete_warning_text(type, params, getState, Translation, _Helpers) {
    const state = getState?.();
    const t = Translation?.t || (k => k);
    const { reqId, checkId, pcId } = params || {};
    const requirement = state?.ruleFileContent?.requirements?.[reqId];

    if (!requirement) return null;

    switch (type) {
        case 'requirement': {
            const intro = t('rulefile_confirm_delete_intro');
            const item = requirement.title || '';
            const warning = t('rulefile_confirm_delete_warning');
            return `${intro} ${item}\n\n${warning}`;
        }
        case 'check': {
            const check = requirement.checks?.find(c => c.id === checkId);
            if (!check) return null;
            const intro = t('confirm_delete_check_intro');
            const item = check.condition || '';
            return `${intro} ${item}`;
        }
        case 'criterion': {
            const parentCheck = requirement.checks?.find(c => c.id === checkId);
            const criterion = parentCheck?.passCriteria?.find(pc => pc.id === pcId);
            if (!criterion) return null;
            const intro = t('confirm_delete_criterion_intro');
            const item = criterion.requirement || '';
            return `${intro} ${item}`;
        }
        default:
            return null;
    }
}

/**
 * Hittar föregående fokuserbara element innan delete-knappen i tabordning.
 * @param {HTMLElement} delete_button
 * @returns {HTMLElement|null}
 */
function get_previous_focusable(delete_button) {
    const focusables = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const list = Array.from(focusables).filter(
        el => !el.hasAttribute('aria-disabled') && document.contains(el)
    );
    const idx = list.indexOf(delete_button);
    return idx > 0 ? list[idx - 1] : null;
}

/**
 * Visar bekräftelsemodal för radering.
 * @param {Object} opts
 * @param {string} [opts.h1_text] - Rubrik i modalen (annars confirm_delete_modal_title)
 * @param {string} opts.warning_text - Varningstexten i modalen
 * @param {HTMLElement} opts.delete_button - Ta bort-knappen (fokus återgår hit vid "Nej, behåll")
 * @param {Function} opts.on_confirm - Callback vid "Ja, ta bort"
 * @param {HTMLElement} [opts.focusOnConfirm] - Element att fokusera vid bekräftelse (t.ex. när raderat innehåll tas bort)
 * @param {string} [opts.yes_label] - Anpassad text för bekräftelseknappen (t.ex. "Radera")
 * @param {string} [opts.no_label] - Anpassad text för avbryt-knappen (t.ex. "Behåll")
 */
export function show_confirm_delete_modal({ h1_text, warning_text, delete_button, on_confirm, focusOnConfirm, yes_label, no_label }) {
    const ModalComponent = app_runtime_refs.modal_component;
    const t = get_translation_t();

    if (!ModalComponent?.show || !Helpers?.create_element) return;

    const previous_focusable = get_previous_focusable(delete_button);
    const focus_on_confirm = focusOnConfirm && document.contains(focusOnConfirm) ? focusOnConfirm : previous_focusable;
    const title_text = h1_text || t('confirm_delete_modal_title');

    ModalComponent.show(
        {
            h1_text: title_text,
            message_text: warning_text || '',
        },
        (container, modal) => {
            const buttons_wrapper = Helpers.create_element('div', {
                class_name: 'modal-confirm-actions',
            });

            const yes_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-danger'],
                text_content: yes_label ?? t('confirm_delete_modal_yes'),
            });
            yes_btn.addEventListener('click', () => {
                const focus_el = focusOnConfirm ? focus_on_confirm : previous_focusable;
                modal.close(focus_el, {
                    onClosed: () => {
                        if (typeof on_confirm === 'function') on_confirm();
                    }
                });
            });

            const no_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                text_content: no_label ?? t('confirm_delete_modal_no'),
            });
            no_btn.addEventListener('click', () => modal.close(delete_button));

            buttons_wrapper.append(yes_btn, no_btn);
            container.appendChild(buttons_wrapper);
        }
    );
}

// js/logic/confirm_delete_modal_logic.js

/**
 * Bygger varningstext för radering baserat på typ (requirement, check, criterion).
 * @param {string} type - 'requirement' | 'check' | 'criterion'
 * @param {Object} params - { reqId, checkId?, pcId? }
 * @param {Function} getState
 * @param {Object} Translation - { t }
 * @param {Object} Helpers - { escape_html }
 * @returns {string|null} - Varningstext eller null om ogiltig
 */
export function build_delete_warning_text(type, params, getState, Translation, Helpers) {
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
 */
export function show_confirm_delete_modal({ h1_text, warning_text, delete_button, on_confirm, focusOnConfirm }) {
    const ModalComponent = window.ModalComponent;
    const Helpers = window.Helpers;
    const t = window.Translation?.t || (k => k);

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
                text_content: t('confirm_delete_modal_yes'),
            });
            yes_btn.addEventListener('click', () => {
                if (typeof on_confirm === 'function') on_confirm();
                modal.close(focusOnConfirm ? focus_on_confirm : previous_focusable);
            });

            const no_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                text_content: t('confirm_delete_modal_no'),
            });
            no_btn.addEventListener('click', () => modal.close());

            buttons_wrapper.append(yes_btn, no_btn);
            container.appendChild(buttons_wrapper);
        }
    );
}

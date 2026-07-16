/**
 * @fileoverview Modal för redigering av granskningstyp.
 */
import type { RulefileAuditType } from '../../../shared/rulefile/rulefile_audit_types.js';

type ModalCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
};

type TaxonomyRow = { id?: string; label?: string };

const MODAL_TRANSITION_MS = 500;

function prefers_reduced_modal_motion(): boolean {
    if (typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function reveal_modal_dialog(dialog: HTMLDialogElement): void {
    dialog.showModal();
    if (prefers_reduced_modal_motion()) {
        dialog.classList.add('modal-dialog--visible');
        return;
    }
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            dialog.classList.add('modal-dialog--visible');
        });
    });
}

function close_modal_dialog(dialog: HTMLDialogElement): void {
    const transition_ms = prefers_reduced_modal_motion() ? 0 : MODAL_TRANSITION_MS;
    if (transition_ms === 0) {
        dialog.close();
        return;
    }
    dialog.classList.remove('modal-dialog--visible');
    dialog.classList.add('modal-dialog--closing');
    const timeout_id = window.setTimeout(() => dialog.close(), transition_ms + 50);
    dialog.addEventListener('transitionend', function on_transition_end(event: TransitionEvent) {
        if (event.target !== dialog || event.propertyName !== 'opacity') return;
        window.clearTimeout(timeout_id);
        dialog.removeEventListener('transitionend', on_transition_end);
        dialog.close();
    });
}

function build_taxonomy_select(
    Helpers: ModalCtx['Helpers'],
    id: string,
    taxonomies: TaxonomyRow[],
    selected_id: string
): HTMLSelectElement {
    const select = Helpers.create_element('select', {
        class_name: 'form-control',
        attributes: { id },
    }) as HTMLSelectElement;
    taxonomies.forEach((taxonomy) => {
        const tax_id = String(taxonomy.id ?? '').trim();
        if (!tax_id) return;
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: tax_id },
                text_content: taxonomy.label || tax_id,
            })
        );
    });
    select.value = selected_id;
    return select;
}

function build_name_field(
    Helpers: ModalCtx['Helpers'],
    t: ModalCtx['Translation']['t'],
    id: string,
    value: string
): HTMLElement {
    const field = Helpers.create_element('div', { class_name: 'form-group' });
    field.appendChild(
        Helpers.create_element('label', {
            attributes: { for: id },
            text_content: t('rulefile_classifications_audit_types_name_label'),
        })
    );
    const input = Helpers.create_element('input', {
        class_name: 'form-control',
        attributes: { id, type: 'text' },
    }) as HTMLInputElement;
    input.value = value;
    field.appendChild(input);
    return field;
}

function build_taxonomy_field(
    Helpers: ModalCtx['Helpers'],
    t: ModalCtx['Translation']['t'],
    id: string,
    taxonomies: TaxonomyRow[],
    selected_id: string
): HTMLElement {
    const field = Helpers.create_element('div', { class_name: 'form-group' });
    field.appendChild(
        Helpers.create_element('label', {
            attributes: { for: id },
            text_content: t('rulefile_classifications_audit_types_taxonomy_label'),
        })
    );
    field.appendChild(build_taxonomy_select(Helpers, id, taxonomies, selected_id));
    return field;
}

export function open_audit_type_edit_modal(
    ctx: ModalCtx,
    initial_row: Partial<RulefileAuditType>,
    taxonomies: TaxonomyRow[],
    trigger_button: HTMLButtonElement,
    on_saved: (row: RulefileAuditType) => void
): void {
    const { Helpers, Translation: { t } } = ctx;
    const dialog_id = `audit-type-dialog-${Math.random().toString(36).substring(2, 8)}`;
    const name_id = `${dialog_id}-name`;
    const taxonomy_field_id = `${dialog_id}-taxonomy`;

    const dialog = Helpers.create_element('dialog', {
        class_name: ['modal-dialog', 'audit-type-edit-dialog'],
        attributes: { 'aria-labelledby': `${dialog_id}-title` },
    }) as HTMLDialogElement;

    const form = Helpers.create_element('form', {
        class_name: 'audit-type-edit-form',
        attributes: { method: 'dialog' },
    });
    const title = Helpers.create_element('h2', {
        attributes: { id: `${dialog_id}-title`, tabindex: '-1' },
        text_content: t('rulefile_classifications_audit_types_modal_title'),
    });
    form.appendChild(title);
    form.appendChild(build_name_field(Helpers, t, name_id, initial_row.label ?? ''));
    form.appendChild(
        build_taxonomy_field(Helpers, t, taxonomy_field_id, taxonomies, initial_row.taxonomyId ?? '')
    );

    const actions = Helpers.create_element('div', { class_name: 'form-actions' });
    const save_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-primary'],
        attributes: { type: 'submit' },
        text_content: t('save_changes_button'),
    });
    const close_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: t('rulefile_classifications_audit_types_modal_close'),
    });
    actions.append(save_btn, close_btn);
    form.appendChild(actions);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const name_input = form.querySelector(`#${CSS.escape(name_id)}`) as HTMLInputElement;
        const taxonomy_select = form.querySelector(
            `#${CSS.escape(taxonomy_field_id)}`
        ) as HTMLSelectElement;
        on_saved({
            id: initial_row.id ?? '',
            label: name_input.value,
            taxonomyId: taxonomy_select.value,
        });
        close_modal_dialog(dialog);
    });
    close_btn.addEventListener('click', () => close_modal_dialog(dialog));
    dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        close_modal_dialog(dialog);
    });
    dialog.addEventListener('close', () => {
        dialog.remove();
        if (document.contains(trigger_button)) {
            trigger_button.focus({ preventScroll: true });
        }
    });

    dialog.appendChild(form);
    document.body.appendChild(dialog);
    reveal_modal_dialog(dialog);
    title.focus({ preventScroll: true });
}

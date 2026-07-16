/**
 * @fileoverview Bristtyper per krav: visning, redigering och modal.
 */
import { normalize_requirements_to_record } from '../../logic/requirement_lookup.js';
import { get_requirement_display_label } from '../../logic/requirement_display_name.js';
import {
    append_classifications_table_filter_to_layout,
    append_classifications_table_scroll_area,
    attach_classifications_table_row_filter,
    create_classifications_table,
    create_classifications_table_layout,
    type ClassificationsTableColumn,
} from './rulefile_classifications_table_ui.js';
import { create_rulefile_classifications_back_row } from './rulefile_classifications_nav.js';
import { resolve_requirement_deficiency_type_display } from '../../export/export_deficiency_types_collect.js';

type DeficiencyTypeNode = { PrimaryText?: string; SecondaryText?: string };

type ViewCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        escape_html?: (value: string) => string;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    router?: (view: string, params?: Record<string, string>) => void;
};

type RequirementRow = {
    key: string;
    title: string;
    requirement: Record<string, unknown>;
};

function read_deficiency_type(requirement: Record<string, unknown>): DeficiencyTypeNode {
    const resolved = resolve_requirement_deficiency_type_display(requirement);
    if (resolved) {
        return { PrimaryText: resolved.primary, SecondaryText: resolved.secondary };
    }
    const node = requirement.DeficiencyType as DeficiencyTypeNode | undefined;
    return node && typeof node === 'object' ? node : {};
}

function build_rows(requirements: unknown): RequirementRow[] {
    const record = normalize_requirements_to_record(requirements);
    return Object.entries(record)
        .map(([key, requirement]) => ({
            key,
            title: get_requirement_display_label(requirement as Record<string, unknown>),
            requirement: requirement as Record<string, unknown>,
        }))
        .sort((a, b) => a.title.localeCompare(b.title, 'sv'));
}

function format_deficiency_part_line(
    t: ViewCtx['Translation']['t'],
    text: string | undefined,
    has_any_text: boolean
): string {
    const trimmed = text?.trim() ?? '';
    if (trimmed) return trimmed;
    return has_any_text ? '' : t('rulefile_metadata_empty_value');
}

function build_deficiency_text_cell(
    Helpers: ViewCtx['Helpers'],
    t: ViewCtx['Translation']['t'],
    deficiency: DeficiencyTypeNode
): HTMLElement {
    const primary = deficiency.PrimaryText?.trim() ?? '';
    const secondary = deficiency.SecondaryText?.trim() ?? '';
    const has_any_text = Boolean(primary || secondary);
    const text_cell = Helpers.create_element('td', { class_name: 'deficiency-types-text-cell' });
    text_cell.appendChild(
        Helpers.create_element('p', {
            class_name: 'deficiency-types-part-line',
            text_content: format_deficiency_part_line(t, primary, has_any_text),
        })
    );
    text_cell.appendChild(
        Helpers.create_element('p', {
            class_name: 'deficiency-types-part-line',
            text_content: format_deficiency_part_line(t, secondary, has_any_text),
        })
    );
    return text_cell;
}

function build_deficiency_actions_cell(
    ctx: ViewCtx,
    row: RequirementRow,
    rule_file_content: Record<string, unknown>,
    container: HTMLElement,
    options: { read_only?: boolean; on_change?: () => void }
): HTMLElement {
    const { Helpers, Translation: { t } } = ctx;
    const actions = Helpers.create_element('td', { class_name: 'deficiency-types-actions-cell' });
    const edit_label = t('edit_button_label');
    const edit_icon = Helpers.get_icon_svg
        ? `<span aria-hidden="true">${Helpers.get_icon_svg('edit', ['currentColor'], 16)}</span>`
        : '';
    const edit_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-secondary', 'button-small', 'deficiency-types-row-edit-button'],
        attributes: { type: 'button' },
        html_content: `<span>${edit_label}</span>${edit_icon}`,
    }) as HTMLButtonElement;
    edit_btn.addEventListener('click', () => {
        open_deficiency_type_modal(ctx, row, edit_btn, () => {
            options.on_change?.();
            render_deficiency_types_table(ctx, container, rule_file_content, options);
        });
    });
    actions.appendChild(edit_btn);
    return actions;
}

function render_deficiency_types_table(
    ctx: ViewCtx,
    container: HTMLElement,
    rule_file_content: Record<string, unknown>,
    options: { read_only?: boolean; on_change?: () => void } = {}
): void {
    const { Helpers, Translation: { t } } = ctx;
    container.innerHTML = '';
    const rows = build_rows(rule_file_content.requirements);

    const filter_input = append_classifications_table_filter_to_layout(container, ctx, rows.length, {
        label_key: 'rulefile_classifications_deficiency_types_filter_label',
        id_prefix: 'deficiency-types-filter',
    });

    const columns: ClassificationsTableColumn[] = [
        {
            text: t('rulefile_classifications_mapping_requirement_column'),
            class_name: 'deficiency-types-requirement-header',
        },
        {
            text: t('rulefile_classifications_deficiency_types_text_column'),
            class_name: 'deficiency-types-text-header',
        },
    ];
    if (!options.read_only) {
        columns.push({
            text: t('rulefile_classifications_deficiency_types_actions_column'),
            class_name: 'deficiency-types-actions-header',
        });
    }

    const { table, row_elements } = create_classifications_table(ctx, {
        caption: t('rulefile_classifications_deficiency_types_table_caption'),
        extra_table_classes: 'deficiency-types-table',
        columns,
        rows: rows.map((row) => {
            const deficiency = read_deficiency_type(row.requirement);
            const cells = [build_deficiency_text_cell(Helpers, t, deficiency)];
            if (!options.read_only) {
                cells.push(
                    build_deficiency_actions_cell(ctx, row, rule_file_content, container, options)
                );
            }
            return {
                key: row.key,
                row_header_class: 'deficiency-types-row-header',
                row_header_text: row.title || row.key,
                cells,
            };
        }),
    });

    append_classifications_table_scroll_area(container, Helpers, table, 'deficiency-types-scroll-wrapper');
    if (filter_input) {
        attach_classifications_table_row_filter(filter_input, row_elements);
    }
}

export function render_deficiency_types_view_section(
    ctx: ViewCtx,
    rule_file_content: Record<string, unknown>,
    options: { show_back?: boolean } = {}
): HTMLElement {
    const { Helpers, Translation: { t }, router } = ctx;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });
    if (options.show_back !== false && router) {
        section.appendChild(create_rulefile_classifications_back_row({ Helpers, Translation: ctx.Translation, router }));
    }
    section.appendChild(
        Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('rulefile_classifications_deficiency_types_view_intro'),
        })
    );
    const layout = create_classifications_table_layout(Helpers);
    layout.classList.add('deficiency-types-table-wrapper');
    render_deficiency_types_table(ctx, layout, rule_file_content, { read_only: true });
    section.appendChild(layout);
    return section;
}

export function render_deficiency_types_editor(
    ctx: ViewCtx,
    container: HTMLElement,
    working_rulefile: Record<string, unknown>,
    options: { on_change?: () => void } = {}
): { apply_changes: () => Record<string, unknown> } {
    container.innerHTML = '';
    const state = { working_rulefile: { ...working_rulefile } };
    const req_record = normalize_requirements_to_record(state.working_rulefile.requirements);
    state.working_rulefile.requirements = req_record;

    container.appendChild(
        ctx.Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: ctx.Translation.t('rulefile_classifications_deficiency_types_edit_intro'),
        })
    );

    const table_host = create_classifications_table_layout(ctx.Helpers);
    table_host.classList.add('deficiency-types-table-wrapper');
    container.appendChild(table_host);

    const rerender = () => {
        render_deficiency_types_table(ctx, table_host, state.working_rulefile, {
            read_only: false,
            on_change: options.on_change,
        });
    };
    rerender();

    return {
        apply_changes: () => state.working_rulefile,
    };
}

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

function open_deficiency_type_modal(
    ctx: ViewCtx,
    row: RequirementRow,
    trigger_button: HTMLButtonElement,
    on_saved: () => void
): void {
    const { Helpers, Translation: { t } } = ctx;
    const deficiency = read_deficiency_type(row.requirement);
    if (!row.requirement.DeficiencyType || typeof row.requirement.DeficiencyType !== 'object') {
        row.requirement.DeficiencyType = {};
    }
    const node = row.requirement.DeficiencyType as DeficiencyTypeNode;

    const dialog = Helpers.create_element('dialog', {
        class_name: ['modal-dialog', 'deficiency-type-edit-dialog'],
        attributes: { 'aria-labelledby': 'deficiency-type-dialog-title' },
    }) as HTMLDialogElement;

    const form = Helpers.create_element('form', { class_name: 'deficiency-type-edit-form', attributes: { method: 'dialog' } });
    const title = Helpers.create_element('h2', {
        attributes: { id: 'deficiency-type-dialog-title', tabindex: '-1' },
        text_content: t('rulefile_classifications_deficiency_types_modal_title'),
    });
    form.appendChild(title);
    form.appendChild(
        Helpers.create_element('p', {
            class_name: 'deficiency-type-requirement-label',
            text_content: row.title || row.key,
        })
    );

    const part1_id = `deficiency-part1-${row.key}`;
    const part2_id = `deficiency-part2-${row.key}`;
    form.appendChild(build_textarea_field(Helpers, t, part1_id, t('rulefile_classifications_deficiency_types_part1_label'), deficiency.PrimaryText ?? ''));
    form.appendChild(build_textarea_field(Helpers, t, part2_id, t('rulefile_classifications_deficiency_types_part2_label'), deficiency.SecondaryText ?? ''));

    const actions = Helpers.create_element('div', { class_name: 'form-actions' });
    const save_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-primary'],
        attributes: { type: 'submit' },
        text_content: t('save_changes_button'),
    });
    const close_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: t('rulefile_classifications_deficiency_types_modal_close'),
    });
    actions.append(save_btn, close_btn);
    form.appendChild(actions);

    let did_save = false;
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const part1 = (form.querySelector(`#${CSS.escape(part1_id)}`) as HTMLTextAreaElement).value;
        const part2 = (form.querySelector(`#${CSS.escape(part2_id)}`) as HTMLTextAreaElement).value;
        node.PrimaryText = part1;
        node.SecondaryText = part2;
        did_save = true;
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
        if (did_save) {
            on_saved();
        }
    });

    dialog.appendChild(form);
    document.body.appendChild(dialog);
    reveal_modal_dialog(dialog);
    title.focus({ preventScroll: true });
}

function build_textarea_field(
    Helpers: ViewCtx['Helpers'],
    t: ViewCtx['Translation']['t'],
    id: string,
    label: string,
    value: string
): HTMLElement {
    const field = Helpers.create_element('div', { class_name: 'form-group' });
    field.appendChild(Helpers.create_element('label', { attributes: { for: id }, text_content: label }));
    const textarea = Helpers.create_element('textarea', {
        class_name: 'form-control',
        attributes: { id, rows: '2' },
    }) as HTMLTextAreaElement;
    textarea.value = value;
    field.appendChild(textarea);
    return field;
}

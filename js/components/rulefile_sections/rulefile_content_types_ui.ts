/**
 * @fileoverview Innehållstyper i regelfilen: tabellvy med grupp, beskrivning, kravantal och åtgärder.
 */
import { resolve_content_types } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import {
    get_requirements_count_by_content_type_id,
    remove_content_type_from_requirements,
} from '../../utils/content_types_helper.js';
import { show_confirm_delete_modal } from '../../logic/confirm_delete_modal_logic.js';
import {
    append_classifications_table_filter_to_layout,
    append_classifications_table_scroll_area,
    attach_classifications_table_row_filter,
    create_classifications_table,
    create_classifications_table_layout,
    type ClassificationsTableColumn,
} from './rulefile_classifications_table_ui.js';
import {
    content_type_create_route_params,
    content_type_edit_route_params,
    find_content_type_by_child_id,
    read_content_type_parents,
    type ContentTypeChild,
} from './rulefile_content_type_keys.js';

type ContentTypeTableRow = {
    key: string;
    parent_index: number;
    child_index: number;
    type_text: string;
    group_text: string;
    description_text: string;
    child_id: string;
    requirements_count: number;
};

type ViewCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    router?: (view: string, params?: Record<string, string>) => void;
};

type OverviewOptions = {
    on_change?: () => void;
    get_rule_file_content?: () => Record<string, unknown>;
    on_rule_file_content_change?: (rule_file_content: Record<string, unknown>) => void;
};

function build_table_rows(
    metadata: Record<string, unknown>,
    rule_file_content: Record<string, unknown>
): ContentTypeTableRow[] {
    const parents = read_content_type_parents(metadata);
    const rows: ContentTypeTableRow[] = [];

    parents.forEach((parent, parent_index) => {
        const group_text = (parent.text || parent.id || '').trim();
        const children = Array.isArray(parent.types) ? parent.types : [];
        children.forEach((child, child_index) => {
            const child_id = String(child?.id ?? '').trim();
            const type_text = (child?.text || child_id || '').trim();
            if (!type_text && !child_id && !child?.description?.trim()) return;
            rows.push({
                key: child_id || `parent-${parent_index}-child-${child_index}`,
                parent_index,
                child_index,
                type_text,
                group_text,
                description_text: (child?.description || '').trim(),
                child_id,
                requirements_count: child_id
                    ? get_requirements_count_by_content_type_id(rule_file_content, child_id)
                    : 0,
            });
        });
    });

    return rows.sort((a, b) => {
        const group_cmp = a.group_text.localeCompare(b.group_text, 'sv');
        if (group_cmp !== 0) return group_cmp;
        return a.type_text.localeCompare(b.type_text, 'sv');
    });
}

function build_text_cell(Helpers: ViewCtx['Helpers'], t: ViewCtx['Translation']['t'], text: string): HTMLElement {
    return Helpers.create_element('td', {
        class_name: 'content-types-description-cell',
        text_content: text.trim() ? text : t('rulefile_metadata_empty_value'),
    });
}

function build_group_cell(
    Helpers: ViewCtx['Helpers'],
    t: ViewCtx['Translation']['t'],
    group_text: string
): HTMLElement {
    return Helpers.create_element('td', {
        class_name: 'content-types-group-cell',
        text_content: group_text.trim() ? group_text : t('rulefile_metadata_empty_value'),
    });
}

function build_requirements_count_cell(Helpers: ViewCtx['Helpers'], count: number): HTMLElement {
    return Helpers.create_element('td', {
        class_name: 'content-types-requirements-count-cell',
        text_content: String(count),
    });
}

function build_edit_button(
    ctx: ViewCtx,
    row: ContentTypeTableRow,
    on_edit: (row: ContentTypeTableRow) => void
): HTMLButtonElement {
    const { Helpers, Translation: { t } } = ctx;
    const edit_label = t('edit_button_label');
    const edit_icon = Helpers.get_icon_svg
        ? `<span aria-hidden="true">${Helpers.get_icon_svg('edit', ['currentColor'], 16)}</span>`
        : '';
    const edit_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-secondary', 'button-small', 'content-types-row-edit-button'],
        attributes: { type: 'button' },
        html_content: `<span>${edit_label}</span>${edit_icon}`,
    }) as HTMLButtonElement;
    edit_btn.addEventListener('click', () => on_edit(row));
    return edit_btn;
}

function build_delete_button(
    ctx: ViewCtx,
    delete_handler: (delete_button: HTMLButtonElement) => void
): HTMLButtonElement {
    const { Helpers, Translation: { t } } = ctx;
    const delete_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-danger', 'button-small', 'content-types-row-delete-button'],
        attributes: { type: 'button' },
        text_content: t('rulefile_content_types_remove'),
    }) as HTMLButtonElement;
    delete_btn.addEventListener('click', () => delete_handler(delete_btn));
    return delete_btn;
}

function build_actions_cell(
    ctx: ViewCtx,
    row: ContentTypeTableRow,
    on_edit: (row: ContentTypeTableRow) => void,
    delete_handler: (delete_button: HTMLButtonElement) => void
): HTMLElement {
    const { Helpers } = ctx;
    const actions = Helpers.create_element('td', { class_name: 'content-types-actions-cell' });
    const stack = Helpers.create_element('div', { class_name: 'content-types-actions-stack' });
    stack.appendChild(build_edit_button(ctx, row, on_edit));
    stack.appendChild(build_delete_button(ctx, delete_handler));
    actions.appendChild(stack);
    return actions;
}

function remove_content_type_row(
    working_metadata: Record<string, unknown>,
    parent_index: number,
    child_index: number
): ContentTypeChild | null {
    const parents = read_content_type_parents(working_metadata);
    const parent = parents[parent_index];
    if (!parent || !Array.isArray(parent.types)) return null;
    const removed = parent.types[child_index] ?? null;
    parent.types.splice(child_index, 1);
    working_metadata.contentTypes = parents;
    return removed;
}

function confirm_delete_content_type(
    ctx: ViewCtx,
    row: ContentTypeTableRow,
    delete_button: HTMLButtonElement,
    on_confirmed: () => void
): void {
    const { Translation: { t } } = ctx;
    const display_name = row.type_text || row.child_id || t('rulefile_metadata_untitled_item');
    const warning_text = row.requirements_count > 0
        ? t('modal_message_delete_content_type_with_requirements', {
            name: display_name,
            count: row.requirements_count,
        })
        : t('modal_message_delete_content_type', { name: display_name });

    show_confirm_delete_modal({
        h1_text: t('modal_h1_delete_content_type'),
        warning_text,
        delete_button,
        on_confirm: on_confirmed,
    });
}

function render_empty_table(ctx: ViewCtx, container: HTMLElement): void {
    const { Helpers, Translation: { t } } = ctx;
    const columns: ClassificationsTableColumn[] = [
        { text: t('rulefile_content_types_type_column'), class_name: 'content-types-type-header' },
        { text: t('rulefile_content_types_group_column'), class_name: 'content-types-group-header' },
        { text: t('rulefile_content_types_description_column'), class_name: 'content-types-description-header' },
        {
            text: t('rulefile_content_types_requirements_count_column'),
            class_name: 'content-types-requirements-count-header',
        },
        { text: t('rulefile_content_types_actions_column'), class_name: 'content-types-actions-header' },
    ];
    const { table } = create_classifications_table(ctx, {
        caption: t('rulefile_content_types_table_caption'),
        extra_table_classes: 'content-types-table',
        columns,
        rows: [],
    });
    append_classifications_table_scroll_area(container, Helpers, table, 'content-types-scroll-wrapper');
}

function render_content_types_table(
    ctx: ViewCtx,
    container: HTMLElement,
    working_metadata: Record<string, unknown>,
    rule_file_content: Record<string, unknown>,
    options: OverviewOptions = {}
): void {
    const { Helpers, Translation: { t }, router } = ctx;
    container.innerHTML = '';
    const rows = build_table_rows(working_metadata, rule_file_content);

    if (rows.length === 0) {
        render_empty_table(ctx, container);
        return;
    }

    const columns: ClassificationsTableColumn[] = [
        { text: t('rulefile_content_types_type_column'), class_name: 'content-types-type-header' },
        { text: t('rulefile_content_types_group_column'), class_name: 'content-types-group-header' },
        { text: t('rulefile_content_types_description_column'), class_name: 'content-types-description-header' },
        {
            text: t('rulefile_content_types_requirements_count_column'),
            class_name: 'content-types-requirements-count-header',
        },
        { text: t('rulefile_content_types_actions_column'), class_name: 'content-types-actions-header' },
    ];

    const rerender = () => {
        render_content_types_table(ctx, container, working_metadata, rule_file_content, options);
    };

    const on_edit = (row: ContentTypeTableRow) => {
        if (!router) return;
        const target_id = row.child_id || row.key;
        router('rulefile_sections', content_type_edit_route_params(target_id));
    };

    const filter_input = append_classifications_table_filter_to_layout(container, ctx, rows.length, {
        label_key: 'rulefile_content_types_filter_label',
        id_prefix: 'content-types-filter',
        min_rows: 3,
    });

    const { table, row_elements } = create_classifications_table(ctx, {
        caption: t('rulefile_content_types_table_caption'),
        extra_table_classes: 'content-types-table',
        columns,
        rows: rows.map((row) => ({
            key: row.key,
            row_header_class: 'content-types-row-header',
            row_header_text: row.type_text || t('rulefile_metadata_untitled_item'),
            cells: [
                build_group_cell(Helpers, t, row.group_text),
                build_text_cell(Helpers, t, row.description_text),
                build_requirements_count_cell(Helpers, row.requirements_count),
                build_actions_cell(ctx, row, on_edit, (delete_button) => {
                    confirm_delete_content_type(ctx, row, delete_button, () => {
                        const removed = remove_content_type_row(
                            working_metadata,
                            row.parent_index,
                            row.child_index
                        );
                        const child_id = String(removed?.id ?? row.child_id).trim();
                        if (child_id && options.get_rule_file_content && options.on_rule_file_content_change) {
                            const current = options.get_rule_file_content();
                            const updated = remove_content_type_from_requirements(current, child_id);
                            options.on_rule_file_content_change(updated);
                        }
                        options.on_change?.();
                        rerender();
                    });
                }),
            ],
        })),
    });

    append_classifications_table_scroll_area(container, Helpers, table, 'content-types-scroll-wrapper');
    if (filter_input) {
        attach_classifications_table_row_filter(filter_input, row_elements);
    }
}

export function render_content_types_overview(
    ctx: ViewCtx,
    container: HTMLElement,
    working_metadata: Record<string, unknown>,
    rule_file_content: Record<string, unknown>,
    options: OverviewOptions = {}
): void {
    const { Helpers } = ctx;
    container.innerHTML = '';
    const table_host = create_classifications_table_layout(Helpers);
    table_host.classList.add('content-types-table-wrapper');
    container.appendChild(table_host);
    render_content_types_table(ctx, table_host, working_metadata, rule_file_content, options);
}

export function navigate_to_content_type_create(ctx: ViewCtx): void {
    ctx.router?.('rulefile_sections', content_type_create_route_params());
}

export function resolve_content_type_row_for_edit(
    metadata: Record<string, unknown>,
    content_type_id: string
) {
    return find_content_type_by_child_id(metadata, content_type_id);
}

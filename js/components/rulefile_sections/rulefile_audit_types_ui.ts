/**
 * @fileoverview Visning och redigering av granskningstyper i regelfilen.
 */
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import {
    ensure_audit_types_for_edit,
    resolve_audit_types,
    type RulefileAuditType,
} from '../../../shared/rulefile/rulefile_audit_types.js';
import { show_confirm_delete_modal } from '../../logic/confirm_delete_modal_logic.js';
import {
    append_classifications_table_filter_to_layout,
    append_classifications_table_scroll_area,
    attach_classifications_table_row_filter,
    create_classifications_table,
    create_classifications_table_layout,
    type ClassificationsTableColumn,
} from './rulefile_classifications_table_ui.js';
import { create_rulefile_classifications_back_row } from './rulefile_classifications_nav.js';
import { open_audit_type_edit_modal } from './rulefile_audit_types_modal_ui.js';

type ViewCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    router?: (view: string, params?: Record<string, string>) => void;
};

type TaxonomyRow = { id?: string; label?: string };

function taxonomy_label_for_id(metadata: Record<string, unknown>, taxonomy_id: string): string {
    const taxonomies = resolve_taxonomies(metadata) as TaxonomyRow[];
    const match = taxonomies.find((row) => String(row.id ?? '').trim() === taxonomy_id);
    return match?.label || taxonomy_id;
}

function read_taxonomy_rows(metadata: Record<string, unknown>): TaxonomyRow[] {
    return resolve_taxonomies(metadata) as TaxonomyRow[];
}

function build_taxonomy_cell(
    Helpers: ViewCtx['Helpers'],
    t: ViewCtx['Translation']['t'],
    metadata: Record<string, unknown>,
    taxonomy_id: string
): HTMLElement {
    const label = taxonomy_label_for_id(metadata, taxonomy_id);
    return Helpers.create_element('td', {
        class_name: 'audit-types-taxonomy-cell',
        text_content: label.trim() ? label : t('rulefile_metadata_empty_value'),
    });
}

function build_edit_button(
    ctx: ViewCtx,
    row: RulefileAuditType,
    taxonomies: TaxonomyRow[],
    on_saved: (saved_row: RulefileAuditType) => void
): HTMLButtonElement {
    const { Helpers, Translation: { t } } = ctx;
    const edit_label = t('edit_button_label');
    const edit_icon = Helpers.get_icon_svg
        ? `<span aria-hidden="true">${Helpers.get_icon_svg('edit', ['currentColor'], 16)}</span>`
        : '';
    const edit_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-secondary', 'button-small', 'audit-types-row-edit-button'],
        attributes: { type: 'button' },
        html_content: `<span>${edit_label}</span>${edit_icon}`,
    }) as HTMLButtonElement;
    edit_btn.addEventListener('click', () => {
        open_audit_type_edit_modal(ctx, row, taxonomies, edit_btn, (saved_row) => {
            on_saved({ ...saved_row, id: row.id });
        });
    });
    return edit_btn;
}

function build_delete_button(
    ctx: ViewCtx,
    delete_handler: (delete_button: HTMLButtonElement) => void
): HTMLButtonElement {
    const { Helpers, Translation: { t } } = ctx;
    const delete_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-danger', 'button-small', 'audit-types-row-delete-button'],
        attributes: { type: 'button' },
        text_content: t('rulefile_classifications_audit_types_remove'),
    }) as HTMLButtonElement;
    delete_btn.addEventListener('click', () => delete_handler(delete_btn));
    return delete_btn;
}

function build_actions_cell(
    ctx: ViewCtx,
    row: RulefileAuditType,
    taxonomies: TaxonomyRow[],
    on_saved: (saved_row: RulefileAuditType) => void,
    on_delete: (delete_button: HTMLButtonElement) => void
): HTMLElement {
    const { Helpers } = ctx;
    const actions = Helpers.create_element('td', { class_name: 'audit-types-actions-cell' });
    const stack = Helpers.create_element('div', { class_name: 'audit-types-actions-stack' });
    stack.appendChild(build_edit_button(ctx, row, taxonomies, on_saved));
    stack.appendChild(build_delete_button(ctx, on_delete));
    actions.appendChild(stack);
    return actions;
}

function confirm_delete_audit_type(
    ctx: ViewCtx,
    row: RulefileAuditType,
    delete_button: HTMLButtonElement,
    on_confirmed: () => void
): void {
    const { Translation: { t } } = ctx;
    show_confirm_delete_modal({
        h1_text: t('confirm_delete_modal_title'),
        warning_text: t('rulefile_classifications_audit_types_delete_confirm', { name: row.label }),
        delete_button,
        on_confirm: on_confirmed,
    });
}

function upsert_audit_type_row(
    working_metadata: Record<string, unknown>,
    existing_id: string,
    next_row: RulefileAuditType
): void {
    ensure_audit_types_for_edit(working_metadata);
    const raw_rows = working_metadata.auditTypes as RulefileAuditType[];
    const index = existing_id ? raw_rows.findIndex((row) => row.id === existing_id) : -1;
    if (index >= 0) {
        raw_rows[index] = { ...raw_rows[index], ...next_row };
    } else {
        raw_rows.push(next_row);
    }
    working_metadata.auditTypes = raw_rows;
}

function remove_audit_type_row(working_metadata: Record<string, unknown>, row_id: string): void {
    const raw_rows = (working_metadata.auditTypes as RulefileAuditType[]) ?? [];
    working_metadata.auditTypes = raw_rows.filter((row) => row.id !== row_id);
}

function render_audit_types_table(
    ctx: ViewCtx,
    container: HTMLElement,
    working_metadata: Record<string, unknown>,
    options: { read_only?: boolean; on_change?: () => void } = {}
): void {
    const { Helpers, Translation: { t } } = ctx;
    container.innerHTML = '';
    ensure_audit_types_for_edit(working_metadata);
    const rows = resolve_audit_types(working_metadata);
    working_metadata.auditTypes = rows;
    const taxonomies = read_taxonomy_rows(working_metadata);

    const columns: ClassificationsTableColumn[] = [
        {
            text: t('rulefile_classifications_audit_types_type_column'),
            class_name: 'audit-types-type-header',
        },
        {
            text: t('rulefile_classifications_audit_types_taxonomy_column'),
            class_name: 'audit-types-taxonomy-header',
        },
    ];
    if (!options.read_only) {
        columns.push({
            text: t('rulefile_classifications_audit_types_actions_column'),
            class_name: 'audit-types-actions-header',
        });
    }

    const rerender = () => {
        render_audit_types_table(ctx, container, working_metadata, options);
    };

    const filter_input = append_classifications_table_filter_to_layout(container, ctx, rows.length, {
        label_key: 'rulefile_classifications_audit_types_filter_label',
        id_prefix: 'audit-types-filter',
        min_rows: 3,
    });

    const { table, row_elements } = create_classifications_table(ctx, {
        caption: t('rulefile_classifications_audit_types_table_caption'),
        extra_table_classes: 'audit-types-table',
        columns,
        rows: rows.map((row) => {
            const cells = [build_taxonomy_cell(Helpers, t, working_metadata, row.taxonomyId)];
            if (!options.read_only) {
                cells.push(
                    build_actions_cell(
                        ctx,
                        row,
                        taxonomies,
                        (saved_row) => {
                            upsert_audit_type_row(working_metadata, row.id, saved_row);
                            options.on_change?.();
                            rerender();
                        },
                        (delete_button) => {
                            confirm_delete_audit_type(ctx, row, delete_button, () => {
                                remove_audit_type_row(working_metadata, row.id);
                                options.on_change?.();
                                rerender();
                            });
                        }
                    )
                );
            }
            return {
                key: row.id,
                row_header_class: 'audit-types-row-header',
                row_header_text: row.label,
                cells,
            };
        }),
    });

    if (rows.length === 0) {
        container.appendChild(
            Helpers.create_element('p', {
                class_name: 'metadata-empty',
                text_content: t('rulefile_metadata_empty_value'),
            })
        );
        return;
    }

    append_classifications_table_scroll_area(container, Helpers, table, 'audit-types-scroll-wrapper');
    if (filter_input) {
        attach_classifications_table_row_filter(filter_input, row_elements);
    }
}

export function render_audit_types_view_section(
    ctx: ViewCtx,
    metadata: Record<string, unknown>,
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
            text_content: t('rulefile_classifications_audit_types_view_intro'),
        })
    );
    const layout = create_classifications_table_layout(Helpers);
    layout.classList.add('audit-types-table-wrapper');
    render_audit_types_table(ctx, layout, metadata, { read_only: true });
    section.appendChild(layout);
    return section;
}

export function render_audit_types_editor(
    ctx: ViewCtx,
    container: HTMLElement,
    working_metadata: Record<string, unknown>,
    options: { on_change?: () => void } = {}
): void {
    const { Helpers, Translation: { t } } = ctx;

    container.innerHTML = '';
    ensure_audit_types_for_edit(working_metadata);
    const taxonomies = read_taxonomy_rows(working_metadata);

    container.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: t('rulefile_classifications_audit_types_edit_intro'),
        })
    );

    const table_host = create_classifications_table_layout(Helpers);
    table_host.classList.add('audit-types-table-wrapper');
    container.appendChild(table_host);

    const add_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'button-small', 'audit-types-add-button'],
        attributes: { type: 'button' },
        text_content: t('rulefile_classifications_audit_types_add'),
    }) as HTMLButtonElement;
    add_btn.addEventListener('click', () => {
        open_audit_type_edit_modal(
            ctx,
            {
                id: '',
                label: '',
                taxonomyId: taxonomies[0]?.id ? String(taxonomies[0].id) : '',
            },
            taxonomies,
            add_btn,
            (saved_row) => {
                upsert_audit_type_row(working_metadata, '', saved_row);
                options.on_change?.();
                rerender_table();
            }
        );
    });

    const rerender_table = () => {
        render_audit_types_table(ctx, table_host, working_metadata, {
            read_only: false,
            on_change: options.on_change,
        });
        table_host.appendChild(add_btn);
    };
    rerender_table();
}

/**
 * @fileoverview Listvy för taxonomier i Klassificeringar.
 */
import { clone_metadata, ensure_metadata_defaults } from '../../logic/rulefile_metadata_model.js';
import { show_confirm_delete_modal } from '../../logic/confirm_delete_modal_logic.js';
import { get_taxonomy_usage_check } from '../../logic/taxonomy_usage.js';
import { finalize_taxonomy_ids_for_persist } from '../../logic/taxonomy_persist.js';
import { normalize_rulefile_metadata_vocabularies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { count_taxonomy_principles } from '../../logic/taxonomy_principles_count.js';
import { can_edit_rulefile } from '../../utils/helpers.js';
import { app_runtime_refs } from '../../utils/app_runtime_refs.js';
import {
    append_classifications_table_scroll_area,
    create_classifications_table,
    create_classifications_table_layout,
    type ClassificationsTableColumn,
} from './rulefile_classifications_table_ui.js';
import {
    taxonomy_create_route_params,
    taxonomy_detail_route_params,
    taxonomy_display_name,
    taxonomy_edit_route_params,
    taxonomy_row_key,
    type TaxonomyRow,
} from './rulefile_taxonomy_keys.js';

export {
    taxonomy_row_key,
    find_taxonomy_by_key,
} from './rulefile_taxonomy_keys.js';

export type TaxonomyListCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    router?: (view: string, params?: Record<string, string>) => void;
    getState?: () => Record<string, unknown>;
    dispatch?: (action: unknown) => void;
    StoreActionTypes?: { UPDATE_RULEFILE_CONTENT: string };
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

function build_taxonomy_name_link(
    ctx: TaxonomyListCtx,
    taxonomy: TaxonomyRow,
    taxonomy_key: string
): HTMLAnchorElement {
    const { Helpers, Translation: { t }, router } = ctx;
    const display_name = taxonomy_display_name(taxonomy, t);
    const link = Helpers.create_element('a', {
        class_name: 'taxonomy-name-link',
        attributes: { href: '#' },
        text_content: display_name,
    }) as HTMLAnchorElement;
    link.setAttribute(
        'aria-label',
        t('rulefile_classifications_taxonomy_view_link_aria', { name: display_name })
    );
    link.addEventListener('click', (event) => {
        event.preventDefault();
        router?.('rulefile_sections', taxonomy_detail_route_params(taxonomy_key));
    });
    return link;
}

function show_blocked_delete_modal(
    ctx: TaxonomyListCtx,
    warning_text: string,
    trigger_button: HTMLButtonElement
): void {
    const ModalComponent = app_runtime_refs.modal_component as ModalComponentApi | null;
    const { Helpers, Translation: { t } } = ctx;
    if (!ModalComponent?.show || !Helpers?.create_element) return;

    ModalComponent.show(
        {
            h1_text: t('rulefile_classifications_taxonomy_delete_blocked_title'),
            message_text: warning_text,
        },
        (container, modal) => {
            const close_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                text_content: t('rulefile_classifications_taxonomy_delete_blocked_close'),
            });
            close_btn.addEventListener('click', () => modal.close(trigger_button));
            container.appendChild(close_btn);
        }
    );
}

function build_usage_warning(ctx: TaxonomyListCtx, reasons: string[]): string {
    const { Translation: { t } } = ctx;
    const reason_lines = reasons.map((reason) =>
        t(`rulefile_classifications_taxonomy_delete_blocked_${reason}`)
    );
    return [t('rulefile_classifications_taxonomy_delete_blocked_intro'), ...reason_lines].join('\n\n');
}

function remove_taxonomy_from_metadata(
    metadata: Record<string, unknown>,
    taxonomy_key: string,
    taxonomy_id: string
): void {
    const taxonomies = resolve_taxonomies(metadata) as TaxonomyRow[];
    const normalized = taxonomy_key.toLowerCase();
    metadata.taxonomies = taxonomies.filter((row, index) => {
        const id = String(row.id ?? '').trim();
        const key = taxonomy_row_key(row, index);
        if (id && id.toLowerCase() === normalized) return false;
        return key.toLowerCase() !== normalized;
    });
    const primary = String(metadata.primaryGroupingTaxonomyId ?? '').trim();
    if (primary && taxonomy_id && primary.toLowerCase() === taxonomy_id.toLowerCase()) {
        metadata.primaryGroupingTaxonomyId = '';
    }
}

function persist_metadata_change(ctx: TaxonomyListCtx, metadata: Record<string, unknown>): void {
    if (!ctx.dispatch || !ctx.StoreActionTypes || !ctx.getState) return;
    const state = ctx.getState();
    const current = (state.ruleFileContent as Record<string, unknown>) || {};
    const cloned = ensure_metadata_defaults(clone_metadata(metadata)) as Record<string, unknown>;
    finalize_taxonomy_ids_for_persist(cloned);
    const normalized = normalize_rulefile_metadata_vocabularies({ ...cloned }, { mode: 'read' });
    ctx.dispatch({
        type: ctx.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
        payload: {
            ruleFileContent: {
                ...current,
                metadata: { ...(current.metadata as object), ...normalized },
            },
        },
    });
}

function confirm_delete_taxonomy(
    ctx: TaxonomyListCtx,
    taxonomy: TaxonomyRow,
    taxonomy_key: string,
    delete_button: HTMLButtonElement,
    on_deleted: () => void
): void {
    const { Translation: { t }, getState } = ctx;
    const display_name = taxonomy_display_name(taxonomy, t);
    const rule_file = (getState?.().ruleFileContent ?? {}) as Record<string, unknown>;
    const taxonomy_id = String(taxonomy.id ?? taxonomy_key).trim();
    const usage = get_taxonomy_usage_check(rule_file, taxonomy_id);

    if (!usage.can_delete) {
        show_blocked_delete_modal(ctx, build_usage_warning(ctx, usage.reasons), delete_button);
        return;
    }

    show_confirm_delete_modal({
        h1_text: t('confirm_delete_modal_title'),
        warning_text: t('rulefile_classifications_taxonomy_delete_confirm', { name: display_name }),
        delete_button,
        on_confirm: () => {
            const metadata = clone_metadata(
                ((getState?.().ruleFileContent as Record<string, unknown>)?.metadata ?? {}) as Record<
                    string,
                    unknown
                >
            ) as Record<string, unknown>;
            remove_taxonomy_from_metadata(metadata, taxonomy_key, taxonomy_id);
            persist_metadata_change(ctx, metadata);
            on_deleted();
        },
    });
}

function build_delete_button(
    ctx: TaxonomyListCtx,
    taxonomy: TaxonomyRow,
    taxonomy_key: string,
    on_deleted: () => void
): HTMLButtonElement {
    const { Helpers, Translation: { t } } = ctx;
    const display_name = taxonomy_display_name(taxonomy, t);
    const delete_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-danger', 'button-small', 'taxonomy-row-delete-button'],
        attributes: { type: 'button' },
        text_content: t('rulefile_classifications_taxonomy_remove'),
    }) as HTMLButtonElement;
    delete_btn.setAttribute(
        'aria-label',
        t('rulefile_classifications_taxonomy_remove_aria', { name: display_name })
    );
    delete_btn.addEventListener('click', () => {
        confirm_delete_taxonomy(ctx, taxonomy, taxonomy_key, delete_btn, on_deleted);
    });
    return delete_btn;
}

function build_edit_button(
    ctx: TaxonomyListCtx,
    taxonomy: TaxonomyRow,
    taxonomy_key: string
): HTMLButtonElement {
    const { Helpers, Translation: { t }, router } = ctx;
    const display_name = taxonomy_display_name(taxonomy, t);
    const edit_label = t('edit_button_label');
    const edit_icon = Helpers.get_icon_svg
        ? `<span aria-hidden="true">${Helpers.get_icon_svg('edit', ['currentColor'], 16)}</span>`
        : '';
    const edit_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-secondary', 'button-small', 'taxonomy-row-edit-button'],
        attributes: {
            type: 'button',
            'aria-label': t('rulefile_classifications_taxonomy_edit_row_aria', { name: display_name }),
        },
        html_content: `<span>${edit_label}</span>${edit_icon}`,
    }) as HTMLButtonElement;
    edit_btn.addEventListener('click', () => {
        router?.('rulefile_sections', taxonomy_edit_route_params(taxonomy_key));
    });
    return edit_btn;
}

function build_actions_cell(
    ctx: TaxonomyListCtx,
    taxonomy: TaxonomyRow,
    taxonomy_key: string,
    on_deleted: () => void
): HTMLElement {
    const { Helpers } = ctx;
    const actions = Helpers.create_element('td', { class_name: 'taxonomy-actions-cell' });
    const stack = Helpers.create_element('div', { class_name: 'taxonomy-actions-stack' });
    stack.appendChild(build_edit_button(ctx, taxonomy, taxonomy_key));
    stack.appendChild(build_delete_button(ctx, taxonomy, taxonomy_key, on_deleted));
    actions.appendChild(stack);
    return actions;
}

function render_taxonomy_table(
    ctx: TaxonomyListCtx,
    container: HTMLElement,
    metadata: Record<string, unknown>
): void {
    const { Helpers, Translation: { t } } = ctx;
    container.innerHTML = '';

    const taxonomies = resolve_taxonomies(metadata) as TaxonomyRow[];
    if (taxonomies.length === 0) {
        container.appendChild(
            Helpers.create_element('p', {
                class_name: 'metadata-empty',
                text_content: t('rulefile_metadata_empty_value'),
            })
        );
        return;
    }

    const can_edit = ctx.getState ? can_edit_rulefile(ctx.getState()) : Boolean(ctx.router);
    const columns: ClassificationsTableColumn[] = [
        { text: t('rulefile_classifications_taxonomy_name_column'), class_name: 'taxonomy-name-header' },
        {
            text: t('rulefile_classifications_taxonomy_principles_column'),
            class_name: 'taxonomy-principles-header',
        },
    ];
    if (can_edit) {
        columns.push({
            text: t('rulefile_classifications_taxonomy_actions_column'),
            class_name: 'taxonomy-actions-header',
        });
    }

    const rerender = () => {
        const fresh_metadata = (ctx.getState?.().ruleFileContent as Record<string, unknown> | undefined)
            ?.metadata as Record<string, unknown> | undefined;
        render_taxonomy_table(ctx, container, fresh_metadata ?? metadata);
    };

    const { table } = create_classifications_table(ctx, {
        extra_table_classes: 'taxonomy-table',
        columns,
        rows: taxonomies.map((taxonomy, index) => {
            const key = taxonomy_row_key(taxonomy, index);
            const cells = [
                Helpers.create_element('td', {
                    class_name: 'taxonomy-principles-cell',
                    text_content: String(count_taxonomy_principles(taxonomy)),
                }),
            ];
            if (can_edit) {
                cells.push(build_actions_cell(ctx, taxonomy, key, rerender));
            }
            return {
                key,
                row_header_class: 'taxonomy-row-header',
                row_header_text: taxonomy_display_name(taxonomy, t),
                row_header_element: ctx.router
                    ? build_taxonomy_name_link(ctx, taxonomy, key)
                    : undefined,
                cells,
            };
        }),
    });

    append_classifications_table_scroll_area(container, Helpers, table, 'taxonomy-scroll-wrapper');
}

export function render_taxonomy_view_section(
    ctx: TaxonomyListCtx,
    metadata: Record<string, unknown>
): HTMLElement {
    const { Helpers, Translation: { t }, router } = ctx;
    const section = Helpers.create_element('section', {
        class_name: ['rulefile-section-content', 'taxonomy-list-view'],
    });

    section.appendChild(
        Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('rulefile_classifications_taxonomy_view_intro'),
        })
    );

    const layout = create_classifications_table_layout(Helpers);
    layout.classList.add('taxonomy-table-wrapper');
    render_taxonomy_table(ctx, layout, metadata);
    section.appendChild(layout);

    const can_edit = ctx.getState ? can_edit_rulefile(ctx.getState()) : Boolean(router);
    if (can_edit && router) {
        const add_btn = Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'button-small', 'taxonomy-add-button'],
            attributes: { type: 'button' },
            text_content: t('rulefile_classifications_taxonomy_add'),
        }) as HTMLButtonElement;
        add_btn.addEventListener('click', () => {
            router('rulefile_sections', taxonomy_create_route_params());
        });
        section.appendChild(add_btn);
    }

    return section;
}

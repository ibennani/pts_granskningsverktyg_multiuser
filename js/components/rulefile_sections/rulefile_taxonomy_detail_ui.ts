/**
 * @fileoverview Kompakt infosida för en taxonomi i Klassificeringar.
 */
import {
    append_classifications_table_scroll_area,
    create_classifications_table,
    create_classifications_table_layout,
    type ClassificationsTableColumn,
} from './rulefile_classifications_table_ui.js';
import {
    find_taxonomy_by_key,
    taxonomy_display_name,
    taxonomy_edit_route_params,
    taxonomy_row_key,
    type TaxonomyRow,
} from './rulefile_taxonomy_keys.js';

export type TaxonomyDetailCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    router?: (view: string, params?: Record<string, string>) => void;
    getState?: () => Record<string, unknown>;
};

export function build_taxonomy_detail_edit_button(
    ctx: TaxonomyDetailCtx,
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
        class_name: ['button', 'button-secondary', 'taxonomy-detail-edit-button'],
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

function render_principles_table(
    ctx: TaxonomyDetailCtx,
    container: HTMLElement,
    taxonomy: TaxonomyRow
): void {
    const { Helpers, Translation: { t } } = ctx;
    const concepts = Array.isArray(taxonomy.concepts) ? taxonomy.concepts : [];
    if (concepts.length === 0) {
        container.appendChild(
            Helpers.create_element('p', {
                class_name: 'metadata-empty',
                text_content: t('rulefile_metadata_empty_value'),
            })
        );
        return;
    }

    const columns: ClassificationsTableColumn[] = [
        {
            text: t('rulefile_classifications_taxonomy_principle_column'),
            class_name: 'taxonomy-principle-header',
        },
    ];
    const { table } = create_classifications_table(ctx, {
        extra_table_classes: 'taxonomy-principles-table',
        columns,
        rows: concepts.map((concept, index) => {
            const entry = concept as { label?: string; id?: string };
            const label =
                String(entry.label ?? '').trim() ||
                String(entry.id ?? '').trim() ||
                t('rulefile_metadata_untitled_item');
            return {
                key: String(entry.id ?? index),
                row_header_class: 'taxonomy-principle-row-header',
                row_header_text: label,
                cells: [],
            };
        }),
    });
    append_classifications_table_scroll_area(
        container,
        Helpers,
        table,
        'taxonomy-principles-scroll-wrapper'
    );
}

export function render_taxonomy_detail_ui(
    ctx: TaxonomyDetailCtx,
    metadata: Record<string, unknown>,
    taxonomy_key: string
): HTMLElement {
    const { Helpers, Translation: { t } } = ctx;
    const section = Helpers.create_element('section', {
        class_name: ['rulefile-section-content', 'taxonomy-detail-view'],
    });

    const match = find_taxonomy_by_key(metadata, taxonomy_key);
    if (!match) {
        section.appendChild(
            Helpers.create_element('p', {
                class_name: 'metadata-empty',
                text_content: t('rulefile_classifications_taxonomy_not_found'),
            })
        );
        return section;
    }

    const { taxonomy } = match;
    const principles_host = create_classifications_table_layout(Helpers);
    principles_host.classList.add('taxonomy-principles-table-wrapper');
    render_principles_table(ctx, principles_host, taxonomy);
    section.appendChild(principles_host);

    return section;
}

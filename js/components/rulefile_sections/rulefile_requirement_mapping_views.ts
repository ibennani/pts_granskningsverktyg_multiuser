/**
 * @fileoverview Matris- och kortvy för kravkoppling.
 */
import {
    attach_classifications_elements_filter,
    attach_classifications_table_row_filter,
    create_classifications_table,
    create_classifications_table_scroll_wrapper,
} from './rulefile_classifications_table_ui.js';
import { build_mapping_checkbox_key } from './rulefile_requirement_mapping_keys.js';
import type {
    CheckboxRefs,
    ConceptEntry,
    MappingCtx,
    MappingViewHandles,
    RequirementRow,
    SetConceptChecked,
} from './rulefile_requirement_mapping_types.js';

function build_checkbox_id(req_key: string, concept_id: string, suffix: string): string {
    return `mapping-${suffix}-${req_key}-${concept_id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function create_set_concept_checked(
    checkbox_state: Map<string, boolean>,
    checkbox_refs: Map<string, CheckboxRefs>,
    on_change?: () => void
): SetConceptChecked {
    return (req_key, concept_id, checked, source) => {
        const map_key = build_mapping_checkbox_key(req_key, concept_id);
        checkbox_state.set(map_key, checked);
        const refs = checkbox_refs.get(map_key);
        if (refs?.matrix && refs.matrix !== source) refs.matrix.checked = checked;
        if (refs?.card && refs.card !== source) refs.card.checked = checked;
        on_change?.();
    };
}

function register_checkbox_ref(
    checkbox_refs: Map<string, CheckboxRefs>,
    map_key: string,
    kind: 'matrix' | 'card',
    checkbox: HTMLInputElement
): void {
    const existing = checkbox_refs.get(map_key) ?? {};
    existing[kind] = checkbox;
    checkbox_refs.set(map_key, existing);
}

function build_matrix_checkbox_cell(
    ctx: MappingCtx,
    row: RequirementRow,
    concept: ConceptEntry,
    checkbox_state: Map<string, boolean>,
    checkbox_refs: Map<string, CheckboxRefs>,
    set_concept_checked: SetConceptChecked
): HTMLElement {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    const map_key = build_mapping_checkbox_key(row.key, concept.id);
    const checkbox_id = build_checkbox_id(row.key, concept.id, 'matrix');
    const checkbox = Helpers.create_element('input', {
        class_name: 'requirement-mapping-checkbox',
        attributes: {
            id: checkbox_id,
            type: 'checkbox',
            'data-requirement-key': row.key,
            'data-concept-id': concept.id,
        },
    }) as HTMLInputElement;
    checkbox.checked = checkbox_state.get(map_key) ?? false;
    checkbox.addEventListener('change', () => {
        set_concept_checked(row.key, concept.id, checkbox.checked, checkbox);
    });

    const label = Helpers.create_element('label', {
        class_name: 'visually-hidden',
        attributes: { for: checkbox_id },
        text_content: t('rulefile_classifications_mapping_checkbox_label', {
            requirement: row.display_label || row.key,
            concept: concept.label || concept.id,
        }),
    });

    const td = Helpers.create_element('td', { class_name: 'requirement-mapping-cell' });
    td.append(checkbox, label);
    register_checkbox_ref(checkbox_refs, map_key, 'matrix', checkbox);
    return td;
}

function render_matrix_layout(
    ctx: MappingCtx,
    rows: RequirementRow[],
    concepts: ConceptEntry[],
    checkbox_state: Map<string, boolean>,
    checkbox_refs: Map<string, CheckboxRefs>,
    set_concept_checked: SetConceptChecked
): { wrapper: HTMLElement; row_elements: HTMLElement[] } {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    const wrapper = create_classifications_table_scroll_wrapper(
        Helpers,
        'requirement-mapping-matrix-wrapper'
    );

    const { table, row_elements } = create_classifications_table(ctx, {
        caption: t('rulefile_classifications_mapping_table_caption'),
        extra_table_classes: 'requirement-mapping-table',
        columns: [
            {
                text: t('rulefile_classifications_mapping_requirement_column'),
                class_name: 'requirement-mapping-corner-header',
            },
            ...concepts.map((concept) => ({
                text: concept.label || concept.id,
                class_name: 'requirement-mapping-concept-header',
            })),
        ],
        rows: rows.map((row) => ({
            key: row.key,
            row_class: 'requirement-mapping-row',
            row_header_class: 'requirement-mapping-row-header',
            row_header_text: row.display_label || row.key,
            cells: concepts.map((concept) =>
                build_matrix_checkbox_cell(
                    ctx, row, concept, checkbox_state, checkbox_refs, set_concept_checked
                )
            ),
        })),
    });

    wrapper.appendChild(table);
    return { wrapper, row_elements };
}

function render_cards_layout(
    ctx: MappingCtx,
    rows: RequirementRow[],
    concepts: ConceptEntry[],
    checkbox_state: Map<string, boolean>,
    checkbox_refs: Map<string, CheckboxRefs>,
    set_concept_checked: SetConceptChecked
): { wrapper: HTMLElement; card_elements: HTMLElement[] } {
    const { Helpers } = ctx;
    const wrapper = Helpers.create_element('div', { class_name: 'requirement-mapping-cards' });
    const list = Helpers.create_element('ul', { class_name: 'requirement-mapping-cards-list' });
    const card_elements: HTMLElement[] = [];

    rows.forEach((row) => {
        const card = Helpers.create_element('li', {
            class_name: 'requirement-mapping-card',
            attributes: { 'data-requirement-key': row.key },
        });
        card.appendChild(
            Helpers.create_element('h3', {
                class_name: 'requirement-mapping-card-title',
                text_content: row.display_label || row.key,
            })
        );

        const options = Helpers.create_element('ul', { class_name: 'requirement-mapping-card-options' });
        concepts.forEach((concept) => {
            const map_key = build_mapping_checkbox_key(row.key, concept.id);
            const checkbox_id = build_checkbox_id(row.key, concept.id, 'card');
            const option = Helpers.create_element('li', { class_name: 'requirement-mapping-card-option' });

            const checkbox = Helpers.create_element('input', {
                class_name: 'requirement-mapping-checkbox',
                attributes: {
                    id: checkbox_id,
                    type: 'checkbox',
                    'data-requirement-key': row.key,
                    'data-concept-id': concept.id,
                },
            }) as HTMLInputElement;
            checkbox.checked = checkbox_state.get(map_key) ?? false;
            checkbox.addEventListener('change', () => {
                set_concept_checked(row.key, concept.id, checkbox.checked, checkbox);
            });

            const label = Helpers.create_element('label', {
                class_name: 'requirement-mapping-card-label',
                attributes: { for: checkbox_id },
                text_content: concept.label || concept.id,
            });

            option.append(checkbox, label);
            register_checkbox_ref(checkbox_refs, map_key, 'card', checkbox);
            options.appendChild(option);
        });

        card.appendChild(options);
        list.appendChild(card);
        card_elements.push(card);
    });

    wrapper.appendChild(list);
    return { wrapper, card_elements };
}

export function render_mapping_views(
    ctx: MappingCtx,
    content_area: HTMLElement,
    rows: RequirementRow[],
    concepts: ConceptEntry[],
    checkbox_state: Map<string, boolean>,
    checkbox_refs: Map<string, CheckboxRefs>,
    set_concept_checked: SetConceptChecked
): MappingViewHandles {
    content_area.replaceChildren();
    const matrix = render_matrix_layout(
        ctx, rows, concepts, checkbox_state, checkbox_refs, set_concept_checked
    );
    const cards = render_cards_layout(
        ctx, rows, concepts, checkbox_state, checkbox_refs, set_concept_checked
    );
    content_area.append(matrix.wrapper, cards.wrapper);
    return {
        matrix_row_elements: matrix.row_elements,
        card_elements: cards.card_elements,
    };
}

export function attach_mapping_filters(
    filter_input: HTMLInputElement | null,
    view_handles: MappingViewHandles
): void {
    if (!filter_input) return;
    attach_classifications_table_row_filter(filter_input, view_handles.matrix_row_elements);
    attach_classifications_elements_filter(filter_input, view_handles.card_elements, {
        title_selector: '.requirement-mapping-card-title',
    });
}

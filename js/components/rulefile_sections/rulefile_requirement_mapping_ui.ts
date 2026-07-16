/**
 * @fileoverview Matris- och kortvy för koppling mellan krav och taxonomibegrepp.
 */
import { normalize_requirements_to_record } from '../../logic/requirement_lookup.js';
import { get_requirement_display_label } from '../../logic/requirement_display_name.ts';
import {
    apply_requirement_classifications,
    get_concept_ids_for_requirement,
    get_primary_grouping_taxonomy_id,
    resolve_taxonomy_concepts,
} from '../../logic/requirement_classifications.js';

type MappingCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        escape_html?: (value: string) => string;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
};

type ConceptEntry = { id: string; label: string };
type RequirementRow = {
    key: string;
    display_label: string;
    requirement: Record<string, unknown>;
};

type CheckboxRefs = { matrix?: HTMLInputElement; card?: HTMLInputElement };

function normalize_filter(value: string): string {
    return value.trim().toLowerCase();
}

export function build_requirement_rows(requirements: unknown): RequirementRow[] {
    const record = normalize_requirements_to_record(requirements);
    return Object.entries(record)
        .map(([key, requirement]) => ({
            key,
            display_label: get_requirement_display_label(requirement as Record<string, unknown>),
            requirement: requirement as Record<string, unknown>,
        }))
        .sort((a, b) => a.display_label.localeCompare(b.display_label, 'sv'));
}

export function build_mapping_checkbox_key(req_key: string, concept_id: string): string {
    return `${req_key}::${concept_id}`;
}

function build_checkbox_id(req_key: string, concept_id: string, suffix: string): string {
    return `mapping-${suffix}-${req_key}-${concept_id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function build_initial_checkbox_state(
    rows: RequirementRow[],
    concepts: ConceptEntry[],
    taxonomy_id: string
): Map<string, boolean> {
    const state = new Map<string, boolean>();
    rows.forEach((row) => {
        const selected = new Set(get_concept_ids_for_requirement(row.requirement, taxonomy_id));
        concepts.forEach((concept) => {
            const map_key = build_mapping_checkbox_key(row.key, concept.id);
            state.set(map_key, selected.has(String(concept.id).trim().toLowerCase()));
        });
    });
    return state;
}

function create_set_concept_checked(
    checkbox_state: Map<string, boolean>,
    checkbox_refs: Map<string, CheckboxRefs>,
    on_change?: () => void
) {
    return (req_key: string, concept_id: string, checked: boolean, source?: HTMLInputElement) => {
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

function render_matrix_layout(
    ctx: MappingCtx,
    rows: RequirementRow[],
    concepts: ConceptEntry[],
    checkbox_state: Map<string, boolean>,
    checkbox_refs: Map<string, CheckboxRefs>,
    set_concept_checked: ReturnType<typeof create_set_concept_checked>
): { wrapper: HTMLElement; row_elements: HTMLElement[] } {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    const wrapper = Helpers.create_element('div', { class_name: 'requirement-mapping-matrix-wrapper' });
    const table = Helpers.create_element('table', { class_name: 'requirement-mapping-table' });
    table.appendChild(
        Helpers.create_element('caption', {
            text_content: t('rulefile_classifications_mapping_table_caption'),
        })
    );

    const header_row = Helpers.create_element('tr');
    header_row.appendChild(
        Helpers.create_element('th', {
            class_name: 'requirement-mapping-corner-header',
            attributes: { scope: 'col' },
            text_content: t('rulefile_classifications_mapping_requirement_column'),
        })
    );
    concepts.forEach((concept) => {
        header_row.appendChild(
            Helpers.create_element('th', {
                class_name: 'requirement-mapping-concept-header',
                attributes: { scope: 'col' },
                text_content: concept.label || concept.id,
            })
        );
    });
    const thead = Helpers.create_element('thead');
    thead.appendChild(header_row);
    table.appendChild(thead);

    const tbody = Helpers.create_element('tbody');
    const row_elements: HTMLElement[] = [];

    rows.forEach((row) => {
        const tr = Helpers.create_element('tr', {
            class_name: 'requirement-mapping-row',
            attributes: { 'data-requirement-key': row.key },
        });
        tr.appendChild(
            Helpers.create_element('th', {
                class_name: 'requirement-mapping-row-header',
                attributes: { scope: 'row' },
                text_content: row.display_label || row.key,
            })
        );

        concepts.forEach((concept) => {
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
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
        row_elements.push(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    return { wrapper, row_elements };
}

function render_cards_layout(
    ctx: MappingCtx,
    rows: RequirementRow[],
    concepts: ConceptEntry[],
    checkbox_state: Map<string, boolean>,
    checkbox_refs: Map<string, CheckboxRefs>,
    set_concept_checked: ReturnType<typeof create_set_concept_checked>
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

function attach_filter_handler(
    filter_input: HTMLInputElement,
    matrix_rows: HTMLElement[],
    card_elements: HTMLElement[]
): void {
    filter_input.addEventListener('input', () => {
        const needle = normalize_filter(filter_input.value);
        matrix_rows.forEach((row_el) => {
            const title = normalize_filter(row_el.querySelector('th')?.textContent ?? '');
            const key = normalize_filter(row_el.getAttribute('data-requirement-key') ?? '');
            row_el.hidden = Boolean(needle) && !title.includes(needle) && !key.includes(needle);
        });
        card_elements.forEach((card_el) => {
            const title = normalize_filter(
                card_el.querySelector('.requirement-mapping-card-title')?.textContent ?? ''
            );
            const key = normalize_filter(card_el.getAttribute('data-requirement-key') ?? '');
            card_el.hidden = Boolean(needle) && !title.includes(needle) && !key.includes(needle);
        });
    });
}

/**
 * Renderar krav x begrepp-matris och kortvy; returnerar spara-callback.
 */
export function render_requirement_mapping_ui(
    ctx: MappingCtx,
    container: HTMLElement,
    rule_file_content: Record<string, unknown>,
    on_change?: () => void
): { apply_changes: () => Record<string, unknown> } {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    container.innerHTML = '';

    const metadata = (rule_file_content.metadata ?? {}) as Record<string, unknown>;
    const taxonomy_id = get_primary_grouping_taxonomy_id(rule_file_content);
    const concepts = resolve_taxonomy_concepts(metadata, taxonomy_id, t) as ConceptEntry[];

    if (concepts.length === 0) {
        container.appendChild(
            Helpers.create_element('p', {
                class_name: 'field-hint',
                text_content: t('rulefile_classifications_mapping_no_concepts'),
            })
        );
        return { apply_changes: () => rule_file_content };
    }

    container.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: t('rulefile_classifications_mapping_intro'),
        })
    );

    const filter_id = `requirement-mapping-filter-${Math.random().toString(36).substring(2, 8)}`;
    const filter_row = Helpers.create_element('div', { class_name: 'form-group requirement-mapping-filter' });
    filter_row.appendChild(
        Helpers.create_element('label', {
            attributes: { for: filter_id },
            text_content: t('rulefile_classifications_mapping_filter_label'),
        })
    );
    const filter_input = Helpers.create_element('input', {
        class_name: 'form-control',
        attributes: { id: filter_id, type: 'search' },
    }) as HTMLInputElement;
    filter_row.appendChild(filter_input);
    container.appendChild(filter_row);

    const rows = build_requirement_rows(rule_file_content.requirements);
    const checkbox_state = build_initial_checkbox_state(rows, concepts, taxonomy_id);
    const checkbox_refs = new Map<string, CheckboxRefs>();
    const set_concept_checked = create_set_concept_checked(checkbox_state, checkbox_refs, on_change);

    const matrix = render_matrix_layout(
        ctx, rows, concepts, checkbox_state, checkbox_refs, set_concept_checked
    );
    const cards = render_cards_layout(
        ctx, rows, concepts, checkbox_state, checkbox_refs, set_concept_checked
    );

    container.append(matrix.wrapper, cards.wrapper);
    attach_filter_handler(filter_input, matrix.row_elements, cards.card_elements);

    return {
        apply_changes: () => {
            const updated = { ...rule_file_content };
            const req_record = normalize_requirements_to_record(updated.requirements);
            for (const [req_key, requirement] of Object.entries(req_record)) {
                const concept_ids = concepts
                    .filter((concept) => checkbox_state.get(build_mapping_checkbox_key(req_key, concept.id)))
                    .map((concept) => concept.id);
                req_record[req_key] = apply_requirement_classifications(
                    requirement,
                    taxonomy_id,
                    concept_ids
                );
            }
            updated.requirements = req_record;
            return updated;
        },
    };
}

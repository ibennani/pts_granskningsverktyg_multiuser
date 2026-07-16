/**
 * @fileoverview Matrisvy för koppling mellan krav och taxonomibegrepp.
 */
import { normalize_requirements_to_record } from '../../logic/requirement_lookup.js';
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

type RequirementRow = {
    key: string;
    title: string;
    requirement: Record<string, unknown>;
};

function normalize_filter(value: string): string {
    return value.trim().toLowerCase();
}

function get_requirement_title(requirement: Record<string, unknown>): string {
    const metadata = requirement.metadata as Record<string, unknown> | undefined;
    const standard_ref = requirement.standardReference as Record<string, unknown> | undefined;
    const from_meta = metadata?.title;
    if (typeof from_meta === 'string' && from_meta.trim()) return from_meta.trim();
    const from_ref = standard_ref?.text;
    if (typeof from_ref === 'string' && from_ref.trim()) return from_ref.trim();
    const id = requirement.id ?? requirement.key;
    return id ? String(id) : '';
}

function build_requirement_rows(requirements: unknown): RequirementRow[] {
    const record = normalize_requirements_to_record(requirements);
    return Object.entries(record)
        .map(([key, requirement]) => ({
            key,
            title: get_requirement_title(requirement as Record<string, unknown>),
            requirement: requirement as Record<string, unknown>,
        }))
        .sort((a, b) => a.title.localeCompare(b.title, 'sv'));
}

function attach_checkbox_keyboard(cell: HTMLElement, checkbox: HTMLInputElement): void {
    cell.tabIndex = 0;
    cell.addEventListener('keydown', (event) => {
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
    cell.addEventListener('click', (event) => {
        if (event.target === checkbox) return;
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

/**
 * Renderar krav x begrepp-matris och returnerar spara-callback.
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
    const concepts = resolve_taxonomy_concepts(metadata, taxonomy_id, t);

    if (concepts.length === 0) {
        container.appendChild(
            Helpers.create_element('p', {
                class_name: 'field-hint',
                text_content: t('rulefile_classifications_mapping_no_concepts'),
            })
        );
        return {
            apply_changes: () => rule_file_content,
        };
    }

    const intro = Helpers.create_element('p', {
        class_name: 'field-hint',
        text_content: t('rulefile_classifications_mapping_intro'),
    });
    container.appendChild(intro);

    const filter_row = Helpers.create_element('div', { class_name: 'form-group requirement-mapping-filter' });
    const filter_id = `requirement-mapping-filter-${Math.random().toString(36).substring(2, 8)}`;
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

    const table_wrapper = Helpers.create_element('div', { class_name: 'requirement-mapping-table-wrapper' });
    const table = Helpers.create_element('table', { class_name: 'requirement-mapping-table' });
    const caption = Helpers.create_element('caption', {
        text_content: t('rulefile_classifications_mapping_table_caption'),
    });
    table.appendChild(caption);

    const thead = Helpers.create_element('thead');
    const header_row = Helpers.create_element('tr');
    header_row.appendChild(
        Helpers.create_element('th', {
            attributes: { scope: 'col' },
            text_content: t('rulefile_classifications_mapping_requirement_column'),
        })
    );
    concepts.forEach((concept) => {
        header_row.appendChild(
            Helpers.create_element('th', {
                attributes: { scope: 'col' },
                text_content: concept.label || concept.id,
            })
        );
    });
    thead.appendChild(header_row);
    table.appendChild(thead);

    const tbody = Helpers.create_element('tbody');
    const rows = build_requirement_rows(rule_file_content.requirements);
    const checkbox_map = new Map<string, HTMLInputElement>();

    rows.forEach((row) => {
        const tr = Helpers.create_element('tr', {
            class_name: 'requirement-mapping-row',
            attributes: { 'data-requirement-key': row.key },
        });
        tr.appendChild(
            Helpers.create_element('th', {
                attributes: { scope: 'row' },
                text_content: row.title || row.key,
            })
        );

        const selected = new Set(get_concept_ids_for_requirement(row.requirement, taxonomy_id));
        concepts.forEach((concept) => {
            const td = Helpers.create_element('td', { class_name: 'requirement-mapping-cell' });
            const checkbox_id = `mapping-${row.key}-${concept.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
            const checkbox = Helpers.create_element('input', {
                class_name: 'requirement-mapping-checkbox',
                attributes: {
                    id: checkbox_id,
                    type: 'checkbox',
                    'data-requirement-key': row.key,
                    'data-concept-id': concept.id,
                },
            }) as HTMLInputElement;
            checkbox.checked = selected.has(String(concept.id).trim().toLowerCase());
            checkbox.addEventListener('change', () => on_change?.());

            const label = Helpers.create_element('label', {
                attributes: { for: checkbox_id },
                text_content: t('rulefile_classifications_mapping_checkbox_label', {
                    requirement: row.title || row.key,
                    concept: concept.label || concept.id,
                }),
            });
            label.className = 'sr-only';

            td.append(checkbox, label);
            attach_checkbox_keyboard(td, checkbox);
            checkbox_map.set(`${row.key}::${concept.id}`, checkbox);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    table_wrapper.appendChild(table);
    container.appendChild(table_wrapper);

    filter_input.addEventListener('input', () => {
        const needle = normalize_filter(filter_input.value);
        tbody.querySelectorAll('.requirement-mapping-row').forEach((row_el) => {
            const title = normalize_filter(row_el.querySelector('th')?.textContent ?? '');
            const key = normalize_filter(row_el.getAttribute('data-requirement-key') ?? '');
            const visible = !needle || title.includes(needle) || key.includes(needle);
            (row_el as HTMLElement).hidden = !visible;
        });
    });

    return {
        apply_changes: () => {
            const updated = { ...rule_file_content };
            const req_record = normalize_requirements_to_record(updated.requirements);
            for (const [req_key, requirement] of Object.entries(req_record)) {
                const concept_ids = concepts
                    .filter((concept) => checkbox_map.get(`${req_key}::${concept.id}`)?.checked)
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

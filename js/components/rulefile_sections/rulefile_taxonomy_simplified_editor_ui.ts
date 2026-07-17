/**
 * @fileoverview Förenklad taxonomiredigering: begrepp utan synlig nyckel.
 */
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import {
    finalize_taxonomy_ids_for_persist,
    slug_from_label,
} from '../../logic/taxonomy_persist.js';

export { finalize_taxonomy_ids_for_persist } from '../../logic/taxonomy_persist.js';

type EditorCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        escape_html?: (value: string) => string;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
};

type TaxonomyConcept = { id?: string; label?: string };
type TaxonomyEntry = {
    id?: string;
    label?: string;
    version?: string;
    uri?: string;
    concepts?: TaxonomyConcept[];
};

type WorkingMetadata = {
    taxonomies?: TaxonomyEntry[];
    primaryGroupingTaxonomyId?: string;
    [key: string]: unknown;
};

function ensure_taxonomies(working_metadata: WorkingMetadata): TaxonomyEntry[] {
    if (!Array.isArray(working_metadata.taxonomies)) {
        working_metadata.taxonomies = [];
    }
    return working_metadata.taxonomies;
}

function create_labeled_input(
    ctx: EditorCtx,
    label_text: string,
    value: string,
    on_change: (value: string) => void
): HTMLElement {
    const { Helpers } = ctx;
    const wrapper = Helpers.create_element('div', { class_name: 'inline-field' });
    const input_id = `taxonomy-field-${Math.random().toString(36).substring(2, 10)}`;
    wrapper.appendChild(
        Helpers.create_element('label', { attributes: { for: input_id }, text_content: label_text })
    );
    const input = Helpers.create_element('input', {
        class_name: 'form-control form-control-compact',
        attributes: { id: input_id, type: 'text' },
    }) as HTMLInputElement;
    input.value = value ?? '';
    input.addEventListener('input', () => on_change(input.value));
    wrapper.appendChild(input);
    return wrapper;
}

function create_action_button(
    ctx: EditorCtx,
    label: string,
    icon: string,
    on_click: () => void,
    variant = 'secondary'
): HTMLButtonElement {
    const { Helpers } = ctx;
    const safe = Helpers.escape_html ? Helpers.escape_html(label) : label;
    const icon_html = icon && Helpers.get_icon_svg ? Helpers.get_icon_svg(icon) : '';
    const button = Helpers.create_element('button', {
        class_name: ['button', `button-${variant}`, 'button-small'],
        attributes: { type: 'button', 'aria-label': label },
        html_content: `<span>${safe}</span>${icon_html}`,
    }) as HTMLButtonElement;
    button.addEventListener('click', on_click);
    return button;
}

function render_primary_select(
    ctx: EditorCtx,
    container: HTMLElement,
    working_metadata: WorkingMetadata,
    on_change?: () => void
): void {
    const { Helpers, Translation } = ctx;
    const taxonomies = resolve_taxonomies(working_metadata) as TaxonomyEntry[];
    const field = Helpers.create_element('div', { class_name: 'form-group primary-grouping-taxonomy-field' });
    const select_id = `primary-grouping-${Math.random().toString(36).substring(2, 8)}`;
    field.appendChild(
        Helpers.create_element('label', {
            attributes: { for: select_id },
            text_content: Translation.t('rulefile_classifications_primary_grouping_label'),
        })
    );
    const select = Helpers.create_element('select', {
        class_name: ['form-control', 'dropdown-select'],
        attributes: { id: select_id },
    }) as HTMLSelectElement;
    select.appendChild(
        Helpers.create_element('option', {
            attributes: { value: '' },
            text_content: Translation.t('rulefile_classifications_primary_grouping_none'),
        })
    );
    taxonomies.forEach((taxonomy) => {
        const id = String(taxonomy?.id ?? '').trim();
        if (!id) return;
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: id },
                text_content: taxonomy.label || id,
            })
        );
    });
    select.value = String(working_metadata.primaryGroupingTaxonomyId ?? '').trim();
    select.addEventListener('change', () => {
        working_metadata.primaryGroupingTaxonomyId = select.value.trim();
        on_change?.();
    });
    field.appendChild(select);
    container.appendChild(field);
}

function assign_stable_ids(taxonomies: TaxonomyEntry[]): void {
    taxonomies.forEach((taxonomy, tax_index) => {
        const label = String(taxonomy.label ?? '').trim();
        if (!String(taxonomy.id ?? '').trim()) {
            taxonomy.id = slug_from_label(label, `taxonomy-${tax_index + 1}`);
        }
        const concepts = Array.isArray(taxonomy.concepts) ? taxonomy.concepts : [];
        concepts.forEach((concept, concept_index) => {
            const concept_label = String(concept.label ?? '').trim();
            if (!String(concept.id ?? '').trim()) {
                concept.id = slug_from_label(concept_label, `concept-${tax_index + 1}-${concept_index + 1}`);
            }
        });
        taxonomy.concepts = concepts;
    });
}

/**
 * Renderar förenklad taxonomiredigering.
 */
export function render_taxonomy_simplified_editor(
    ctx: EditorCtx,
    container: HTMLElement,
    working_metadata: WorkingMetadata,
    options: { on_change?: () => void } = {}
): void {
    const { Helpers, Translation } = ctx;
    container.innerHTML = '';
    const taxonomies = ensure_taxonomies(working_metadata);
    assign_stable_ids(taxonomies);

    container.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: Translation.t('rulefile_classifications_taxonomy_edit_intro'),
        })
    );
    render_primary_select(ctx, container, working_metadata, options.on_change);

    taxonomies.forEach((taxonomy, taxonomy_index) => {
        render_taxonomy_simplified_card(ctx, container, working_metadata, taxonomy_index, options);
    });

    container.appendChild(
        create_action_button(ctx, Translation.t('rulefile_metadata_add_taxonomy'), 'add', () => {
            taxonomies.push({ id: '', label: '', version: '', uri: '', concepts: [] });
            render_taxonomy_simplified_editor(ctx, container, working_metadata, options);
            options.on_change?.();
        })
    );
}

function render_taxonomy_simplified_card(
    ctx: EditorCtx,
    container: HTMLElement,
    working_metadata: WorkingMetadata,
    taxonomy_index: number,
    options: { on_change?: () => void; rerender?: () => void } = {}
): void {
    const { Helpers, Translation } = ctx;
    const taxonomies = ensure_taxonomies(working_metadata);
    const entry = taxonomies[taxonomy_index]!;
    entry.concepts = Array.isArray(entry.concepts) ? entry.concepts : [];
    const card = Helpers.create_element('article', { class_name: 'editable-card taxonomy-simplified-card' });
    const header = Helpers.create_element('div', { class_name: 'editable-card-header' });
    const heading = Helpers.create_element('h3', {
        text_content: entry.label || Translation.t('rulefile_metadata_untitled_item'),
    });
    const remove_taxonomy_label = Translation.t('rulefile_metadata_remove_taxonomy', {
        name: heading.textContent,
    });
    header.append(
        heading,
        create_action_button(ctx, remove_taxonomy_label, 'delete', () => {
            taxonomies.splice(taxonomy_index, 1);
            if (options.rerender) {
                options.rerender();
            } else {
                render_taxonomy_simplified_editor(ctx, container, working_metadata, options);
            }
            options.on_change?.();
        }, 'danger')
    );
    card.appendChild(header);
    card.appendChild(
        create_labeled_input(ctx, Translation.t('rulefile_metadata_field_label'), entry.label || '', (value) => {
            entry.label = value;
            heading.textContent = value || Translation.t('rulefile_metadata_untitled_item');
            options.on_change?.();
        })
    );

    const concept_list = Helpers.create_element('ul', { class_name: 'taxonomy-concept-list' });
    entry.concepts.forEach((concept, concept_index) => {
        const row = Helpers.create_element('li', { class_name: 'taxonomy-concept-row' });
        row.appendChild(
            create_labeled_input(ctx, Translation.t('rulefile_classifications_concept_label'), concept.label || '', (value) => {
                concept.label = value;
                options.on_change?.();
            })
        );
        const remove_concept_label = Translation.t('rulefile_metadata_remove_taxonomy_concept', {
            name: concept.label || Translation.t('rulefile_metadata_untitled_item'),
        });
        row.appendChild(
            create_action_button(ctx, remove_concept_label, 'delete', () => {
                entry.concepts!.splice(concept_index, 1);
                if (options.rerender) {
                    options.rerender();
                } else {
                    render_taxonomy_simplified_editor(ctx, container, working_metadata, options);
                }
                options.on_change?.();
            }, 'danger')
        );
        concept_list.appendChild(row);
    });
    card.appendChild(concept_list);
    card.appendChild(
        create_action_button(ctx, Translation.t('rulefile_metadata_add_taxonomy_concept'), 'add', () => {
            entry.concepts!.push({ id: '', label: '' });
            if (options.rerender) {
                options.rerender();
            } else {
                render_taxonomy_simplified_editor(ctx, container, working_metadata, options);
            }
            options.on_change?.();
        })
    );
    container.appendChild(card);
}

/**
 * Redigerar en enskild taxonomi (namn och begrepp).
 */
export function render_single_taxonomy_simplified_editor(
    ctx: EditorCtx,
    container: HTMLElement,
    working_metadata: WorkingMetadata,
    taxonomy_key: string,
    options: { on_change?: () => void } = {}
): boolean {
    const { Helpers, Translation } = ctx;
    container.innerHTML = '';
    const taxonomies = ensure_taxonomies(working_metadata);
    assign_stable_ids(taxonomies);

    const normalized_key = String(taxonomy_key ?? '').trim().toLowerCase();
    const taxonomy_index = taxonomies.findIndex((row, index) => {
        const id = String(row.id ?? '').trim().toLowerCase();
        if (id && id === normalized_key) return true;
        const fallback = `taxonomy-${index + 1}`.toLowerCase();
        return fallback === normalized_key;
    });

    if (taxonomy_index < 0) {
        container.appendChild(
            Helpers.create_element('p', {
                class_name: 'metadata-empty',
                text_content: Translation.t('rulefile_classifications_taxonomy_not_found'),
            })
        );
        return false;
    }

    container.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: Translation.t('rulefile_classifications_taxonomy_single_edit_intro'),
        })
    );

    const rerender = () => {
        render_single_taxonomy_simplified_editor(ctx, container, working_metadata, taxonomy_key, options);
    };
    render_taxonomy_simplified_card(ctx, container, working_metadata, taxonomy_index, {
        ...options,
        rerender,
    });
    return true;
}


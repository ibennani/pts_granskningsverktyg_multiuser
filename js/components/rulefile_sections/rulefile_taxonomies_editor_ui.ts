/**
 * @fileoverview Redigerbar taxonomilista med id-fält och primär grupperingstaxonomi.
 */
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';

type EditorCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        escape_html?: (value: string) => string;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
        init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
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

type SmallButton = HTMLElement & {
    updateButtonText?: (text: string, ariaLabel?: string) => void;
};

function create_inline_input(
    ctx: EditorCtx,
    label_key: string,
    value: string,
    on_change: (value: string) => void,
    options: { raw_label?: string | null; textarea?: boolean } = {}
): HTMLElement {
    const { Helpers, Translation } = ctx;
    const wrapper = Helpers.create_element('div', { class_name: 'inline-field' });
    const input_id = `inline-${Math.random().toString(36).substring(2, 10)}`;
    const label_text = options.raw_label ?? Translation.t(label_key);
    wrapper.appendChild(
        Helpers.create_element('label', { attributes: { for: input_id }, text_content: label_text })
    );

    let input: HTMLInputElement | HTMLTextAreaElement;
    if (options.textarea) {
        input = Helpers.create_element('textarea', {
            class_name: 'form-control form-control-compact',
            attributes: { id: input_id, rows: '3' },
        }) as HTMLTextAreaElement;
        input.value = value ?? '';
        Helpers.init_auto_resize_for_textarea?.(input);
    } else {
        input = Helpers.create_element('input', {
            class_name: 'form-control form-control-compact',
            attributes: { id: input_id, type: 'text' },
        }) as HTMLInputElement;
        input.value = value ?? '';
    }
    input.addEventListener('input', (event) => {
        on_change((event.target as HTMLInputElement).value);
    });
    wrapper.appendChild(input);
    return wrapper;
}

function create_small_button(
    ctx: EditorCtx,
    text_or_key: string,
    icon_name: string,
    on_click: () => void,
    variant = 'secondary',
    options: { plain_text?: boolean; aria_label?: string | null } = {}
): SmallButton {
    const { Helpers, Translation } = ctx;
    const resolve_text = (value: string) => (options.plain_text ? value : Translation.t(value));
    const compute_html = (value: string) => {
        const label = resolve_text(value);
        const safe_label = Helpers.escape_html ? Helpers.escape_html(label) : label;
        const icon =
            icon_name && Helpers.get_icon_svg ? Helpers.get_icon_svg(icon_name) : '';
        return `<span>${safe_label}</span>${icon}`;
    };

    const button = Helpers.create_element('button', {
        class_name: ['button', `button-${variant}`, 'button-small'],
        attributes: {
            type: 'button',
            ...(options.aria_label ? { 'aria-label': options.aria_label } : {}),
        },
        html_content: compute_html(text_or_key),
    }) as SmallButton;

    button.addEventListener('click', on_click);
    button.updateButtonText = (text: string, aria_label?: string) => {
        button.innerHTML = compute_html(text);
        if (aria_label) {
            button.setAttribute('aria-label', aria_label);
        }
    };
    return button;
}

function ensure_taxonomies_array(working_metadata: WorkingMetadata): TaxonomyEntry[] {
    if (!Array.isArray(working_metadata.taxonomies)) {
        working_metadata.taxonomies = [];
    }
    return working_metadata.taxonomies;
}

function render_primary_grouping_select(
    ctx: EditorCtx,
    container: HTMLElement,
    working_metadata: WorkingMetadata,
    on_change?: () => void
): void {
    const { Helpers, Translation } = ctx;
    const taxonomies = resolve_taxonomies(working_metadata) as TaxonomyEntry[];
    const field = Helpers.create_element('div', { class_name: 'form-group primary-grouping-taxonomy-field' });
    const select_id = `primary-grouping-taxonomy-${Math.random().toString(36).substring(2, 8)}`;
    field.appendChild(
        Helpers.create_element('label', {
            attributes: { for: select_id },
            text_content: Translation.t('rulefile_classifications_primary_grouping_label'),
        })
    );
    const select = Helpers.create_element('select', {
        class_name: 'form-control',
        attributes: { id: select_id, name: 'primaryGroupingTaxonomyId' },
    }) as HTMLSelectElement;

    const empty_option = Helpers.create_element('option', {
        attributes: { value: '' },
        text_content: Translation.t('rulefile_classifications_primary_grouping_none'),
    });
    select.appendChild(empty_option);

    taxonomies.forEach((taxonomy) => {
        const taxonomy_id = String(taxonomy?.id ?? '').trim();
        if (!taxonomy_id) return;
        const label = taxonomy.label || taxonomy_id;
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: taxonomy_id },
                text_content: label,
            })
        );
    });

    const current = String(working_metadata.primaryGroupingTaxonomyId ?? '').trim();
    select.value = current;
    select.addEventListener('change', () => {
        working_metadata.primaryGroupingTaxonomyId = select.value.trim();
        on_change?.();
    });

    field.appendChild(select);
    container.appendChild(field);
}

/**
 * Renderar taxonomiredigeraren i given container.
 */
export function render_taxonomies_editor(
    ctx: EditorCtx,
    container: HTMLElement,
    working_metadata: WorkingMetadata,
    options: { show_primary_grouping?: boolean; on_change?: () => void } = {}
): void {
    const { Helpers, Translation } = ctx;
    container.innerHTML = '';
    const taxonomies = ensure_taxonomies_array(working_metadata);

    if (options.show_primary_grouping !== false) {
        render_primary_grouping_select(ctx, container, working_metadata, options.on_change);
    }

    if (taxonomies.length === 0) {
        container.appendChild(
            Helpers.create_element('p', {
                class_name: 'editable-empty',
                text_content: Translation.t('rulefile_metadata_empty_value'),
            })
        );
    }

    taxonomies.forEach((taxonomy, taxonomy_index) => {
        if (!taxonomy) {
            taxonomies[taxonomy_index] = { id: '', label: '', version: '', uri: '', concepts: [] };
        }
        const entry = taxonomies[taxonomy_index]!;
        entry.concepts = Array.isArray(entry.concepts) ? entry.concepts : [];

        const card = Helpers.create_element('article', { class_name: 'editable-card' });
        const heading_row = Helpers.create_element('div', { class_name: 'editable-card-header' });
        const heading = Helpers.create_element('h3', {
            text_content: entry.label || Translation.t('rulefile_metadata_untitled_item'),
        });
        const remove_initial = Translation.t('rulefile_metadata_remove_taxonomy', {
            name: heading.textContent,
        });
        const remove_btn = create_small_button(
            ctx,
            remove_initial,
            'delete',
            () => {
                taxonomies.splice(taxonomy_index, 1);
                render_taxonomies_editor(ctx, container, working_metadata, options);
                options.on_change?.();
            },
            'danger',
            { plain_text: true, aria_label: remove_initial }
        );
        heading_row.append(heading, remove_btn);
        card.appendChild(heading_row);

        card.appendChild(
            create_inline_input(ctx, 'rulefile_metadata_field_taxonomy_id', entry.id || '', (value) => {
                entry.id = value;
                options.on_change?.();
            })
        );
        card.appendChild(
            create_inline_input(ctx, 'rulefile_metadata_field_label', entry.label || '', (value) => {
                entry.label = value;
                const updated_name = value || Translation.t('rulefile_metadata_untitled_item');
                heading.textContent = updated_name;
                const updated_label = Translation.t('rulefile_metadata_remove_taxonomy', {
                    name: updated_name,
                });
                remove_btn.updateButtonText?.(updated_label, updated_label);
                options.on_change?.();
            })
        );
        card.appendChild(
            create_inline_input(ctx, 'rulefile_metadata_field_taxonomy_version', entry.version || '', (value) => {
                entry.version = value;
                options.on_change?.();
            })
        );
        card.appendChild(
            create_inline_input(ctx, 'rulefile_metadata_field_taxonomy_uri', entry.uri || '', (value) => {
                entry.uri = value;
                options.on_change?.();
            })
        );

        const concept_list = Helpers.create_element('div', { class_name: 'editable-sublist' });
        entry.concepts.forEach((concept, concept_index) => {
            if (!concept) {
                entry.concepts![concept_index] = { id: '', label: '' };
            }
            const concept_entry = entry.concepts![concept_index]!;
            const row = Helpers.create_element('div', { class_name: 'editable-list-row concept-row' });
            const concept_name = concept_entry.label || Translation.t('rulefile_metadata_untitled_item');
            const remove_concept_initial = Translation.t('rulefile_metadata_remove_taxonomy_concept', {
                name: concept_name,
            });
            const remove_concept_btn = create_small_button(
                ctx,
                remove_concept_initial,
                'delete',
                () => {
                    entry.concepts!.splice(concept_index, 1);
                    render_taxonomies_editor(ctx, container, working_metadata, options);
                    options.on_change?.();
                },
                'danger',
                { plain_text: true, aria_label: remove_concept_initial }
            );

            row.appendChild(
                create_inline_input(ctx, 'rulefile_metadata_field_taxonomy_id', concept_entry.id || '', (value) => {
                    concept_entry.id = value;
                    options.on_change?.();
                }, { raw_label: Translation.t('rulefile_classifications_concept_id_label') })
            );
            row.appendChild(
                create_inline_input(ctx, 'rulefile_metadata_field_label', concept_entry.label || '', (value) => {
                    concept_entry.label = value;
                    const updated_name = value || Translation.t('rulefile_metadata_untitled_item');
                    const updated_label = Translation.t('rulefile_metadata_remove_taxonomy_concept', {
                        name: updated_name,
                    });
                    remove_concept_btn.updateButtonText?.(updated_label, updated_label);
                    options.on_change?.();
                })
            );
            row.appendChild(remove_concept_btn);
            concept_list.appendChild(row);
        });

        concept_list.appendChild(
            create_small_button(ctx, 'rulefile_metadata_add_taxonomy_concept', 'add', () => {
                entry.concepts!.push({ id: '', label: '' });
                render_taxonomies_editor(ctx, container, working_metadata, options);
                options.on_change?.();
            })
        );
        card.appendChild(concept_list);
        container.appendChild(card);
    });

    container.appendChild(
        create_small_button(ctx, 'rulefile_metadata_add_taxonomy', 'add', () => {
            taxonomies.push({ id: '', label: '', version: '', uri: '', concepts: [] });
            render_taxonomies_editor(ctx, container, working_metadata, options);
            options.on_change?.();
        })
    );
}

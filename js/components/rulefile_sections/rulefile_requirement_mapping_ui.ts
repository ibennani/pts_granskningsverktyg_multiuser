/**
 * @fileoverview Matris- och kortvy för koppling mellan krav och taxonomibegrepp.
 */
import { normalize_requirements_to_record } from '../../logic/requirement_lookup.js';
import { get_requirement_display_label } from '../../logic/requirement_display_name.js';
import { resolve_taxonomy_concepts } from '../../logic/requirement_classifications.js';
import {
    append_classifications_table_filter_to_layout,
    create_classifications_table_layout,
} from './rulefile_classifications_table_ui.js';
import {
    apply_all_taxonomy_states,
    build_all_taxonomy_states,
    build_initial_checkbox_state,
    build_taxonomy_select_field,
    read_taxonomy_rows,
    resolve_default_taxonomy_id,
} from './rulefile_requirement_mapping_taxonomy_ui.js';
import type { CheckboxRefs, MappingCtx, MappingViewHandles, RequirementRow } from './rulefile_requirement_mapping_types.js';
import {
    attach_mapping_filters,
    create_set_concept_checked,
    render_mapping_views,
} from './rulefile_requirement_mapping_views.js';

export { build_mapping_checkbox_key } from './rulefile_requirement_mapping_keys.js';

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
    const taxonomies = read_taxonomy_rows(metadata).filter(
        (taxonomy) => String(taxonomy.id ?? '').trim()
    );

    if (taxonomies.length === 0) {
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

    const layout = create_classifications_table_layout(Helpers);
    layout.classList.add('requirement-mapping-layout');

    const rows = build_requirement_rows(rule_file_content.requirements);
    const taxonomy_states = build_all_taxonomy_states(rows, metadata, taxonomies, t);
    let current_taxonomy_id = resolve_default_taxonomy_id(taxonomies, rule_file_content);
    const checkbox_refs = new Map<string, CheckboxRefs>();

    const { field: taxonomy_field, select: taxonomy_select } = build_taxonomy_select_field(
        ctx,
        taxonomies,
        current_taxonomy_id
    );
    layout.appendChild(taxonomy_field);

    const filter_input = append_classifications_table_filter_to_layout(layout, ctx, rows.length, {
        label_key: 'rulefile_classifications_mapping_filter_label',
        id_prefix: 'requirement-mapping-filter',
    });

    const content_area = Helpers.create_element('div', {
        class_name: 'requirement-mapping-content',
    });
    layout.appendChild(content_area);
    container.appendChild(layout);

    const no_concepts_hint = Helpers.create_element('p', {
        class_name: 'field-hint requirement-mapping-no-concepts-hint',
    });

    const filter_matrix_rows: HTMLElement[] = [];
    const filter_card_elements: HTMLElement[] = [];

    const sync_filter_targets = (handles: MappingViewHandles) => {
        filter_matrix_rows.length = 0;
        filter_matrix_rows.push(...handles.matrix_row_elements);
        filter_card_elements.length = 0;
        filter_card_elements.push(...handles.card_elements);
    };

    const refresh_mapping_views = () => {
        checkbox_refs.clear();
        const concepts = resolve_taxonomy_concepts(metadata, current_taxonomy_id, t);
        if (concepts.length === 0) {
            content_area.replaceChildren(no_concepts_hint);
            no_concepts_hint.textContent = t('rulefile_classifications_mapping_no_concepts');
            sync_filter_targets({ matrix_row_elements: [], card_elements: [] });
            return;
        }
        let checkbox_state = taxonomy_states.get(current_taxonomy_id);
        if (!checkbox_state) {
            checkbox_state = build_initial_checkbox_state(rows, concepts, current_taxonomy_id);
            taxonomy_states.set(current_taxonomy_id, checkbox_state);
        }
        const set_concept_checked = create_set_concept_checked(
            checkbox_state,
            checkbox_refs,
            on_change
        );
        sync_filter_targets(
            render_mapping_views(
                ctx,
                content_area,
                rows,
                concepts,
                checkbox_state,
                checkbox_refs,
                set_concept_checked
            )
        );
        if (filter_input?.value.trim()) {
            filter_input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    taxonomy_select.addEventListener('change', () => {
        current_taxonomy_id = taxonomy_select.value.trim();
        refresh_mapping_views();
    });

    refresh_mapping_views();
    attach_mapping_filters(filter_input, {
        matrix_row_elements: filter_matrix_rows,
        card_elements: filter_card_elements,
    });

    return {
        apply_changes: () =>
            apply_all_taxonomy_states(rule_file_content, metadata, taxonomy_states, t),
    };
}

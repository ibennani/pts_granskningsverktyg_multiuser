/**
 * @fileoverview Visningsvyer för Klassificeringar-hubben och undersidor.
 */
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import {
    count_unclassified_requirements,
    get_primary_grouping_taxonomy_id,
    resolve_taxonomy_by_id,
} from '../../logic/requirement_classifications.js';
import { render_rulefile_classifications_hub } from './rulefile_classifications_hub_render.js';
import {
    normalize_classification_part_param,
    type ClassificationPartId,
} from './rulefile_classifications_parts.js';
import { create_rulefile_classifications_back_row } from './rulefile_classifications_nav.js';
import { render_audit_types_view_section } from './rulefile_audit_types_ui.js';
import { render_deficiency_types_view_section } from './rulefile_deficiency_types_ui.js';
import { create_definition_list } from './rulefile_sections_display_helpers.js';

type ViewCtx = {
    Helpers: { create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    router: (view: string, params?: Record<string, string>) => void;
};

export function render_rulefile_classifications_hub_section(ctx: ViewCtx): HTMLElement {
    const section = ctx.Helpers.create_element('section', { class_name: 'rulefile-section-content' });
    render_rulefile_classifications_hub(ctx, section);
    return section;
}

export function render_rulefile_classifications_part_section(
    ctx: ViewCtx,
    part: ClassificationPartId,
    metadata: Record<string, unknown>,
    ruleFileContent: Record<string, unknown> | null
): HTMLElement {
    if (part === 'deficiency_types') {
        return render_deficiency_types_view_section(ctx, ruleFileContent || {}, { show_back: true });
    }
    if (part === 'audit_types') {
        return render_audit_types_view_section(ctx, metadata, { show_back: true });
    }
    if (part === 'mapping') {
        return render_mapping_view_section(ctx, metadata, ruleFileContent);
    }
    return render_taxonomy_view_section(ctx, metadata);
}

function render_taxonomy_view_section(ctx: ViewCtx, metadata: Record<string, unknown>): HTMLElement {
    const { Helpers, Translation: { t }, router } = ctx;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });
    section.appendChild(create_rulefile_classifications_back_row(ctx));

    const primary_taxonomy_id = get_primary_grouping_taxonomy_id({ metadata });
    const primary_taxonomy = resolve_taxonomy_by_id(metadata, primary_taxonomy_id);
    section.appendChild(
        Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('rulefile_classifications_taxonomy_view_intro'),
        })
    );
    section.appendChild(
        create_definition_list(Helpers, [
            [t('rulefile_classifications_primary_grouping_label'), primary_taxonomy?.label || primary_taxonomy_id || t('rulefile_metadata_empty_value')],
        ])
    );

    const taxonomies = resolve_taxonomies(metadata) as Array<{ label?: string; id?: string; concepts?: Array<{ label?: string }> }>;
    taxonomies.forEach((taxonomy) => {
        const block = Helpers.create_element('div', { class_name: 'metadata-subsection' });
        block.appendChild(
            Helpers.create_element('h2', {
                text_content: taxonomy.label || taxonomy.id || t('rulefile_metadata_untitled_item'),
            })
        );
        if (!Array.isArray(taxonomy.concepts) || taxonomy.concepts.length === 0) {
            block.appendChild(
                Helpers.create_element('p', {
                    class_name: 'metadata-empty',
                    text_content: t('rulefile_metadata_empty_value'),
                })
            );
        } else {
            const list = Helpers.create_element('ul', { class_name: 'metadata-list taxonomy-concept-view-list' });
            taxonomy.concepts.forEach((concept) => {
                list.appendChild(
                    Helpers.create_element('li', {
                        text_content: concept.label || t('rulefile_metadata_untitled_item'),
                    })
                );
            });
            block.appendChild(list);
        }
        section.appendChild(block);
    });

    if (taxonomies.length === 0) {
        section.appendChild(
            Helpers.create_element('p', {
                class_name: 'metadata-empty',
                text_content: t('rulefile_metadata_empty_value'),
            })
        );
    }

    return section;
}

function render_mapping_view_section(
    ctx: ViewCtx,
    metadata: Record<string, unknown>,
    ruleFileContent: Record<string, unknown> | null
): HTMLElement {
    const { Helpers, Translation: { t }, router } = ctx;
    const section = Helpers.create_element('section', { class_name: 'rulefile-section-content' });
    section.appendChild(create_rulefile_classifications_back_row(ctx));

    const primary_taxonomy_id = get_primary_grouping_taxonomy_id(ruleFileContent || { metadata });
    const unclassified_count = count_unclassified_requirements(
        ruleFileContent?.requirements as Record<string, unknown> | unknown[] | null | undefined,
        primary_taxonomy_id
    );

    section.appendChild(
        Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('rulefile_classifications_mapping_view_intro'),
        })
    );
    section.appendChild(
        create_definition_list(Helpers, [
            [t('rulefile_classifications_unclassified_count_label'), String(unclassified_count)],
        ])
    );
    section.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: t('rulefile_classifications_mapping_view_hint'),
        })
    );
    return section;
}

export function resolve_classifications_part(raw: unknown): ClassificationPartId | '' {
    return normalize_classification_part_param(raw);
}

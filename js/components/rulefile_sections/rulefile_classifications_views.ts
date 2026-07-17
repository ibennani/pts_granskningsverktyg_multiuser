/**
 * @fileoverview Visningsvyer för Klassificeringar-hubben och undersidor.
 */
import {
    count_unclassified_requirements,
    get_primary_grouping_taxonomy_id,
} from '../../logic/requirement_classifications.js';
import { render_rulefile_classifications_hub } from './rulefile_classifications_hub_render.js';
import {
    normalize_classification_part_param,
    type ClassificationPartId,
} from './rulefile_classifications_parts.js';
import { create_rulefile_classifications_back_row } from './rulefile_classifications_nav.js';
import { render_audit_types_view_section } from './rulefile_audit_types_ui.js';
import { render_deficiency_types_view_section } from './rulefile_deficiency_types_ui.js';
import { render_taxonomy_view_section } from './rulefile_taxonomy_view_ui.js';
import { render_taxonomy_detail_ui } from './rulefile_taxonomy_detail_ui.js';
import { create_definition_list } from './rulefile_sections_display_helpers.js';

type ViewCtx = {
    Helpers: { create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    router: (view: string, params?: Record<string, string>) => void;
    getState?: () => Record<string, unknown>;
    dispatch?: (action: unknown) => void;
    StoreActionTypes?: { UPDATE_RULEFILE_CONTENT: string };
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
    ruleFileContent: Record<string, unknown> | null,
    params: Record<string, string> = {}
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
    const taxonomy_id = String(params.taxonomyId ?? '').trim();
    if (taxonomy_id) {
        return render_taxonomy_detail_ui(ctx, metadata, taxonomy_id);
    }
    return render_taxonomy_view_section(ctx, metadata);
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

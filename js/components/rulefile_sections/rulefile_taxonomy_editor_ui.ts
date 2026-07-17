/**
 * @fileoverview Redigering av en taxonomi i Klassificeringar (enskild eller ny).
 * Primär grupperingstaxonomi hanteras inte här. Befintligt värde i metadata lämnas oförändrat vid sparning.
 */
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import type { TaxonomyEntryPersist } from '../../logic/taxonomy_persist.js';
import { build_principles_section } from './rulefile_taxonomy_principles_editor_ui.js';

export type TaxonomyEditorCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        escape_html?: (value: string) => string;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
        init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
};

type WorkingMetadata = {
    taxonomies?: TaxonomyEntryPersist[];
    primaryGroupingTaxonomyId?: string;
    [key: string]: unknown;
};

type EditorOptions = {
    taxonomy_key?: string;
    is_create?: boolean;
    draft_taxonomy?: TaxonomyEntryPersist;
    on_change?: () => void;
};

function ensure_taxonomies(working_metadata: WorkingMetadata): TaxonomyEntryPersist[] {
    if (!Array.isArray(working_metadata.taxonomies)) {
        working_metadata.taxonomies = [];
    }
    return working_metadata.taxonomies;
}

function create_taxonomy_name_field(
    ctx: TaxonomyEditorCtx,
    label_text: string,
    input_id: string,
    value: string,
    on_input: (value: string) => void
): HTMLElement {
    const { Helpers } = ctx;
    const field = Helpers.create_element('div', { class_name: 'form-group taxonomy-editor-name-field' });
    field.appendChild(
        Helpers.create_element('label', {
            attributes: { for: input_id },
            text_content: label_text,
        })
    );
    const input = Helpers.create_element('input', {
        class_name: 'form-control',
        attributes: { id: input_id, type: 'text', name: 'taxonomy-label' },
    }) as HTMLInputElement;
    input.value = value;
    input.addEventListener('input', () => on_input(input.value));
    field.appendChild(input);
    return field;
}

function resolve_edit_entry(
    working_metadata: WorkingMetadata,
    options: EditorOptions
): TaxonomyEntryPersist | null {
    if (options.is_create) {
        if (!options.draft_taxonomy) return null;
        options.draft_taxonomy.concepts = Array.isArray(options.draft_taxonomy.concepts)
            ? options.draft_taxonomy.concepts
            : [];
        return options.draft_taxonomy;
    }
    const key = String(options.taxonomy_key ?? '').trim().toLowerCase();
    if (!key) return null;
    const taxonomies = ensure_taxonomies(working_metadata);
    const index = taxonomies.findIndex((row, row_index) => {
        const id = String(row.id ?? '').trim().toLowerCase();
        if (id && id === key) return true;
        return `taxonomy-${row_index + 1}`.toLowerCase() === key;
    });
    if (index < 0) return null;
    const entry = taxonomies[index]!;
    entry.concepts = Array.isArray(entry.concepts) ? entry.concepts : [];
    return entry;
}

export function render_taxonomy_editor_ui(
    ctx: TaxonomyEditorCtx,
    container: HTMLElement,
    working_metadata: WorkingMetadata,
    options: EditorOptions = {}
): boolean {
    const { Helpers, Translation: { t } } = ctx;
    container.innerHTML = '';

    const entry = resolve_edit_entry(working_metadata, options);
    if (!entry) {
        container.appendChild(
            Helpers.create_element('p', {
                class_name: 'metadata-empty',
                text_content: t('rulefile_classifications_taxonomy_not_found'),
            })
        );
        return false;
    }

    const editor_root = Helpers.create_element('div', { class_name: 'taxonomy-editor' });
    const intro_key = options.is_create
        ? 'rulefile_classifications_taxonomy_create_intro'
        : 'rulefile_classifications_taxonomy_single_edit_intro';
    editor_root.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint taxonomy-editor-intro',
            text_content: t(intro_key),
        })
    );

    const name_id = `taxonomy-name-${Math.random().toString(36).slice(2, 8)}`;
    editor_root.appendChild(
        create_taxonomy_name_field(
            ctx,
            t('rulefile_classifications_taxonomy_name_field_label'),
            name_id,
            entry.label ?? '',
            (value) => {
                entry.label = value;
                options.on_change?.();
            }
        )
    );

    editor_root.appendChild(build_principles_section(ctx, entry, options.on_change));
    container.appendChild(editor_root);
    return true;
}

export function append_draft_taxonomy_on_save(
    working_metadata: WorkingMetadata,
    draft: TaxonomyEntryPersist
): TaxonomyEntryPersist {
    const taxonomies = ensure_taxonomies(working_metadata);
    const copy = {
        id: draft.id ?? '',
        label: draft.label ?? '',
        version: draft.version ?? '',
        uri: draft.uri ?? '',
        concepts: Array.isArray(draft.concepts) ? [...draft.concepts] : [],
    };
    taxonomies.push(copy);
    return copy;
}

export function resolve_taxonomy_key_after_save(
    working_metadata: WorkingMetadata,
    taxonomy: TaxonomyEntryPersist
): string {
    const taxonomies = resolve_taxonomies(working_metadata) as TaxonomyEntryPersist[];
    const index = taxonomies.indexOf(taxonomy);
    if (index >= 0) {
        return String(taxonomy.id ?? '').trim() || `taxonomy-${index + 1}`;
    }
    const id = String(taxonomy.id ?? '').trim();
    if (id) return id;
    return `taxonomy-${taxonomies.length}`;
}

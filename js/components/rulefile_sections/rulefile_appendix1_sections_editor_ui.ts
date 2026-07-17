/**

 * @fileoverview Redigerings-UI för Bilaga 1 brödtext och bristgrupper i regelfilen.

 */

import { taxonomy_uses_legacy_appendix1_body_text_fallback } from '../../logic/appendix1_body_text.js';

import {
  generate_deficiency_sections_from_taxonomy,
  read_rulefile_appendix1_body_text,
  read_rulefile_appendix1_body_text_by_taxonomy,
  read_rulefile_appendix1_grouping_taxonomy_id,
} from '../../logic/appendix1_sections.js';

import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';

import type { Appendix1SectionDefinition } from '../../logic/appendix1_sections_types.js';

import { render_deficiency_intro_editor } from './rulefile_appendix1_deficiency_intros_editor_ui.js';

import {
  append_field_hint,
  create_appendix1_section_panel,
  render_appendix1_deficiency_groups_preview,
  render_appendix1_placeholder_section,
} from './rulefile_appendix1_shared_ui.js';

type EditorCtx = {
  Helpers: {
    create_element: (
      tag: string,
      opts?: Record<string, unknown>
    ) => HTMLElement;

    escape_html?: (value: string) => string;

    get_icon_svg?: (name: string, colors?: string[], size?: number) => string;

    init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
  };

  Translation: { t: (key: string, opts?: Record<string, unknown>) => string };

  NotificationComponent?: {
    show_global_message?: (msg: string, type: string) => void;
  };
};

function create_form_field_label(
  Helpers: EditorCtx['Helpers'],

  for_id: string,

  label_text: string
): HTMLLabelElement {
  const safe_label = Helpers.escape_html
    ? Helpers.escape_html(label_text)
    : label_text;

  return Helpers.create_element('label', {
    attributes: { for: for_id },

    html_content: `<strong>${safe_label}</strong>`,
  }) as HTMLLabelElement;
}

function persist_current_body_text(
  body_text_by_taxonomy: Map<string, string>,

  taxonomy_id: string,

  body_text: string
): void {
  const id = taxonomy_id.trim();

  if (!id) return;

  body_text_by_taxonomy.set(id, body_text);
}

function load_body_text_for_taxonomy(
  body_text_by_taxonomy: Map<string, string>,

  taxonomy_id: string,

  fallback_body_text: string
): string {
  const id = taxonomy_id.trim();

  if (id && body_text_by_taxonomy.has(id)) {
    return body_text_by_taxonomy.get(id) ?? fallback_body_text;
  }

  if (id && !taxonomy_uses_legacy_appendix1_body_text_fallback(id)) {
    return '';
  }

  return fallback_body_text;
}

export function render_appendix1_sections_editor(
  ctx: EditorCtx,

  container: HTMLElement,

  rule_file_content: Record<string, unknown>,

  options: {
    on_change?: () => void;

    on_generate?: (sections: Appendix1SectionDefinition[]) => void;
  } = {}
): {
  get_body_text: () => string;

  get_body_text_by_taxonomy: () => Record<string, string>;

  get_sections: () => Appendix1SectionDefinition[];

  get_grouping_taxonomy_id: () => string;

  get_concept_intros: () => Record<string, string>;
} {
  const { Helpers, Translation } = ctx;

  const t = Translation.t;

  container.innerHTML = '';

  container.classList.add('appendix1-sections-editor-host');

  let grouping_taxonomy_id =
    read_rulefile_appendix1_grouping_taxonomy_id(rule_file_content);

  const taxonomies = resolve_taxonomies(
    rule_file_content.metadata as Record<string, unknown>
  ) as Array<{
    id?: string;

    label?: string;
  }>;

  const taxonomy_ids = taxonomies

    .map((taxonomy) => String(taxonomy.id ?? '').trim())

    .filter(Boolean);

  const body_text_by_taxonomy = new Map<string, string>(
    Object.entries(
      read_rulefile_appendix1_body_text_by_taxonomy(
        rule_file_content,
        taxonomy_ids
      )
    )
  );

  const persisted_body_text_by_taxonomy = Object.fromEntries(
    body_text_by_taxonomy
  );

  let body_text = load_body_text_for_taxonomy(
    body_text_by_taxonomy,

    grouping_taxonomy_id,

    read_rulefile_appendix1_body_text(rule_file_content, grouping_taxonomy_id)
  );

  persist_current_body_text(
    body_text_by_taxonomy,
    grouping_taxonomy_id,
    body_text
  );

  let deficiency_sections = generate_deficiency_sections_from_taxonomy(
    {
      ...rule_file_content,

      appendix1: {
        ...(rule_file_content.appendix1 as Record<string, unknown> | undefined),

        groupingTaxonomyId: grouping_taxonomy_id,
      },
    },

    t
  );

  const body_panel = create_appendix1_section_panel(
    Helpers,

    'rulefile_appendix1_body_text_heading',

    t
  ).panel;

  append_field_hint(
    Helpers,
    body_panel,
    t('rulefile_appendix1_body_text_intro_lead')
  );

  append_field_hint(
    Helpers,
    body_panel,
    t('rulefile_appendix1_body_text_markdown_hint')
  );

  const body_field = Helpers.create_element('div', {
    class_name: 'form-group',
  });

  const body_id = `appendix1-body-text-${Math.random().toString(36).slice(2, 8)}`;

  body_field.appendChild(
    create_form_field_label(
      Helpers,
      body_id,
      t('rulefile_appendix1_body_text_label')
    )
  );

  const body_input = Helpers.create_element('textarea', {
    class_name: 'form-control appendix1-body-text-editor',

    attributes: { id: body_id, rows: '24' },
  }) as HTMLTextAreaElement;

  body_input.value = body_text;

  Helpers.init_auto_resize_for_textarea?.(body_input);

  body_field.appendChild(body_input);

  body_panel.appendChild(body_field);

  container.appendChild(body_panel);

  const taxonomy_panel = create_appendix1_section_panel(
    Helpers,

    'rulefile_appendix1_taxonomy_groups_heading',

    t
  ).panel;

  append_field_hint(
    Helpers,
    taxonomy_panel,
    t('rulefile_appendix1_taxonomy_groups_hint')
  );

  append_field_hint(
    Helpers,
    taxonomy_panel,
    t('rulefile_appendix1_body_text_auto_generated_note')
  );

  append_field_hint(
    Helpers,
    taxonomy_panel,
    t('rulefile_appendix1_body_text_per_taxonomy_hint')
  );

  const taxonomy_field = Helpers.create_element('div', {
    class_name: 'form-group appendix1-grouping-taxonomy-field',
  });

  const select_id = `appendix1-grouping-taxonomy-${Math.random().toString(36).slice(2, 8)}`;

  taxonomy_field.appendChild(
    create_form_field_label(
      Helpers,
      select_id,
      t('rulefile_appendix1_grouping_taxonomy_label')
    )
  );

  const select = Helpers.create_element('select', {
    class_name: [
      'form-control',
      'dropdown-select',
      'appendix1-grouping-taxonomy-select',
    ],

    attributes: { id: select_id, name: 'appendix1GroupingTaxonomyId' },
  }) as HTMLSelectElement;

  taxonomies.forEach((taxonomy) => {
    const id = String(taxonomy.id ?? '').trim();

    if (!id) return;

    select.appendChild(
      Helpers.create_element('option', {
        attributes: { value: id },

        text_content: String(taxonomy.label ?? id),
      })
    );
  });

  select.value = grouping_taxonomy_id;

  taxonomy_field.appendChild(select);

  taxonomy_panel.appendChild(taxonomy_field);

  const deficiency_preview_host = Helpers.create_element('div', {
    class_name: 'appendix1-deficiency-sections-preview-host',
  });

  append_field_hint(
    Helpers,
    deficiency_preview_host,
    t('rulefile_appendix1_deficiency_sections_hint')
  );

  const deficiency_preview_ref = render_appendix1_deficiency_groups_preview(
    Helpers,

    deficiency_sections
  );

  deficiency_preview_host.appendChild(deficiency_preview_ref);

  taxonomy_panel.appendChild(deficiency_preview_host);

  const generate_btn = Helpers.create_element('button', {
    class_name: [
      'button',
      'button-secondary',
      'appendix1-generate-sections-button',
    ],

    attributes: { type: 'button' },

    text_content: t('rulefile_appendix1_generate_sections_button'),
  });

  taxonomy_panel.appendChild(generate_btn);

  container.appendChild(taxonomy_panel);

    const deficiency_intros_host = Helpers.create_element('div', {
        class_name: 'appendix1-deficiency-intros-host',
    });

  let intro_editor_handles: ReturnType<
    typeof render_deficiency_intro_editor
  > | null = null;

  const refresh_deficiency_sections = () => {
    const next_rule_file = {
      ...rule_file_content,

      appendix1: {
        ...(rule_file_content.appendix1 as Record<string, unknown> | undefined),

        groupingTaxonomyId: grouping_taxonomy_id,
      },
    };

    deficiency_sections = generate_deficiency_sections_from_taxonomy(
      next_rule_file,
      t
    );

    intro_editor_handles?.refresh(deficiency_sections);

    deficiency_preview_host.replaceChildren(
      Helpers.create_element('p', {
        class_name: 'field-hint appendix1-section-panel__hint',

        text_content: t('rulefile_appendix1_deficiency_sections_hint'),
      }),

      render_appendix1_deficiency_groups_preview(Helpers, deficiency_sections)
    );
  };

  intro_editor_handles = render_deficiency_intro_editor(ctx, deficiency_intros_host, {
    rule_file_content,

    grouping_taxonomy_id,

    deficiency_sections,

    on_change: options.on_change,
  });

  container.appendChild(deficiency_intros_host);

  render_appendix1_placeholder_section(ctx, container);

  generate_btn.addEventListener('click', () => {
    grouping_taxonomy_id = select.value.trim();

    refresh_deficiency_sections();

    options.on_generate?.(deficiency_sections);
  });

  select.addEventListener('change', () => {
    persist_current_body_text(
      body_text_by_taxonomy,
      grouping_taxonomy_id,
      body_input.value
    );

    grouping_taxonomy_id = select.value.trim();

    body_text = load_body_text_for_taxonomy(
      body_text_by_taxonomy,

      grouping_taxonomy_id,

      read_rulefile_appendix1_body_text(rule_file_content, grouping_taxonomy_id)
    );

    persist_current_body_text(
      body_text_by_taxonomy,
      grouping_taxonomy_id,
      body_text
    );

    body_input.value = body_text;

    Helpers.init_auto_resize_for_textarea?.(body_input);

    refresh_deficiency_sections();

    options.on_change?.();
  });

  body_input.addEventListener('input', () => {
    body_text = body_input.value;

    persist_current_body_text(
      body_text_by_taxonomy,
      grouping_taxonomy_id,
      body_text
    );

    options.on_change?.();
  });

  return {
    get_body_text: () => body_text,

    get_body_text_by_taxonomy: () => {
      persist_current_body_text(
        body_text_by_taxonomy,
        grouping_taxonomy_id,
        body_input.value
      );

      const result: Record<string, string> = {
        ...persisted_body_text_by_taxonomy,
      };

      body_text_by_taxonomy.forEach((value, taxonomy_id) => {
        const trimmed = value.trim();

        if (trimmed) {
          result[taxonomy_id] = trimmed;
        } else {
          delete result[taxonomy_id];
        }
      });

      return result;
    },

    get_sections: () => deficiency_sections.map((section) => ({ ...section })),

    get_grouping_taxonomy_id: () => grouping_taxonomy_id,

    get_concept_intros: () => intro_editor_handles?.get_concept_intros() ?? {},
  };
}

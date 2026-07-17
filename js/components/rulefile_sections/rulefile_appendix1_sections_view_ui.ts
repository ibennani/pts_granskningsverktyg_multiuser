/**
 * @fileoverview Visningsläge för Bilaga 1 i regelfilens rapportmall.
 */
import { read_concept_appendix1_intro } from '../../logic/appendix1_principle_intro.js';
import {
  generate_deficiency_sections_from_taxonomy,
  read_rulefile_appendix1_body_text,
  read_rulefile_appendix1_grouping_taxonomy_id,
} from '../../logic/appendix1_sections.js';
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { render_markdown_to_html } from '../../export/export_html_build_primitives.js';
import {
  append_field_hint,
  create_appendix1_section_panel,
  render_appendix1_deficiency_groups_preview,
  render_appendix1_placeholder_section,
} from './rulefile_appendix1_shared_ui.js';

type ViewCtx = {
  Helpers: {
    create_element: (
      tag: string,
      opts?: Record<string, unknown>
    ) => HTMLElement;
    safe_set_inner_html?: (
      el: HTMLElement,
      html: string,
      opts?: Record<string, unknown>
    ) => void;
  };
  Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
};

function resolve_taxonomy_label(
  rule_file_content: Record<string, unknown>,
  taxonomy_id: string
): string {
  const taxonomies = resolve_taxonomies(
    rule_file_content.metadata as Record<string, unknown>
  ) as Array<{
    id?: string;
    label?: string;
  }>;
  const match = taxonomies.find(
    (taxonomy) => String(taxonomy.id ?? '').trim() === taxonomy_id
  );
  return String(match?.label ?? taxonomy_id).trim();
}

export function render_appendix1_sections_view(
  ctx: ViewCtx,
  container: HTMLElement,
  rule_file_content: Record<string, unknown>
): void {
  const { Helpers, Translation } = ctx;
  const t = Translation.t;
  container.innerHTML = '';
  container.classList.add('appendix1-sections-view-host');

  const grouping_taxonomy_id =
    read_rulefile_appendix1_grouping_taxonomy_id(rule_file_content);
  const body_text = read_rulefile_appendix1_body_text(
    rule_file_content,
    grouping_taxonomy_id
  );
  const deficiency_sections = generate_deficiency_sections_from_taxonomy(
    rule_file_content,
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

  const body_preview = Helpers.create_element('div', {
    class_name: 'markdown-preview-content appendix1-body-text-preview',
  });
  if (body_text.trim()) {
    if (typeof Helpers.safe_set_inner_html === 'function') {
      Helpers.safe_set_inner_html(
        body_preview,
        render_markdown_to_html(body_text),
        {
          allow_html: true,
        }
      );
    } else {
      body_preview.textContent = body_text;
    }
  } else {
    body_preview.appendChild(
      Helpers.create_element('p', {
        class_name: 'metadata-empty',
        text_content: t('rulefile_appendix1_body_text_empty'),
      })
    );
  }
  body_panel.appendChild(body_preview);
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

  const taxonomy_value = Helpers.create_element('p', {
    class_name: 'appendix1-view-taxonomy-value',
  });
  taxonomy_value.appendChild(
    Helpers.create_element('strong', {
      text_content: `${t('rulefile_appendix1_view_taxonomy_label')}: `,
    })
  );
  taxonomy_value.appendChild(
    Helpers.create_element('span', {
      text_content: resolve_taxonomy_label(
        rule_file_content,
        grouping_taxonomy_id
      ),
    })
  );
  taxonomy_panel.appendChild(taxonomy_value);
  append_field_hint(
    Helpers,
    taxonomy_panel,
    t('rulefile_appendix1_deficiency_sections_hint')
  );
  taxonomy_panel.appendChild(
    render_appendix1_deficiency_groups_preview(Helpers, deficiency_sections)
  );
  container.appendChild(taxonomy_panel);

  const intros_panel = create_appendix1_section_panel(
    Helpers,
    'rulefile_appendix1_deficiency_intros_heading',
    t
  ).panel;
  append_field_hint(
    Helpers,
    intros_panel,
    t('rulefile_appendix1_deficiency_intros_hint')
  );

  const intros_list = Helpers.create_element('div', {
    class_name: 'appendix1-deficiency-intros-view-list',
  });
  deficiency_sections.forEach((section) => {
    if (section.kind !== 'deficiency_group' || !section.conceptId) return;
    const intro_text =
      read_concept_appendix1_intro(
        rule_file_content.metadata,
        grouping_taxonomy_id,
        section.conceptId
      ) || section.content;
    const block = Helpers.create_element('div', {
      class_name: 'appendix1-deficiency-intro-view-field',
    });
    block.appendChild(
      Helpers.create_element('h3', {
        class_name: 'appendix1-deficiency-intro-view-field__title',
        text_content: t('rulefile_appendix1_deficiency_intro_label', {
          title: section.title || section.conceptId,
        }),
      })
    );
    if (intro_text.trim()) {
      const intro_preview = Helpers.create_element('div', {
        class_name: 'markdown-preview-content',
      });
      if (typeof Helpers.safe_set_inner_html === 'function') {
        Helpers.safe_set_inner_html(
          intro_preview,
          render_markdown_to_html(intro_text),
          {
            allow_html: true,
          }
        );
      } else {
        intro_preview.textContent = intro_text;
      }
      block.appendChild(intro_preview);
    } else {
      block.appendChild(
        Helpers.create_element('p', {
          class_name: 'metadata-empty',
          text_content: t('rulefile_appendix1_deficiency_intro_empty'),
        })
      );
    }
    intros_list.appendChild(block);
  });
  intros_panel.appendChild(intros_list);
  container.appendChild(intros_panel);

  render_appendix1_placeholder_section(ctx, container, {
    show_copy_buttons: false,
  });
}

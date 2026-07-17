/**
 * @fileoverview Delade UI-hjälpare för Bilaga 1 i regelfilens visnings- och redigeringsläge.
 */
import { format_appendix1_placeholder_token } from '../../logic/appendix1_sections.js';

type Appendix1SharedUiCtx = {
  Helpers: {
    create_element: (
      tag: string,
      opts?: Record<string, unknown>
    ) => HTMLElement;
    escape_html?: (value: string) => string;
    get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
  };
  Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
  NotificationComponent?: {
    show_global_message?: (msg: string, type: string) => void;
  };
};

export const APPENDIX1_PLACEHOLDER_KEYS = [
  'caseNumber',
  'actorName',
  'actorLink',
  'actorLinkDomain',
  'startDate',
  'endDate',
  'exportDate',
  'auditorName',
  'caseHandler',
] as const;

export function split_deficiency_section_title(title: string): {
  number: string;
  label: string;
} {
  const trimmed = title.trim();
  const space_index = trimmed.indexOf(' ');
  if (space_index <= 0) {
    return { number: '', label: trimmed };
  }
  return {
    number: trimmed.slice(0, space_index),
    label: trimmed.slice(space_index + 1).trim(),
  };
}

export function create_appendix1_section_panel(
  Helpers: Appendix1SharedUiCtx['Helpers'],
  heading_key: string,
  t: Appendix1SharedUiCtx['Translation']['t']
): { panel: HTMLElement; heading_id: string } {
  const heading_id = `appendix1-section-${Math.random().toString(36).slice(2, 8)}`;
  const panel = Helpers.create_element('section', {
    class_name: 'appendix1-section-panel',
  });
  panel.appendChild(
    Helpers.create_element('h2', {
      class_name: 'appendix1-section-panel__heading',
      attributes: { id: heading_id },
      text_content: t(heading_key),
    })
  );
  return { panel, heading_id };
}

export function append_field_hint(
  Helpers: Appendix1SharedUiCtx['Helpers'],
  parent: HTMLElement,
  text: string
): void {
  parent.appendChild(
    Helpers.create_element('p', {
      class_name: 'field-hint appendix1-section-panel__hint',
      text_content: text,
    })
  );
}

async function copy_appendix1_placeholder_token(
  ctx: Appendix1SharedUiCtx,
  token: string
): Promise<void> {
  const t = ctx.Translation.t;
  try {
    await navigator.clipboard.writeText(token);
    ctx.NotificationComponent?.show_global_message?.(
      t('rulefile_appendix1_copy_placeholder_success', { placeholder: token }),
      'success'
    );
  } catch {
    ctx.NotificationComponent?.show_global_message?.(
      t('rulefile_appendix1_copy_placeholder_failed'),
      'error'
    );
  }
}

function create_placeholder_list_item(
  ctx: Appendix1SharedUiCtx,
  key: (typeof APPENDIX1_PLACEHOLDER_KEYS)[number],
  show_copy_button: boolean
): HTMLLIElement {
  const { Helpers, Translation } = ctx;
  const t = Translation.t;
    const token = format_appendix1_placeholder_token(key);
  const label_text = t(`rulefile_appendix1_body_text_placeholder_${key}`);
  const description_text = label_text.startsWith(token)
    ? label_text.slice(token.length)
    : '';
  const item = Helpers.create_element('li', {
    class_name: 'appendix1-editor-intro__placeholder-item',
  }) as HTMLLIElement;

  item.appendChild(
    Helpers.create_element('span', {
      class_name: 'appendix1-editor-intro__placeholder-token',
      text_content: token,
    })
  );

  if (description_text) {
    item.appendChild(
      Helpers.create_element('span', {
        class_name: 'appendix1-editor-intro__placeholder-description',
        text_content: description_text,
      })
    );
  }

  if (show_copy_button) {
    const copy_icon =
      Helpers.get_icon_svg?.('content_copy', ['currentColor'], 16) ?? '';
    const copy_label_short = t(
      'rulefile_appendix1_copy_placeholder_button_short'
    );
    const copy_btn = Helpers.create_element('button', {
      class_name: [
        'button',
        'button-small',
        'button-default',
        'appendix1-editor-intro__placeholder-copy-btn',
      ],
      attributes: {
        type: 'button',
        'aria-label': t('rulefile_appendix1_copy_placeholder_button', {
          placeholder: token,
        }),
      },
      html_content: copy_icon
        ? `<span>${copy_label_short}</span><span aria-hidden="true">${copy_icon}</span>`
        : `<span>${t('rulefile_appendix1_copy_placeholder_button', { placeholder: token })}</span>`,
    });
    copy_btn.addEventListener('click', () => {
      void copy_appendix1_placeholder_token(ctx, token);
    });
    item.appendChild(copy_btn);
  }

  return item;
}

export function render_appendix1_placeholder_section(
  ctx: Appendix1SharedUiCtx,
  container: HTMLElement,
  options: { show_copy_buttons?: boolean } = {}
): void {
  const { Helpers, Translation } = ctx;
  const t = Translation.t;
  const show_copy_buttons = options.show_copy_buttons !== false;
  const { panel } = create_appendix1_section_panel(
    Helpers,
    'rulefile_appendix1_body_text_placeholders_heading',
    t
  );
  append_field_hint(Helpers, panel, t('rulefile_appendix1_placeholders_hint'));

  const placeholder_list = Helpers.create_element('ul', {
    class_name: 'appendix1-editor-intro__placeholder-list',
  });
  APPENDIX1_PLACEHOLDER_KEYS.forEach((key) => {
    placeholder_list.appendChild(
      create_placeholder_list_item(ctx, key, show_copy_buttons)
    );
  });
  panel.appendChild(placeholder_list);
  container.appendChild(panel);
}

export function render_appendix1_deficiency_groups_preview(
  Helpers: Appendix1SharedUiCtx['Helpers'],
  sections: Appendix1SectionDefinition[]
): HTMLElement {
  const list = Helpers.create_element('ul', {
    class_name: 'appendix1-deficiency-sections-preview',
  });
  sections.forEach((section) => {
    if (section.kind !== 'deficiency_group') return;
    const { number, label } = split_deficiency_section_title(
      section.title || ''
    );
    const item = Helpers.create_element('li', {
      class_name: 'appendix1-deficiency-sections-preview__item',
    });
    if (number) {
      item.appendChild(
        Helpers.create_element('span', {
          class_name: 'appendix1-deficiency-sections-preview__number',
          text_content: number,
        })
      );
    }
    item.appendChild(
      Helpers.create_element('span', {
        class_name: 'appendix1-deficiency-sections-preview__title',
        text_content: label || section.title || section.conceptId || '',
      })
    );
    list.appendChild(item);
  });
  return list;
}

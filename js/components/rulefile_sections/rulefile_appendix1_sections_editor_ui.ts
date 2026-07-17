/**
 * @fileoverview Redigerings-UI för Bilaga 1 brödtext och bristgrupper i regelfilen.
 */
import {
    format_appendix1_placeholder_token,
    generate_deficiency_sections_from_taxonomy,
    read_rulefile_appendix1_body_text,
    read_rulefile_appendix1_body_text_by_taxonomy,
    read_rulefile_appendix1_grouping_taxonomy_id,
} from '../../logic/appendix1_sections.js';
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import type { Appendix1SectionDefinition } from '../../logic/appendix1_sections_types.js';
import { render_deficiency_intro_editor } from './rulefile_appendix1_deficiency_intros_editor_ui.js';

type EditorCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        escape_html?: (value: string) => string;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
        init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    NotificationComponent?: { show_global_message?: (msg: string, type: string) => void };
};

const APPENDIX1_PLACEHOLDER_KEYS = [
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

function create_form_field_label(
    Helpers: EditorCtx['Helpers'],
    for_id: string,
    label_text: string
): HTMLLabelElement {
    const safe_label = Helpers.escape_html ? Helpers.escape_html(label_text) : label_text;
    return Helpers.create_element('label', {
        attributes: { for: for_id },
        html_content: `<strong>${safe_label}</strong>`,
    }) as HTMLLabelElement;
}

async function copy_appendix1_placeholder_token(ctx: EditorCtx, token: string): Promise<void> {
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
    ctx: EditorCtx,
    key: (typeof APPENDIX1_PLACEHOLDER_KEYS)[number]
): HTMLLIElement {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    const token = format_appendix1_placeholder_token(key);
    const label_text = t(`rulefile_appendix1_body_text_placeholder_${key}`);
    const description_text = label_text.startsWith(token) ? label_text.slice(token.length) : '';
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

    const copy_icon = Helpers.get_icon_svg?.('content_copy', ['currentColor'], 16) ?? '';
    const copy_label_short = t('rulefile_appendix1_copy_placeholder_button_short');
    const copy_btn = Helpers.create_element('button', {
        class_name: [
            'button',
            'button-small',
            'button-default',
            'appendix1-editor-intro__placeholder-copy-btn',
        ],
        attributes: {
            type: 'button',
            'aria-label': t('rulefile_appendix1_copy_placeholder_button', { placeholder: token }),
        },
        html_content: copy_icon
            ? `<span>${copy_label_short}</span><span aria-hidden="true">${copy_icon}</span>`
            : `<span>${t('rulefile_appendix1_copy_placeholder_button', { placeholder: token })}</span>`,
    });
    copy_btn.addEventListener('click', () => {
        void copy_appendix1_placeholder_token(ctx, token);
    });
    item.appendChild(copy_btn);
    return item;
}

function render_structured_intro(ctx: EditorCtx, container: HTMLElement): void {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    const intro_block = Helpers.create_element('div', {
        class_name: 'appendix1-editor-intro',
    });

    intro_block.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint appendix1-editor-intro__lead',
            text_content: t('rulefile_appendix1_body_text_intro_lead'),
        })
    );
    intro_block.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint appendix1-editor-intro__note',
            text_content: t('rulefile_appendix1_body_text_auto_generated_note'),
        })
    );

    const placeholder_list = Helpers.create_element('ul', {
        class_name: 'appendix1-editor-intro__placeholder-list',
    });
    APPENDIX1_PLACEHOLDER_KEYS.forEach((key) => {
        placeholder_list.appendChild(create_placeholder_list_item(ctx, key));
    });
    intro_block.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint appendix1-editor-intro__subheading',
            text_content: t('rulefile_appendix1_body_text_placeholders_heading'),
        })
    );
    intro_block.appendChild(placeholder_list);
    container.appendChild(intro_block);
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

    let grouping_taxonomy_id = read_rulefile_appendix1_grouping_taxonomy_id(rule_file_content);
    const taxonomies = resolve_taxonomies(rule_file_content.metadata as Record<string, unknown>) as Array<{
        id?: string;
        label?: string;
    }>;
    const taxonomy_ids = taxonomies
        .map((taxonomy) => String(taxonomy.id ?? '').trim())
        .filter(Boolean);

    const body_text_by_taxonomy = new Map<string, string>(
        Object.entries(read_rulefile_appendix1_body_text_by_taxonomy(rule_file_content, taxonomy_ids))
    );
    let body_text = load_body_text_for_taxonomy(
        body_text_by_taxonomy,
        grouping_taxonomy_id,
        read_rulefile_appendix1_body_text(rule_file_content, grouping_taxonomy_id)
    );
    persist_current_body_text(body_text_by_taxonomy, grouping_taxonomy_id, body_text);

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

    render_structured_intro(ctx, container);

    const taxonomy_field = Helpers.create_element('div', {
        class_name: 'form-group appendix1-grouping-taxonomy-field',
    });
    const select_id = `appendix1-grouping-taxonomy-${Math.random().toString(36).slice(2, 8)}`;
    taxonomy_field.appendChild(
        create_form_field_label(Helpers, select_id, t('rulefile_appendix1_grouping_taxonomy_label'))
    );
    const select = Helpers.create_element('select', {
        class_name: ['form-control', 'dropdown-select', 'appendix1-grouping-taxonomy-select'],
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

    const body_field = Helpers.create_element('div', { class_name: 'form-group' });
    const body_id = `appendix1-body-text-${Math.random().toString(36).slice(2, 8)}`;
    body_field.appendChild(
        create_form_field_label(Helpers, body_id, t('rulefile_appendix1_body_text_label'))
    );
    const body_input = Helpers.create_element('textarea', {
        class_name: 'form-control appendix1-body-text-editor',
        attributes: { id: body_id, rows: '24' },
    }) as HTMLTextAreaElement;
    body_input.value = body_text;
    Helpers.init_auto_resize_for_textarea?.(body_input);

    let intro_editor_handles: ReturnType<typeof render_deficiency_intro_editor> | null = null;

    const refresh_deficiency_sections = () => {
        const next_rule_file = {
            ...rule_file_content,
            appendix1: {
                ...(rule_file_content.appendix1 as Record<string, unknown> | undefined),
                groupingTaxonomyId: grouping_taxonomy_id,
            },
        };
        deficiency_sections = generate_deficiency_sections_from_taxonomy(next_rule_file, t);
        intro_editor_handles?.refresh(deficiency_sections);
    };

    const deficiency_panel = Helpers.create_element('div', {
        class_name: 'appendix1-deficiency-sections-panel',
    });
    intro_editor_handles = render_deficiency_intro_editor(ctx, deficiency_panel, {
        rule_file_content,
        grouping_taxonomy_id,
        deficiency_sections,
        on_change: options.on_change,
    });

    const generate_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-secondary'],
        attributes: { type: 'button' },
        text_content: t('rulefile_appendix1_generate_sections_button'),
    });
    generate_btn.addEventListener('click', () => {
        grouping_taxonomy_id = select.value.trim();
        refresh_deficiency_sections();
        options.on_generate?.(deficiency_sections);
    });
    const deficiency_actions = Helpers.create_element('div', {
        class_name: 'appendix1-deficiency-sections-panel__actions',
    });
    deficiency_actions.appendChild(generate_btn);
    deficiency_panel.appendChild(deficiency_actions);

    select.addEventListener('change', () => {
        persist_current_body_text(body_text_by_taxonomy, grouping_taxonomy_id, body_input.value);
        grouping_taxonomy_id = select.value.trim();
        body_text = load_body_text_for_taxonomy(
            body_text_by_taxonomy,
            grouping_taxonomy_id,
            read_rulefile_appendix1_body_text(rule_file_content, grouping_taxonomy_id)
        );
        persist_current_body_text(body_text_by_taxonomy, grouping_taxonomy_id, body_text);
        body_input.value = body_text;
        Helpers.init_auto_resize_for_textarea?.(body_input);
        refresh_deficiency_sections();
        options.on_change?.();
    });
    taxonomy_field.appendChild(select);
    container.appendChild(taxonomy_field);

    body_input.addEventListener('input', () => {
        body_text = body_input.value;
        persist_current_body_text(body_text_by_taxonomy, grouping_taxonomy_id, body_text);
        options.on_change?.();
    });
    body_field.appendChild(body_input);
    container.appendChild(body_field);
    container.appendChild(deficiency_panel);

    return {
        get_body_text: () => body_text,
        get_body_text_by_taxonomy: () => {
            persist_current_body_text(body_text_by_taxonomy, grouping_taxonomy_id, body_input.value);
            const result: Record<string, string> = {};
            body_text_by_taxonomy.forEach((value, taxonomy_id) => {
                const trimmed = value.trim();
                if (trimmed) {
                    result[taxonomy_id] = trimmed;
                }
            });
            return result;
        },
        get_sections: () => deficiency_sections.map((section) => ({ ...section })),
        get_grouping_taxonomy_id: () => grouping_taxonomy_id,
        get_concept_intros: () => intro_editor_handles?.get_concept_intros() ?? {},
    };
}

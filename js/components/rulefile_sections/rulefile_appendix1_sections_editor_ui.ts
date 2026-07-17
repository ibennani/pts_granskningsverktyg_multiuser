/**
 * @fileoverview Redigerings-UI för Bilaga 1 brödtext och bristgrupper i regelfilen.
 */
import { taxonomy_uses_legacy_appendix1_body_text_fallback } from '../../logic/appendix1_body_text.js';
import {
    format_appendix1_placeholder_token,
    generate_deficiency_sections_from_taxonomy,
    read_rulefile_appendix1_body_text,
    read_rulefile_appendix1_body_text_by_taxonomy,
    read_rulefile_appendix1_grouping_taxonomy_id,
} from '../../logic/appendix1_sections.js';
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { resolve_available_audit_types, merge_appendix1_with_audit_type_override } from '../../../shared/audit/audit_type_metadata.js';
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

const HOW_IT_WORKS_LIST_KEYS = [
    'rulefile_appendix1_body_text_intro_lead',
    'rulefile_appendix1_body_text_markdown_hint',
    'rulefile_appendix1_body_text_auto_generated_note',
    'rulefile_appendix1_taxonomy_groups_hint',
    'rulefile_appendix1_body_text_per_taxonomy_hint',
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

function render_appendix1_how_it_works_section(ctx: EditorCtx, container: HTMLElement): void {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    const section = Helpers.create_element('section', {
        class_name: 'appendix1-how-it-works',
    });

    section.appendChild(
        Helpers.create_element('h2', {
            class_name: 'appendix1-how-it-works__heading',
            text_content: t('rulefile_appendix1_how_it_works_heading'),
        })
    );

    const list = Helpers.create_element('ul', {
        class_name: 'field-hint appendix1-how-it-works__list',
    });
    HOW_IT_WORKS_LIST_KEYS.forEach((key) => {
        list.appendChild(
            Helpers.create_element('li', {
                class_name: 'appendix1-how-it-works__item',
                text_content: t(key),
            })
        );
    });
    section.appendChild(list);

    container.appendChild(section);
}

function render_appendix1_placeholders_section(ctx: EditorCtx, container: HTMLElement): void {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    const section = Helpers.create_element('section', {
        class_name: 'appendix1-placeholders-section',
    });

    section.appendChild(
        Helpers.create_element('h2', {
            class_name: 'appendix1-placeholders-section__heading',
            text_content: t('rulefile_appendix1_body_text_placeholders_heading'),
        })
    );
    section.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint appendix1-placeholders-section__hint',
            text_content: t('rulefile_appendix1_placeholders_hint'),
        })
    );

    const placeholder_list = Helpers.create_element('ul', {
        class_name: 'appendix1-editor-intro__placeholder-list',
    });
    APPENDIX1_PLACEHOLDER_KEYS.forEach((key) => {
        placeholder_list.appendChild(create_placeholder_list_item(ctx, key));
    });
    section.appendChild(placeholder_list);
    container.appendChild(section);
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
    } = {}
): {
    get_body_text: () => string;
    get_body_text_by_taxonomy: () => Record<string, string>;
    get_sections: () => Appendix1SectionDefinition[];
    get_grouping_taxonomy_id: () => string;
    get_concept_intros: () => Record<string, string>;
    get_editing_audit_type_id: () => string;
} {
    const { Helpers, Translation } = ctx;
    const t = Translation.t;
    container.innerHTML = '';
    container.classList.add('appendix1-sections-editor-host');

    const audit_types = resolve_available_audit_types(rule_file_content);
    let editing_audit_type_id =
        audit_types.length === 1 ? audit_types[0].id : String(audit_types[0]?.id ?? '').trim();

    const resolve_effective_rule_file = (audit_type_id: string): Record<string, unknown> => {
        if (!audit_type_id) return rule_file_content;
        const merged_appendix = merge_appendix1_with_audit_type_override(
            rule_file_content.appendix1,
            audit_type_id
        );
        return {
            ...rule_file_content,
            appendix1: merged_appendix ?? rule_file_content.appendix1,
        };
    };

    let effective_rule_file = resolve_effective_rule_file(editing_audit_type_id);

    let grouping_taxonomy_id = read_rulefile_appendix1_grouping_taxonomy_id(effective_rule_file);
    const taxonomies = resolve_taxonomies(rule_file_content.metadata as Record<string, unknown>) as Array<{
        id?: string;
        label?: string;
    }>;
    const taxonomy_ids = taxonomies
        .map((taxonomy) => String(taxonomy.id ?? '').trim())
        .filter(Boolean);

    const body_text_by_taxonomy = new Map<string, string>(
        Object.entries(read_rulefile_appendix1_body_text_by_taxonomy(effective_rule_file, taxonomy_ids))
    );
    const persisted_body_text_by_taxonomy = Object.fromEntries(body_text_by_taxonomy);

    let body_text = load_body_text_for_taxonomy(
        body_text_by_taxonomy,
        grouping_taxonomy_id,
        read_rulefile_appendix1_body_text(effective_rule_file, grouping_taxonomy_id)
    );
    persist_current_body_text(body_text_by_taxonomy, grouping_taxonomy_id, body_text);

    let deficiency_sections = generate_deficiency_sections_from_taxonomy(
        {
            ...effective_rule_file,
            appendix1: {
                ...(effective_rule_file.appendix1 as Record<string, unknown> | undefined),
                groupingTaxonomyId: grouping_taxonomy_id,
            },
        },
        t
    );

    render_appendix1_how_it_works_section(ctx, container);
    render_appendix1_placeholders_section(ctx, container);

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
            ...effective_rule_file,
            appendix1: {
                ...(effective_rule_file.appendix1 as Record<string, unknown> | undefined),
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
        rule_file_content: effective_rule_file,
        grouping_taxonomy_id,
        deficiency_sections,
        on_change: options.on_change,
    });

    if (audit_types.length > 1) {
        const audit_type_field = Helpers.create_element('div', {
            class_name: 'form-group appendix1-audit-type-template-field',
        });
        const audit_type_select_id = `appendix1-audit-type-${Math.random().toString(36).slice(2, 8)}`;
        audit_type_field.appendChild(
            create_form_field_label(
                Helpers,
                audit_type_select_id,
                t('rulefile_appendix1_audit_type_template_label')
            )
        );
        const audit_type_select = Helpers.create_element('select', {
            class_name: ['form-control', 'dropdown-select', 'appendix1-audit-type-select'],
            attributes: { id: audit_type_select_id, name: 'appendix1AuditTypeTemplate' },
        }) as HTMLSelectElement;
        audit_types.forEach((row) => {
            audit_type_select.appendChild(
                Helpers.create_element('option', {
                    attributes: { value: row.id },
                    text_content: row.label,
                })
            );
        });
        audit_type_select.value = editing_audit_type_id;
        audit_type_select.addEventListener('change', () => {
            persist_current_body_text(body_text_by_taxonomy, grouping_taxonomy_id, body_input.value);
            editing_audit_type_id = audit_type_select.value.trim();
            effective_rule_file = resolve_effective_rule_file(editing_audit_type_id);
            grouping_taxonomy_id = read_rulefile_appendix1_grouping_taxonomy_id(effective_rule_file);
            select.value = grouping_taxonomy_id;
            body_text_by_taxonomy.clear();
            Object.entries(
                read_rulefile_appendix1_body_text_by_taxonomy(effective_rule_file, taxonomy_ids)
            ).forEach(([key, value]) => body_text_by_taxonomy.set(key, value));
            body_text = load_body_text_for_taxonomy(
                body_text_by_taxonomy,
                grouping_taxonomy_id,
                read_rulefile_appendix1_body_text(effective_rule_file, grouping_taxonomy_id)
            );
            persist_current_body_text(body_text_by_taxonomy, grouping_taxonomy_id, body_text);
            body_input.value = body_text;
            Helpers.init_auto_resize_for_textarea?.(body_input);
            refresh_deficiency_sections();
            options.on_change?.();
        });
        audit_type_field.appendChild(audit_type_select);
        container.insertBefore(audit_type_field, taxonomy_field);
    }

    select.addEventListener('change', () => {
        persist_current_body_text(body_text_by_taxonomy, grouping_taxonomy_id, body_input.value);
        grouping_taxonomy_id = select.value.trim();
        body_text = load_body_text_for_taxonomy(
            body_text_by_taxonomy,
            grouping_taxonomy_id,
            read_rulefile_appendix1_body_text(effective_rule_file, grouping_taxonomy_id)
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
        get_editing_audit_type_id: () => editing_audit_type_id,
    };
}

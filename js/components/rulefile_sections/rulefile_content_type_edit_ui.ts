/**
 * @fileoverview Redigeringssida för en innehållstyp med kravkoppling.
 */
import {
    append_classifications_table_filter_to_layout,
    append_classifications_table_scroll_area,
    attach_classifications_table_row_filter,
    create_classifications_table,
    create_classifications_table_layout,
    type ClassificationsTableColumn,
} from './rulefile_classifications_table_ui.js';
import {
    build_content_type_requirement_rows,
    set_requirement_content_type_linked,
} from './rulefile_content_type_requirements.js';
import {
    move_content_type_child_to_parent,
    read_content_type_parents,
    type ContentTypeLocation,
} from './rulefile_content_type_keys.js';
import { show_confirm_delete_modal } from '../../logic/confirm_delete_modal_logic.js';
import { get_requirements_count_by_content_type_id } from '../../utils/content_types_helper.js';

type ViewCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
        init_auto_resize_for_textarea?: (textarea: HTMLTextAreaElement) => void;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    router?: (view: string, params?: Record<string, string>) => void;
};

type EditFormState = {
    text: string;
    parent_id: string;
    description: string;
    detection_pattern: string;
    default_selected: boolean;
};

type EditOptions = {
    location: ContentTypeLocation;
    is_create: boolean;
    on_change?: () => void;
    on_back?: () => void;
    on_delete?: () => void;
    get_rule_file_content?: () => Record<string, unknown>;
    on_rule_file_content_change?: (rule_file_content: Record<string, unknown>) => void;
    update_heading?: (name: string) => void;
};

function read_form_state(form: HTMLFormElement): EditFormState {
    const text_input = form.querySelector('[data-content-type-field="text"]') as HTMLInputElement | null;
    const group_select = form.querySelector('[data-content-type-field="group"]') as HTMLSelectElement | null;
    const description_input = form.querySelector(
        '[data-content-type-field="description"]'
    ) as HTMLTextAreaElement | null;
    const pattern_input = form.querySelector(
        '[data-content-type-field="detectionPattern"]'
    ) as HTMLTextAreaElement | null;
    const default_selected_input = form.querySelector(
        '[data-content-type-field="defaultSelected"]'
    ) as HTMLInputElement | null;
    return {
        text: text_input?.value ?? '',
        parent_id: group_select?.value ?? '',
        description: description_input?.value ?? '',
        detection_pattern: pattern_input?.value ?? '',
        default_selected: default_selected_input?.checked === true,
    };
}

function apply_form_state_to_metadata(
    working_metadata: Record<string, unknown>,
    location: ContentTypeLocation,
    form_state: EditFormState,
    should_trim: boolean
): ContentTypeLocation {
    const normalize = (value: string) => (should_trim ? value.trim() : value);
    let next_location = location;
    const target_parent_id = normalize(form_state.parent_id);
    const current_parent_id = String(location.parent.id ?? '').trim();

    if (target_parent_id && current_parent_id && target_parent_id !== current_parent_id) {
        next_location = move_content_type_child_to_parent(working_metadata, location, target_parent_id);
    }

    const parents = read_content_type_parents(working_metadata);
    const parent = parents[next_location.parent_index];
    const child = parent?.types?.[next_location.child_index];
    if (!child) return next_location;

    child.text = normalize(form_state.text);
    child.description = normalize(form_state.description);
    const pattern = normalize(form_state.detection_pattern);
    if (pattern) {
        child.detectionPattern = pattern;
    } else {
        delete child.detectionPattern;
    }
    if (form_state.default_selected) {
        child.defaultSelected = true;
    } else {
        delete child.defaultSelected;
    }
    working_metadata.contentTypes = parents;
    return next_location;
}

function build_group_select(
    Helpers: ViewCtx['Helpers'],
    t: ViewCtx['Translation']['t'],
    metadata: Record<string, unknown>,
    selected_parent_id: string
): HTMLSelectElement {
    const parents = read_content_type_parents(metadata);
    const select = Helpers.create_element('select', {
        class_name: ['form-control', 'dropdown-select'],
        attributes: {
            'data-content-type-field': 'group',
        },
    }) as HTMLSelectElement;

    parents.forEach((parent) => {
        const parent_id = String(parent.id ?? '').trim();
        if (!parent_id) return;
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: parent_id },
                text_content: parent.text?.trim() || parent_id,
            })
        );
    });

    if (selected_parent_id && !Array.from(select.options).some((opt) => opt.value === selected_parent_id)) {
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: selected_parent_id },
                text_content: selected_parent_id,
            })
        );
    }
    select.value = selected_parent_id;
    if (!select.value && select.options.length > 0) {
        select.selectedIndex = 0;
    }
    return select;
}

function build_requirements_table(
    ctx: ViewCtx,
    container: HTMLElement,
    rule_file_content: Record<string, unknown>,
    content_type_id: string,
    content_type_name: string,
    on_checkbox_change: (requirement_key: string, linked: boolean) => void
): void {
    const { Helpers, Translation: { t } } = ctx;
    container.innerHTML = '';
    const rows = build_content_type_requirement_rows(rule_file_content, content_type_id);

    container.appendChild(
        Helpers.create_element('h2', {
            class_name: 'content-type-edit-requirements-heading',
            text_content: t('rulefile_content_types_requirements_heading'),
        })
    );

    const layout = create_classifications_table_layout(Helpers);
    layout.classList.add('content-type-requirements-table-wrapper');

    const filter_input = append_classifications_table_filter_to_layout(layout, ctx, rows.length, {
        label_key: 'rulefile_content_types_requirements_filter_label',
        id_prefix: 'content-type-requirements-filter',
        min_rows: 3,
    });

    const columns: ClassificationsTableColumn[] = [
        {
            text: t('rulefile_content_types_requirements_name_column'),
            class_name: 'content-type-requirements-name-header',
        },
        {
            text: t('rulefile_content_types_requirements_linked_column'),
            class_name: 'content-type-requirements-linked-header',
        },
    ];

    const { table, row_elements } = create_classifications_table(ctx, {
        caption: t('rulefile_content_types_requirements_table_caption'),
        extra_table_classes: 'content-type-requirements-table',
        columns,
        rows: rows.map((row) => {
            const checkbox_id = `content-type-req-${row.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            const linked_cell = Helpers.create_element('td', {
                class_name: 'content-type-requirements-linked-cell',
            });
            const checkbox = Helpers.create_element('input', {
                class_name: 'form-check-input',
                attributes: {
                    id: checkbox_id,
                    type: 'checkbox',
                    'data-requirement-key': row.key,
                    'aria-label': t('rulefile_content_types_requirements_linked_aria', {
                        name: row.display_label,
                        content_type: content_type_name,
                    }),
                },
            }) as HTMLInputElement;
            checkbox.checked = row.linked;
            checkbox.addEventListener('change', () => {
                on_checkbox_change(row.key, checkbox.checked);
            });
            linked_cell.appendChild(checkbox);

            return {
                key: row.key,
                row_header_class: 'content-type-requirements-row-header',
                row_header_text: row.display_label || row.key,
                cells: [linked_cell],
            };
        }),
    });

    append_classifications_table_scroll_area(
        layout,
        Helpers,
        table,
        'content-type-requirements-scroll-wrapper'
    );
    container.appendChild(layout);
    if (filter_input) {
        attach_classifications_table_row_filter(filter_input, row_elements);
    }
}

export function render_content_type_edit_form(
    ctx: ViewCtx,
    container: HTMLElement,
    working_metadata: Record<string, unknown>,
    rule_file_content: Record<string, unknown>,
    options: EditOptions
): {
    form: HTMLFormElement;
    sync_from_form: (should_trim: boolean) => ContentTypeLocation;
    refresh_requirements_table: () => void;
} {
    const { Helpers, Translation: { t } } = ctx;
    container.innerHTML = '';

    let location = options.location;
    const child = location.child;
    const child_id = String(child.id ?? '').trim();
    const form = Helpers.create_element('form', {
        class_name: 'content-type-edit-form rulefile-classifications-edit-form',
    }) as HTMLFormElement;

    form.appendChild(
        Helpers.create_element('h2', {
            class_name: 'content-type-edit-form-heading',
            text_content: t('rulefile_content_types_details_heading'),
        })
    );

    const fields = Helpers.create_element('div', { class_name: 'content-type-edit-fields' });

    const name_group = Helpers.create_element('div', { class_name: 'form-group' });
    const name_id = `content-type-name-${Math.random().toString(36).substring(2, 8)}`;
    name_group.appendChild(
        Helpers.create_element('label', {
            attributes: { for: name_id },
            text_content: t('rulefile_content_types_field_name'),
        })
    );
    const name_input = Helpers.create_element('input', {
        class_name: 'form-control',
        attributes: { id: name_id, type: 'text', 'data-content-type-field': 'text' },
    }) as HTMLInputElement;
    name_input.value = child.text ?? '';
    name_group.appendChild(name_input);
    fields.appendChild(name_group);

    const group_group = Helpers.create_element('div', { class_name: 'form-group' });
    const group_id = `content-type-group-${Math.random().toString(36).substring(2, 8)}`;
    group_group.appendChild(
        Helpers.create_element('label', {
            attributes: { for: group_id },
            text_content: t('rulefile_content_types_field_group'),
        })
    );
    const group_select = build_group_select(
        Helpers,
        t,
        working_metadata,
        String(location.parent.id ?? '').trim()
    );
    group_select.id = group_id;
    group_group.appendChild(group_select);
    fields.appendChild(group_group);

    const description_group = Helpers.create_element('div', { class_name: 'form-group' });
    const description_id = `content-type-description-${Math.random().toString(36).substring(2, 8)}`;
    description_group.appendChild(
        Helpers.create_element('label', {
            attributes: { for: description_id },
            text_content: t('rulefile_content_types_field_description'),
        })
    );
    const description_input = Helpers.create_element('textarea', {
        class_name: 'form-control',
        attributes: { id: description_id, rows: '4', 'data-content-type-field': 'description' },
    }) as HTMLTextAreaElement;
    description_input.value = child.description ?? '';
    Helpers.init_auto_resize_for_textarea?.(description_input);
    description_group.appendChild(description_input);
    fields.appendChild(description_group);

    const pattern_group = Helpers.create_element('div', { class_name: 'form-group' });
    const pattern_id = `content-type-pattern-${Math.random().toString(36).substring(2, 8)}`;
    pattern_group.appendChild(
        Helpers.create_element('label', {
            attributes: { for: pattern_id },
            text_content: t('rulefile_metadata_field_detection_pattern'),
        })
    );
    pattern_group.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: t('rulefile_metadata_field_detection_pattern_help'),
        })
    );
    const pattern_input = Helpers.create_element('textarea', {
        class_name: 'form-control content-type-edit-pattern-input',
        attributes: { id: pattern_id, rows: '2', 'data-content-type-field': 'detectionPattern' },
    }) as HTMLTextAreaElement;
    pattern_input.value = child.detectionPattern ?? '';
    pattern_group.appendChild(pattern_input);
    fields.appendChild(pattern_group);

    const default_selected_group = Helpers.create_element('div', { class_name: 'form-group' });
    const default_selected_id = `content-type-default-selected-${Math.random().toString(36).substring(2, 8)}`;
    const default_selected_wrapper = Helpers.create_element('div', { class_name: 'form-check' });
    const default_selected_input = Helpers.create_element('input', {
        class_name: 'form-check-input',
        attributes: {
            id: default_selected_id,
            type: 'checkbox',
            'data-content-type-field': 'defaultSelected',
        },
    }) as HTMLInputElement;
    default_selected_input.checked = child.defaultSelected === true;
    default_selected_wrapper.appendChild(default_selected_input);
    default_selected_wrapper.appendChild(
        Helpers.create_element('label', {
            attributes: { for: default_selected_id },
            text_content: t('rulefile_content_types_default_selected_field'),
        })
    );
    default_selected_group.appendChild(default_selected_wrapper);
    default_selected_group.appendChild(
        Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: t('rulefile_content_types_default_selected_help'),
        })
    );
    fields.appendChild(default_selected_group);

    form.appendChild(fields);

    const requirements_host = Helpers.create_element('div', {
        class_name: 'content-type-edit-requirements-host',
    });
    form.appendChild(requirements_host);

    const refresh_requirements_table = () => {
        const display_name = name_input.value.trim() || t('rulefile_metadata_untitled_item');
        const effective_id = String(location.child.id ?? child_id).trim();
        build_requirements_table(
            ctx,
            requirements_host,
            options.get_rule_file_content?.() ?? rule_file_content,
            effective_id,
            display_name,
            (requirement_key, linked) => {
                if (!options.get_rule_file_content || !options.on_rule_file_content_change) return;
                const current = options.get_rule_file_content();
                const effective_type_id = String(location.child.id ?? child_id).trim();
                if (!effective_type_id) return;
                const updated = set_requirement_content_type_linked(
                    current,
                    requirement_key,
                    effective_type_id,
                    linked
                );
                options.on_rule_file_content_change(updated);
                options.on_change?.();
            }
        );
    };

    const sync_from_form = (should_trim: boolean) => {
        location = apply_form_state_to_metadata(working_metadata, location, read_form_state(form), should_trim);
        options.update_heading?.(location.child.text?.trim() || t('rulefile_metadata_untitled_item'));
        return location;
    };

    const handle_field_input = () => {
        sync_from_form(false);
        options.update_heading?.(location.child.text?.trim() || t('rulefile_metadata_untitled_item'));
        options.on_change?.();
    };

    name_input.addEventListener('input', handle_field_input);
    description_input.addEventListener('input', handle_field_input);
    pattern_input.addEventListener('input', handle_field_input);
    default_selected_input.addEventListener('change', handle_field_input);
    group_select.addEventListener('change', () => {
        sync_from_form(false);
        options.on_change?.();
    });

    refresh_requirements_table();

    const actions = Helpers.create_element('div', { class_name: 'form-actions content-type-edit-form-actions' });

    if (!options.is_create && child_id) {
        const delete_btn = Helpers.create_element('button', {
            class_name: ['button', 'button-danger', 'content-type-edit-delete-button'],
            attributes: { type: 'button' },
            text_content: t('rulefile_content_types_remove'),
        }) as HTMLButtonElement;
        delete_btn.addEventListener('click', () => {
            const display_name = location.child.text?.trim() || child_id;
            const req_count = get_requirements_count_by_content_type_id(
                options.get_rule_file_content?.() ?? rule_file_content,
                child_id
            );
            const warning_text = req_count > 0
                ? t('modal_message_delete_content_type_with_requirements', {
                    name: display_name,
                    count: req_count,
                })
                : t('modal_message_delete_content_type', { name: display_name });
            show_confirm_delete_modal({
                h1_text: t('modal_h1_delete_content_type'),
                warning_text,
                delete_button: delete_btn,
                on_confirm: () => options.on_delete?.(),
            });
        });
        actions.appendChild(delete_btn);
    }

    const action_buttons = Helpers.create_element('div', { class_name: 'content-type-edit-primary-actions' });
    const save_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-primary'],
        attributes: { type: 'submit' },
        text_content: t('save_changes_button'),
    });
    const back_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: t('rulefile_content_types_back_without_saving'),
    });
    back_btn.addEventListener('click', () => options.on_back?.());
    action_buttons.append(save_btn, back_btn);
    actions.appendChild(action_buttons);
    form.appendChild(actions);

    form.addEventListener('submit', (event) => event.preventDefault());
    container.appendChild(form);

    return { form, sync_from_form, refresh_requirements_table };
}

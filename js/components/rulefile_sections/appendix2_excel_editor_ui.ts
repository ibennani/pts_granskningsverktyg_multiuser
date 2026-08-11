/**
 * @fileoverview UI för redigering av Bilaga 2 Excel-fliknamn och etiketter.
 */
import {
    APPENDIX2_DEFICIENCY_COLUMN_KEYS,
    APPENDIX2_GENERAL_INFO_KEYS,
    APPENDIX2_SHEET_KEYS,
    type Appendix2LabelEntry,
    type Appendix2LocaleLabels,
    type Appendix2SheetKey,
} from '../../logic/appendix2_excel_template.js';

type EditorHelpers = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
};

type EditorTranslation = {
    t: (key: string) => string;
};

const SHEET_LABEL_HEADING_KEYS: Record<Appendix2SheetKey, string> = {
    general_info: 'rulefile_appendix2_general_labels_intro',
    deficiencies: 'rulefile_appendix2_deficiencies_labels_intro',
};

const SHEET_LABEL_PREFIX: Record<Appendix2SheetKey, string> = {
    general_info: 'appendix2-general',
    deficiencies: 'appendix2-deficiency',
};

const SHEET_LABEL_KEYS: Record<Appendix2SheetKey, readonly string[]> = {
    general_info: APPENDIX2_GENERAL_INFO_KEYS,
    deficiencies: APPENDIX2_DEFICIENCY_COLUMN_KEYS,
};

export type Appendix2SheetEditorHost = {
    sheet_names: Record<Appendix2SheetKey, string>;
    selected_sheet: Appendix2SheetKey;
    sheet_select_ref: HTMLSelectElement | null;
    sheet_name_input_ref: HTMLInputElement | null;
    label_panel_refs: Record<Appendix2SheetKey, HTMLElement | null>;
};

function sync_sheet_select_option(select: HTMLSelectElement, sheet_key: Appendix2SheetKey, label: string): void {
    const option = select.querySelector(`option[value="${CSS.escape(sheet_key)}"]`);
    if (option) {
        option.textContent = label;
    }
}

function flush_active_sheet_name(host: Appendix2SheetEditorHost): void {
    const input = host.sheet_name_input_ref;
    if (!input) return;
    const trimmed = input.value.trim();
    if (trimmed) {
        host.sheet_names[host.selected_sheet] = trimmed;
    }
}

function show_sheet_name_in_input(host: Appendix2SheetEditorHost): void {
    const input = host.sheet_name_input_ref;
    if (!input) return;
    input.value = host.sheet_names[host.selected_sheet] ?? '';
}

function set_visible_sheet_panels(host: Appendix2SheetEditorHost): void {
    APPENDIX2_SHEET_KEYS.forEach((sheet_key) => {
        const panel = host.label_panel_refs[sheet_key];
        if (!panel) return;
        if (sheet_key === host.selected_sheet) {
            panel.removeAttribute('hidden');
        } else {
            panel.setAttribute('hidden', '');
        }
    });
}

function on_sheet_selection_changed(host: Appendix2SheetEditorHost, next_sheet: Appendix2SheetKey): void {
    flush_active_sheet_name(host);
    host.selected_sheet = next_sheet;
    show_sheet_name_in_input(host);
    set_visible_sheet_panels(host);
}

function append_intro_text(helpers: EditorHelpers, section: HTMLElement, text: string): void {
    section.appendChild(
        helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: text,
        })
    );
}

function append_sheet_select(
    helpers: EditorHelpers,
    t: EditorTranslation['t'],
    host: Appendix2SheetEditorHost,
    section: HTMLElement
): void {
    const select_id = 'appendix2-sheet-select';
    const select_group = helpers.create_element('div', {
        class_name: ['form-group', 'rulefile-appendix2-sheet-select-group'],
    });
    select_group.appendChild(
        helpers.create_element('label', {
            attributes: { for: select_id },
            text_content: t('rulefile_appendix2_sheet_select_label'),
        })
    );
    const select = helpers.create_element('select', {
        class_name: ['form-control', 'dropdown-select', 'rulefile-appendix2-sheet-select'],
        attributes: { id: select_id, name: select_id },
    }) as HTMLSelectElement;

    APPENDIX2_SHEET_KEYS.forEach((sheet_key) => {
        select.appendChild(
            helpers.create_element('option', {
                attributes: { value: sheet_key },
                text_content: host.sheet_names[sheet_key] ?? sheet_key,
            })
        );
    });
    select.value = host.selected_sheet;
    select.addEventListener('change', () => {
        on_sheet_selection_changed(host, select.value as Appendix2SheetKey);
    });
    select_group.appendChild(select);
    section.appendChild(select_group);
    host.sheet_select_ref = select;
}

function append_sheet_name_panel(
    helpers: EditorHelpers,
    t: EditorTranslation['t'],
    host: Appendix2SheetEditorHost,
    section: HTMLElement
): void {
    const panel = helpers.create_element('section', {
        class_name: 'rulefile-appendix2-subsection',
        attributes: { 'aria-labelledby': 'rulefile-appendix2-sheet-name-heading' },
    });
    panel.appendChild(
        helpers.create_element('h3', {
            attributes: { id: 'rulefile-appendix2-sheet-name-heading' },
            text_content: t('rulefile_appendix2_sheet_name_heading'),
        })
    );
    append_intro_text(helpers, panel, t('rulefile_appendix2_sheet_name_intro'));

    const name_id = 'appendix2-sheet-name';
    const name_group = helpers.create_element('div', { class_name: 'form-group' });
    name_group.appendChild(
        helpers.create_element('label', {
            attributes: { for: name_id },
            text_content: t('rulefile_appendix2_sheet_name_label'),
        })
    );
    const name_input = helpers.create_element('input', {
        class_name: 'form-control',
        attributes: {
            type: 'text',
            id: name_id,
            name: name_id,
            value: host.sheet_names[host.selected_sheet] ?? '',
        },
    }) as HTMLInputElement;
    name_input.addEventListener('blur', () => {
        const trimmed = name_input.value.trim();
        if (trimmed) {
            host.sheet_names[host.selected_sheet] = trimmed;
        }
        if (host.sheet_select_ref) {
            sync_sheet_select_option(
                host.sheet_select_ref,
                host.selected_sheet,
                host.sheet_names[host.selected_sheet]
            );
        }
    });
    name_group.appendChild(name_input);
    panel.appendChild(name_group);
    section.appendChild(panel);
    host.sheet_name_input_ref = name_input;
}

function append_taxonomy_column_readonly_list(
    helpers: EditorHelpers,
    panel: HTMLElement,
    taxonomy_column_labels: string[]
): void {
    if (taxonomy_column_labels.length === 0) return;
    const list = helpers.create_element('ul', {
        class_name: ['metadata-list', 'rulefile-appendix2-value-list', 'rulefile-appendix2-taxonomy-columns-list'],
    });
    taxonomy_column_labels.forEach((label) => {
        list.appendChild(helpers.create_element('li', { text_content: label }));
    });
    panel.appendChild(list);
}

function append_sheet_label_panel(
    helpers: EditorHelpers,
    t: EditorTranslation['t'],
    host: Appendix2SheetEditorHost,
    section: HTMLElement,
    sheet_key: Appendix2SheetKey,
    entries: Appendix2LabelEntry[],
    taxonomy_column_labels: string[] = []
): void {
    const heading_id = `rulefile-appendix2-${sheet_key}-labels-heading`;
    const panel = helpers.create_element('section', {
        class_name: 'rulefile-appendix2-subsection',
        attributes: { 'aria-labelledby': heading_id },
    });
    panel.appendChild(
        helpers.create_element('h3', {
            attributes: { id: heading_id },
            text_content: t(SHEET_LABEL_HEADING_KEYS[sheet_key]),
        })
    );
    append_appendix2_label_fields(
        helpers,
        t,
        panel,
        SHEET_LABEL_PREFIX[sheet_key],
        SHEET_LABEL_KEYS[sheet_key],
        entries
    );
    if (sheet_key === 'deficiencies') {
        append_taxonomy_column_readonly_list(helpers, panel, taxonomy_column_labels);
        panel.appendChild(
            helpers.create_element('p', {
                class_name: 'view-intro-text rulefile-appendix2-taxonomy-note',
                text_content: t('rulefile_appendix2_taxonomy_columns_note'),
            })
        );
    }
    if (sheet_key !== host.selected_sheet) {
        panel.setAttribute('hidden', '');
    }
    section.appendChild(panel);
    host.label_panel_refs[sheet_key] = panel;
}

export type Appendix2ExcelEditorOptions = {
    taxonomy_column_labels?: string[];
};

export function create_appendix2_excel_editor(
    helpers: EditorHelpers,
    t: EditorTranslation['t'],
    host: Appendix2SheetEditorHost,
    form: HTMLElement,
    labels: Appendix2LocaleLabels,
    options: Appendix2ExcelEditorOptions = {}
): void {
    const taxonomy_column_labels = options.taxonomy_column_labels ?? [];
    const section = helpers.create_element('section', {
        class_name: 'rulefile-appendix2-section',
        attributes: { 'aria-labelledby': 'rulefile-appendix2-sheets-heading' },
    });
    section.appendChild(
        helpers.create_element('h2', {
            attributes: { id: 'rulefile-appendix2-sheets-heading' },
            text_content: t('rulefile_appendix2_sheets_heading'),
        })
    );
    append_intro_text(helpers, section, t('rulefile_appendix2_sheets_intro'));
    append_sheet_select(helpers, t, host, section);
    append_sheet_name_panel(helpers, t, host, section);
    append_sheet_label_panel(helpers, t, host, section, 'general_info', labels.generalInfo);
    append_sheet_label_panel(
        helpers,
        t,
        host,
        section,
        'deficiencies',
        labels.deficiencyColumns,
        taxonomy_column_labels
    );
    form.appendChild(section);
}

export function read_appendix2_sheet_names_from_host(host: Appendix2SheetEditorHost): Record<Appendix2SheetKey, string> {
    flush_active_sheet_name(host);
    return { ...host.sheet_names };
}

export function append_appendix2_label_fields(
    helpers: EditorHelpers,
    t: EditorTranslation['t'],
    section: HTMLElement,
    prefix: string,
    keys: readonly string[],
    entries: Appendix2LabelEntry[]
): void {
    const label_map = new Map(entries.map((entry) => [entry.key, entry.label]));
    keys.forEach((key) => {
        const field_id = `${prefix}-${key}`;
        const wrapper = helpers.create_element('div', { class_name: 'form-group' });
        wrapper.appendChild(
            helpers.create_element('label', {
                attributes: { for: field_id },
                text_content: t(`rulefile_appendix2_field_${key}`),
            })
        );
        wrapper.appendChild(
            helpers.create_element('input', {
                class_name: 'form-control',
                attributes: {
                    type: 'text',
                    id: field_id,
                    name: field_id,
                    value: label_map.get(key) ?? '',
                },
            })
        );
        section.appendChild(wrapper);
    });
}

export function create_appendix2_labels_host(labels: Appendix2LocaleLabels): Appendix2SheetEditorHost {
    return {
        sheet_names: { ...labels.sheetNames },
        selected_sheet: APPENDIX2_SHEET_KEYS[0],
        sheet_select_ref: null,
        sheet_name_input_ref: null,
        label_panel_refs: {
            general_info: null,
            deficiencies: null,
        },
    };
}

export function read_input_label_values(
    container: HTMLElement,
    prefix: string,
    keys: readonly string[]
): Appendix2LabelEntry[] {
    return keys.map((key) => {
        const input = container.querySelector<HTMLInputElement>(`#${prefix}-${key}`);
        return { key, label: input?.value ?? '' };
    });
}

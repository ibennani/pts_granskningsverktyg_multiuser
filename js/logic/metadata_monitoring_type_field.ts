/**
 * @fileoverview Formulärfält för val av vad som ska granskas (Webb/PDF) i metadatasteget.
 */

import type { MonitoringTypeOption } from './published_monitoring_rule_options.js';

type HelpersLike = {
    create_element: (
        tag: string,
        opts?: {
            class_name?: string | string[];
            text_content?: string;
            attributes?: Record<string, string>;
        }
    ) => HTMLElement;
};

type TranslationLike = {
    t: (key: string) => string;
};

export type MetadataMonitoringTypeFieldHandles = {
    form_group: HTMLElement;
    select_element: HTMLSelectElement;
    get_selected_monitoring_key: () => string;
};

export type MetadataMonitoringTypeFieldOptions = {
    include_empty_placeholder?: boolean;
};

/** Läsbar etikett för vad som granskas (Webb/PDF) från regelfilens metadata. */
export function resolve_monitoring_type_label(rule_file_content: unknown): string {
    const monitoring_type = (
        rule_file_content as { metadata?: { monitoringType?: { text?: string; label?: string } } } | null
    )?.metadata?.monitoringType;
    const text = monitoring_type?.text || monitoring_type?.label || '';
    return String(text).trim();
}

/** Visningstext: regelfil först, annars etikett från valt alternativ. */
export function resolve_monitoring_type_display_label(
    rule_file_content: unknown,
    options: MonitoringTypeOption[] = [],
    selected_key = ''
): string {
    const from_rule = resolve_monitoring_type_label(rule_file_content);
    if (from_rule) return from_rule;
    const key = String(selected_key ?? '').trim();
    if (!key) return '';
    const match = options.find((row) => row.key === key);
    return match?.label ?? '';
}

function metadata_form_create_field_value_element(
    Helpers: HelpersLike,
    text: string
): HTMLElement {
    return Helpers.create_element('p', {
        class_name: 'metadata-field-value',
        text_content: text,
    });
}

/** Skrivskyddat fält när granskningen redan startat. */
export function metadata_form_create_monitoring_type_readonly_field(
    Helpers: HelpersLike,
    Translation: TranslationLike,
    label_text: string
): HTMLElement {
    const t = Translation.t;
    const form_group = Helpers.create_element('div', { class_name: 'form-group' });
    form_group.appendChild(
        Helpers.create_element('label', {
            text_content: t('rulefile_metadata_field_monitoring_type_label'),
        })
    );
    form_group.appendChild(metadata_form_create_field_value_element(Helpers, label_text));
    return form_group;
}

export function metadata_form_create_monitoring_type_field(
    Helpers: HelpersLike,
    Translation: TranslationLike,
    options: MonitoringTypeOption[],
    selected_key: string,
    on_change?: (monitoring_key: string) => void,
    field_options: MetadataMonitoringTypeFieldOptions = {}
): MetadataMonitoringTypeFieldHandles | null {
    if (!Array.isArray(options) || options.length === 0) return null;

    const t = Translation.t;
    const form_group = Helpers.create_element('div', { class_name: 'form-group' });
    const label = Helpers.create_element('label', {
        attributes: { for: 'monitoringTypeKey' },
        text_content: t('rulefile_metadata_field_monitoring_type_label'),
    });
    form_group.appendChild(label);

    const select_attributes: Record<string, string> = {
        id: 'monitoringTypeKey',
        name: 'monitoringTypeKey',
        required: 'required',
    };

    const select = Helpers.create_element('select', {
        class_name: ['form-control', 'dropdown-select'],
        attributes: select_attributes,
    }) as HTMLSelectElement;

    if (field_options.include_empty_placeholder === true) {
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: '' },
                text_content: t('metadata_monitoring_type_select_prompt'),
            })
        );
    }

    options.forEach((option) => {
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: option.key },
                text_content: option.label,
            })
        );
    });

    const initial = String(selected_key ?? '').trim();
    if (field_options.include_empty_placeholder === true) {
        if (initial && options.some((option) => option.key === initial)) {
            select.value = initial;
        } else {
            select.value = '';
        }
    } else if (initial && options.some((option) => option.key === initial)) {
        select.value = initial;
    } else if (options.length === 1) {
        select.value = options[0].key;
    } else {
        select.value = '';
    }

    if (typeof on_change === 'function') {
        select.addEventListener('change', () => {
            on_change(String(select.value ?? '').trim());
        });
    }

    form_group.appendChild(select);

    return {
        form_group,
        select_element: select,
        get_selected_monitoring_key: () => String(select.value ?? '').trim(),
    };
}

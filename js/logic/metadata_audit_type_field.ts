/**
 * @fileoverview Formulärfält för val av granskningstyp i metadatasteget.
 */

import {
    apply_audit_type_selection,
    audit_type_field_editable,
    resolve_available_audit_types,
} from '../../shared/audit/audit_type_metadata.js';

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

export type MetadataAuditTypeFieldHandles = {
    form_group: HTMLElement;
    select_element: HTMLSelectElement | null;
    get_selected_audit_type_id: () => string;
    validate_selection: () => boolean;
};

/**
 * Regelfil för granskningstyp-dropdown.
 * Nya granskningar (not_started) väntar tills Webb/PDF valts.
 * Pågående och avslutade granskningar använder alltid effektiv regelfil.
 */
export function metadata_form_audit_type_rule_content(
    rule_file_content: unknown,
    monitoring_type_confirmed: boolean,
    audit_status: string | null | undefined = 'not_started'
): unknown {
    const is_new_audit = audit_status === 'not_started';
    if (is_new_audit && !monitoring_type_confirmed) {
        return { metadata: {} };
    }
    return rule_file_content;
}

function append_audit_type_placeholder(
    Helpers: HelpersLike,
    Translation: TranslationLike,
    select: HTMLSelectElement,
    selected: boolean
): void {
    const attributes: Record<string, string> = { value: '' };
    if (selected) {
        attributes.selected = 'selected';
    }
    select.appendChild(
        Helpers.create_element('option', {
            attributes,
            text_content: Translation.t('metadata_audit_type_select_prompt'),
        })
    );
}

function append_audit_type_options(
    Helpers: HelpersLike,
    select: HTMLSelectElement,
    types: ReturnType<typeof resolve_available_audit_types>
): void {
    types.forEach((row) => {
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: row.id },
                text_content: row.label,
            })
        );
    });
}

export function metadata_form_create_audit_type_field(
    Helpers: HelpersLike,
    Translation: TranslationLike,
    rule_file_content: unknown,
    audit_status: string | null | undefined,
    initial_audit_type_id: string,
    initial_audit_type_label = ''
): MetadataAuditTypeFieldHandles {
    const types = resolve_available_audit_types(rule_file_content);
    const t = Translation.t;
    const initial_id = String(initial_audit_type_id ?? '').trim();
    const editable = audit_type_field_editable(
        { auditTypeId: initial_id, auditTypeLabel: initial_audit_type_label },
        audit_status
    );
    const form_group = Helpers.create_element('div', { class_name: 'form-group' });
    const label = Helpers.create_element('label', {
        attributes: { for: 'auditTypeId' },
        text_content: t('metadata_audit_type_question_label'),
    });
    form_group.appendChild(label);

    if (!editable && types.length === 1) {
        const readonly_text = Helpers.create_element('p', {
            class_name: 'metadata-field-value',
            text_content: types[0].label,
        });
        form_group.appendChild(readonly_text);
        return {
            form_group,
            select_element: null,
            get_selected_audit_type_id: () => types[0].id,
            validate_selection: () => true,
        };
    }

    if (!editable) {
        const selected = types.find((row) => row.id === String(initial_audit_type_id ?? '').trim());
        const stored_label = String(initial_audit_type_label ?? '').trim();
        const readonly_text = Helpers.create_element('p', {
            class_name: 'metadata-field-value',
            text_content: selected?.label || stored_label || initial_audit_type_id || '',
        });
        form_group.appendChild(readonly_text);
        return {
            form_group,
            select_element: null,
            get_selected_audit_type_id: () => String(initial_audit_type_id ?? '').trim(),
            validate_selection: () => Boolean(String(initial_audit_type_id ?? '').trim()),
        };
    }

    const select_attributes: Record<string, string> = {
        id: 'auditTypeId',
        name: 'auditTypeId',
    };
    if (types.length > 0) {
        select_attributes.required = 'required';
    }

    const select = Helpers.create_element('select', {
        class_name: ['form-control', 'dropdown-select'],
        attributes: select_attributes,
    }) as HTMLSelectElement;

    const initial = String(initial_audit_type_id ?? '').trim();
    const has_initial = Boolean(initial && types.some((row) => row.id === initial));

    if (types.length === 0) {
        append_audit_type_placeholder(Helpers, Translation, select, !has_initial);
    } else {
        append_audit_type_placeholder(Helpers, Translation, select, !has_initial);
        append_audit_type_options(Helpers, select, types);
    }

    if (has_initial) {
        select.value = initial;
    } else {
        select.value = '';
    }

    form_group.appendChild(select);

    return {
        form_group,
        select_element: select,
        get_selected_audit_type_id: () => String(select.value ?? '').trim(),
        validate_selection: () => {
            if (types.length === 0) return true;
            const id = String(select.value ?? '').trim();
            if (!id) return false;
            return types.some((row) => row.id === id);
        },
    };
}

export function metadata_form_apply_audit_type_to_form_data(
    form_data: Record<string, unknown>,
    rule_file_content: unknown,
    audit_type_id: string
): boolean {
    const meta: Record<string, unknown> = { ...form_data };
    const ok = apply_audit_type_selection(meta, rule_file_content, audit_type_id);
    if (!ok) return false;
    form_data.auditTypeId = meta.auditTypeId;
    form_data.auditTypeLabel = meta.auditTypeLabel;
    return true;
}

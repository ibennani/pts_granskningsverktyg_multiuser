/**
 * @fileoverview Formulärfält för val av granskningstyp i metadatasteget.
 */

import {
    apply_audit_type_selection,
    audit_type_editable_for_status,
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

export function metadata_form_create_audit_type_field(
    Helpers: HelpersLike,
    Translation: TranslationLike,
    rule_file_content: unknown,
    audit_status: string | null | undefined,
    initial_audit_type_id: string
): MetadataAuditTypeFieldHandles | null {
    const types = resolve_available_audit_types(rule_file_content);
    if (types.length === 0) return null;

    const t = Translation.t;
    const editable = audit_type_editable_for_status(audit_status);
    const form_group = Helpers.create_element('div', { class_name: 'form-group' });
    const label = Helpers.create_element('label', {
        attributes: { for: 'auditTypeId' },
        text_content: t('metadata_audit_type_label'),
    });
    form_group.appendChild(label);

    if (!editable && types.length === 1) {
        const readonly_text = Helpers.create_element('p', {
            class_name: ['form-control', 'metadata-audit-type-readonly'],
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
        const readonly_text = Helpers.create_element('p', {
            class_name: ['form-control', 'metadata-audit-type-readonly'],
            text_content: selected?.label || initial_audit_type_id || '—',
        });
        form_group.appendChild(readonly_text);
        return {
            form_group,
            select_element: null,
            get_selected_audit_type_id: () => String(initial_audit_type_id ?? '').trim(),
            validate_selection: () => Boolean(String(initial_audit_type_id ?? '').trim()),
        };
    }

    const select = Helpers.create_element('select', {
        class_name: ['form-control', 'dropdown-select'],
        attributes: {
            id: 'auditTypeId',
            name: 'auditTypeId',
            required: 'required',
        },
    }) as HTMLSelectElement;

    if (types.length > 1) {
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: '' },
                text_content: t('metadata_audit_type_select_prompt'),
            })
        );
    }

    types.forEach((row) => {
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: row.id },
                text_content: row.label,
            })
        );
    });

    const initial = String(initial_audit_type_id ?? '').trim();
    if (initial && types.some((row) => row.id === initial)) {
        select.value = initial;
    } else if (types.length === 1) {
        select.value = types[0].id;
    }

    form_group.appendChild(select);

    return {
        form_group,
        select_element: select,
        get_selected_audit_type_id: () => String(select.value ?? '').trim(),
        validate_selection: () => {
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

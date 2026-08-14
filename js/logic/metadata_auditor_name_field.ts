/**
 * @fileoverview Dropdown för ansvarig granskare i metadataformuläret (användar-id som värde).
 */

import { get_auditor_options } from '../api/client.js';

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

export type MetadataAuditorOption = {
    value: string;
    label: string;
};

export type MetadataAuditorNameFieldHandles = {
    form_group: HTMLElement;
    select_element: HTMLSelectElement;
    get_selected_auditor_user_id: () => string;
    get_selected_auditor_name: () => string;
};

let cached_auditor_options: MetadataAuditorOption[] | null = null;
let auditor_options_load_promise: Promise<MetadataAuditorOption[]> | null = null;

/** Rensar cache (t.ex. vid utloggning eller i tester). */
export function clear_metadata_auditor_options_cache(): void {
    cached_auditor_options = null;
    auditor_options_load_promise = null;
}

/** Bygger sorterade alternativ från användarlistan. */
export function build_metadata_auditor_options(
    users: Array<{ id?: string | null; name?: string | null }>
): MetadataAuditorOption[] {
    const rows: MetadataAuditorOption[] = [];
    for (const user of users) {
        const id = user?.id != null ? String(user.id).trim() : '';
        const name = user?.name != null ? String(user.name).trim() : '';
        if (!id || !name) continue;
        rows.push({ value: id, label: name });
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label, 'sv'));
}

/** Hämtar och cachar granskare-alternativ via GET /users/auditor-options. */
export async function load_metadata_auditor_options(): Promise<MetadataAuditorOption[]> {
    if (cached_auditor_options) {
        return cached_auditor_options;
    }
    if (!auditor_options_load_promise) {
        auditor_options_load_promise = get_auditor_options()
            .then((data) => {
                cached_auditor_options = build_metadata_auditor_options(Array.isArray(data) ? data : []);
                return cached_auditor_options;
            })
            .catch(() => {
                cached_auditor_options = [];
                return cached_auditor_options;
            })
            .finally(() => {
                auditor_options_load_promise = null;
            });
    }
    return auditor_options_load_promise;
}

function resolve_initial_auditor_selection(
    options: MetadataAuditorOption[],
    selected_user_id: string,
    fallback_auditor_name: string
): string {
    const id_trimmed = String(selected_user_id ?? '').trim();
    if (id_trimmed && options.some((row) => row.value === id_trimmed)) {
        return id_trimmed;
    }
    const name_trimmed = String(fallback_auditor_name ?? '').trim();
    if (name_trimmed) {
        const by_name = options.find((row) => row.label === name_trimmed);
        if (by_name) return by_name.value;
    }
    return options[0]?.value ?? '';
}

export function metadata_form_create_auditor_name_field(
    Helpers: HelpersLike,
    Translation: TranslationLike,
    options: MetadataAuditorOption[],
    selected_user_id: string,
    fallback_auditor_name = ''
): MetadataAuditorNameFieldHandles {
    const t = Translation.t;
    const form_group = Helpers.create_element('div', { class_name: 'form-group' });
    const label = Helpers.create_element('label', {
        attributes: { for: 'auditorUserId' },
        text_content: t('auditor_name'),
    });
    form_group.appendChild(label);

    const select = Helpers.create_element('select', {
        class_name: ['form-control', 'dropdown-select'],
        attributes: {
            id: 'auditorUserId',
            name: 'auditorUserId',
            required: 'required',
        },
    }) as HTMLSelectElement;

    const resolved_options = options.length > 0 ? options : [];

    for (const row of resolved_options) {
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: row.value },
                text_content: row.label,
            })
        );
    }

    const initial_id = resolve_initial_auditor_selection(
        resolved_options,
        selected_user_id,
        fallback_auditor_name
    );
    if (initial_id) {
        select.value = initial_id;
    }

    const find_label = (user_id: string) =>
        resolved_options.find((row) => row.value === user_id)?.label ?? '';

    form_group.appendChild(select);

    return {
        form_group,
        select_element: select,
        get_selected_auditor_user_id: () => String(select.value ?? '').trim(),
        get_selected_auditor_name: () => find_label(String(select.value ?? '').trim()),
    };
}

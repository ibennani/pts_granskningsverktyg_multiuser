/**
 * @fileoverview Dropdown för ansvarig granskare i metadataformuläret.
 */

import { get_users } from '../api/client.js';

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
    get_selected_auditor_name: () => string;
};

let cached_auditor_options: MetadataAuditorOption[] | null = null;
let auditor_options_load_promise: Promise<MetadataAuditorOption[]> | null = null;

/** Rensar cache (t.ex. vid utloggning eller i tester). */
export function clear_metadata_auditor_options_cache(): void {
    cached_auditor_options = null;
    auditor_options_load_promise = null;
}

/** Bygger sorterade alternativ från användarlistan och aktuell användare. */
export function build_metadata_auditor_options(
    users: Array<{ name?: string | null }>,
    current_user_name: string
): MetadataAuditorOption[] {
    const names = new Set<string>();
    const add_name = (raw: string) => {
        const trimmed = String(raw ?? '').trim();
        if (trimmed) names.add(trimmed);
    };

    for (const user of users) {
        add_name(String(user?.name ?? ''));
    }
    add_name(current_user_name);

    return [...names]
        .sort((a, b) => a.localeCompare(b, 'sv'))
        .map((value) => ({ value, label: value }));
}

/** Hämtar och cachar granskare-alternativ via GET /users. */
export async function load_metadata_auditor_options(
    current_user_name: string
): Promise<MetadataAuditorOption[]> {
    if (cached_auditor_options) {
        return cached_auditor_options;
    }
    if (!auditor_options_load_promise) {
        auditor_options_load_promise = get_users()
            .then((data) => {
                cached_auditor_options = build_metadata_auditor_options(
                    Array.isArray(data) ? data : [],
                    current_user_name
                );
                return cached_auditor_options;
            })
            .catch(() => {
                cached_auditor_options = build_metadata_auditor_options([], current_user_name);
                return cached_auditor_options;
            })
            .finally(() => {
                auditor_options_load_promise = null;
            });
    }
    return auditor_options_load_promise;
}

export function metadata_form_create_auditor_name_field(
    Helpers: HelpersLike,
    Translation: TranslationLike,
    options: MetadataAuditorOption[],
    selected_name: string
): MetadataAuditorNameFieldHandles {
    const t = Translation.t;
    const form_group = Helpers.create_element('div', { class_name: 'form-group' });
    const label = Helpers.create_element('label', {
        attributes: { for: 'auditorName' },
        text_content: t('auditor_name'),
    });
    form_group.appendChild(label);

    const select = Helpers.create_element('select', {
        class_name: ['form-control', 'dropdown-select'],
        attributes: {
            id: 'auditorName',
            name: 'auditorName',
            required: 'required',
        },
    }) as HTMLSelectElement;

    const resolved_options =
        options.length > 0 ? options : build_metadata_auditor_options([], selected_name);

    for (const row of resolved_options) {
        select.appendChild(
            Helpers.create_element('option', {
                attributes: { value: row.value },
                text_content: row.label,
            })
        );
    }

    const initial = String(selected_name ?? '').trim();
    if (initial && resolved_options.some((row) => row.value === initial)) {
        select.value = initial;
    } else if (resolved_options.length > 0) {
        select.value = resolved_options[0].value;
    }

    form_group.appendChild(select);

    return {
        form_group,
        select_element: select,
        get_selected_auditor_name: () => String(select.value ?? '').trim(),
    };
}

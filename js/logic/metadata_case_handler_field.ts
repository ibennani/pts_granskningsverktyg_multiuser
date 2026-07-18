/**

 * @fileoverview Dropdown för handläggare i metadataformuläret.

 */



import { get_audits } from '../api/client.js';



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



export const METADATA_CASE_HANDLER_ADD_NEW_VALUE = '__add_new__';



export type MetadataCaseHandlerOption = {
    value: string;
    label: string;
    /** Sant om namnet kommer från befintliga granskningar (inte enbart aktuellt värde). */
    from_audit?: boolean;
};



export type MetadataCaseHandlerFieldHandles = {

    form_group: HTMLElement;

    select_element: HTMLSelectElement;

    new_name_input: HTMLInputElement | null;

    get_selected_case_handler: () => string;

};



type AuditRowLike = {

    metadata?: { caseHandler?: unknown } | null;

};



let cached_case_handler_options: MetadataCaseHandlerOption[] | null = null;

let case_handler_options_load_promise: Promise<MetadataCaseHandlerOption[]> | null = null;



/** Rensar cache (t.ex. vid utloggning eller i tester). */

export function clear_metadata_case_handler_options_cache(): void {

    cached_case_handler_options = null;

    case_handler_options_load_promise = null;

}



function add_case_handler_name(names: Set<string>, raw: unknown): void {

    const trimmed = String(raw ?? '').trim();

    if (trimmed) names.add(trimmed);

}



/** Bygger sorterade alternativ från granskningar och valfritt aktuellt värde. */
export function build_metadata_case_handler_options(
    audits: AuditRowLike[],
    current_case_handler: string
): MetadataCaseHandlerOption[] {
    const audit_names = new Set<string>();
    for (const audit of audits) {
        add_case_handler_name(audit_names, audit?.metadata?.caseHandler);
    }
    const names = new Set(audit_names);
    add_case_handler_name(names, current_case_handler);

    return [...names]
        .sort((a, b) => a.localeCompare(b, 'sv'))
        .map((value) => ({
            value,
            label: value,
            from_audit: audit_names.has(value),
        }));
}



function ensure_current_case_handler_in_options(

    options: MetadataCaseHandlerOption[],

    current_case_handler: string

): MetadataCaseHandlerOption[] {

    const trimmed = String(current_case_handler ?? '').trim();

    if (!trimmed || options.some((row) => row.value === trimmed)) {

        return options;

    }

    return [...options, { value: trimmed, label: trimmed, from_audit: false }].sort((a, b) =>

        a.value.localeCompare(b.value, 'sv')

    );

}



/** Hämtar och cachar handläggare-alternativ från befintliga granskningar. */

export async function load_metadata_case_handler_options(

    current_case_handler: string

): Promise<MetadataCaseHandlerOption[]> {

    if (cached_case_handler_options) {

        return ensure_current_case_handler_in_options(

            cached_case_handler_options,

            current_case_handler

        );

    }

    if (!case_handler_options_load_promise) {

        case_handler_options_load_promise = get_audits()

            .then((data) => {

                cached_case_handler_options = build_metadata_case_handler_options(
                    Array.isArray(data) ? data : [],
                    ''
                );

                return cached_case_handler_options;

            })

            .catch(() => {

                cached_case_handler_options = build_metadata_case_handler_options([], '');

                return cached_case_handler_options;

            })

            .finally(() => {

                case_handler_options_load_promise = null;

            });

    }

    return ensure_current_case_handler_in_options(
        await case_handler_options_load_promise,
        current_case_handler
    );
}



function append_empty_select_option(

    Helpers: HelpersLike,

    Translation: TranslationLike,

    select: HTMLSelectElement

): void {

    select.appendChild(

        Helpers.create_element('option', {

            attributes: { value: '' },

            text_content: Translation.t('metadata_case_handler_select_prompt'),

        })

    );

}



function append_handler_select_options(

    Helpers: HelpersLike,

    select: HTMLSelectElement,

    options: MetadataCaseHandlerOption[]

): void {

    for (const row of options) {

        select.appendChild(

            Helpers.create_element('option', {

                attributes: { value: row.value },

                text_content: row.label,

            })

        );

    }

}



function resolve_initial_case_handler_selection(

    selected_name: string,

    options: MetadataCaseHandlerOption[]

): { select_value: string; new_name_value: string } {

    const initial = String(selected_name ?? '').trim();

    if (!initial) {

        return { select_value: '', new_name_value: '' };

    }

    if (options.some((row) => row.value === initial && row.from_audit === true)) {
        return { select_value: initial, new_name_value: '' };
    }

    return {

        select_value: METADATA_CASE_HANDLER_ADD_NEW_VALUE,

        new_name_value: initial,

    };

}



function set_add_new_group_visible(

    add_new_group: HTMLElement,

    new_name_input: HTMLInputElement,

    visible: boolean

): void {

    if (visible) {

        add_new_group.removeAttribute('hidden');

        return;

    }

    add_new_group.setAttribute('hidden', '');

    new_name_input.value = '';

}



function sync_add_new_visibility(

    select: HTMLSelectElement,

    add_new_group: HTMLElement,

    new_name_input: HTMLInputElement

): void {

    const show_add_new = select.value === METADATA_CASE_HANDLER_ADD_NEW_VALUE;

    set_add_new_group_visible(add_new_group, new_name_input, show_add_new);

}



export function metadata_form_create_case_handler_field(

    Helpers: HelpersLike,

    Translation: TranslationLike,

    options: MetadataCaseHandlerOption[],

    selected_name: string,

    on_change?: () => void

): MetadataCaseHandlerFieldHandles {

    const t = Translation.t;

    const form_group = Helpers.create_element('div', { class_name: 'form-group' });

    const row = Helpers.create_element('div', {

        class_name: 'metadata-case-handler-row',

    });

    const select_group = Helpers.create_element('div', {

        class_name: 'metadata-case-handler-select-group',

    });

    const label = Helpers.create_element('label', {

        attributes: { for: 'caseHandler' },

        text_content: t('case_handler'),

    });

    const select = Helpers.create_element('select', {

        class_name: ['form-control', 'dropdown-select', 'metadata-case-handler-select'],

        attributes: {

            id: 'caseHandler',

            name: 'caseHandler',

        },

    }) as HTMLSelectElement;



    append_empty_select_option(Helpers, Translation, select);

    append_handler_select_options(Helpers, select, options);

    select.appendChild(

        Helpers.create_element('option', {

            attributes: { value: METADATA_CASE_HANDLER_ADD_NEW_VALUE },

            text_content: t('metadata_case_handler_add_option'),

        })

    );



    const initial = resolve_initial_case_handler_selection(selected_name, options);

    select.value = initial.select_value;



    const add_new_group = Helpers.create_element('div', {

        class_name: 'metadata-case-handler-add-new-group',

        attributes: { hidden: '' },

    });

    const new_name_label = Helpers.create_element('label', {

        attributes: { for: 'caseHandlerNewName' },

        text_content: t('metadata_case_handler_new_name_label'),

    });

    const new_name_input = Helpers.create_element('input', {

        class_name: ['form-control', 'metadata-case-handler-new-name-input'],

        attributes: {

            id: 'caseHandlerNewName',

            name: 'caseHandlerNewName',

            type: 'text',

            autocomplete: 'name',

            maxlength: '50',

        },

    }) as HTMLInputElement;

    new_name_input.value = initial.new_name_value;



    add_new_group.appendChild(new_name_label);

    add_new_group.appendChild(new_name_input);

    select_group.appendChild(label);

    select_group.appendChild(select);

    row.appendChild(select_group);

    row.appendChild(add_new_group);

    form_group.appendChild(row);



    sync_add_new_visibility(select, add_new_group, new_name_input);



    select.addEventListener('change', () => {

        sync_add_new_visibility(select, add_new_group, new_name_input);

        if (select.value === METADATA_CASE_HANDLER_ADD_NEW_VALUE) {

            new_name_input.focus();

        }

        if (typeof on_change === 'function') {

            on_change();

        }

    });



    new_name_input.addEventListener('input', () => {

        if (typeof on_change === 'function') {

            on_change();

        }

    });



    return {

        form_group,

        select_element: select,

        new_name_input,

        get_selected_case_handler: () => {

            if (select.value === METADATA_CASE_HANDLER_ADD_NEW_VALUE) {

                return String(new_name_input.value ?? '').trim();

            }

            return String(select.value ?? '').trim();

        },

    };

}



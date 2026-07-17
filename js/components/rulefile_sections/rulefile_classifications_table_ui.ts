/**

 * @fileoverview Delad tabellstruktur för klassificeringar (kravkoppling, bristtyper).

 */

export const RULEFILE_CLASSIFICATIONS_TABLE_CLASS = 'rulefile-classifications-table';

export const RULEFILE_CLASSIFICATIONS_LAYOUT_CLASS = 'rulefile-classifications-table-layout';

export const RULEFILE_CLASSIFICATIONS_FILTER_CLASS = 'rulefile-classifications-table-filter';

export const RULEFILE_CLASSIFICATIONS_SCROLL_WRAPPER_CLASS = 'rulefile-classifications-table-scroll-wrapper';

export const RULEFILE_CLASSIFICATIONS_ROW_HEADER_CLASS = 'rulefile-classifications-row-header';



type TableCtx = {

    Helpers: {

        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;

    };

    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };

};



export type ClassificationsTableColumn = {

    text: string;

    class_name?: string | string[];

    sr_only?: boolean;

};



export type ClassificationsTableRowSpec = {

    key: string;

    row_class?: string | string[];

    row_header_class?: string | string[];

    row_header_text: string;

    /** Om satt ersätter row_header_text (t.ex. länk i radhuvud). */

    row_header_element?: HTMLElement;

    cells: HTMLElement[];

};



export type ClassificationsTableFilterOptions = {

    label_key: string;

    id_prefix?: string;

    /** Visa filtret när tabellen har minst så här många rader (standard 1). */

    min_rows?: number;

};



function join_class_names(...parts: (string | string[] | undefined)[]): string {

    const classes: string[] = [];

    for (const part of parts) {

        if (!part) continue;

        if (Array.isArray(part)) classes.push(...part);

        else classes.push(part);

    }

    return classes.filter(Boolean).join(' ');

}



function normalize_filter(value: string): string {

    return value.trim().toLowerCase();

}



export function create_classifications_table_layout(Helpers: TableCtx['Helpers']): HTMLElement {

    return Helpers.create_element('div', { class_name: RULEFILE_CLASSIFICATIONS_LAYOUT_CLASS });

}



export function create_classifications_table_scroll_wrapper(

    Helpers: TableCtx['Helpers'],

    extra_classes?: string | string[]

): HTMLElement {

    /* Scroll-wrapper: naturlig höjd när tabellen är kort; max-height i CSS när innehållet behöver scroll. */

    return Helpers.create_element('div', {

        class_name: join_class_names(RULEFILE_CLASSIFICATIONS_SCROLL_WRAPPER_CLASS, extra_classes),

    });

}



export function create_classifications_table_filter(

    ctx: TableCtx,

    label_key: string,

    id_prefix = 'classifications-table-filter'

): { filter_row: HTMLElement; filter_input: HTMLInputElement } {

    const { Helpers, Translation } = ctx;

    const filter_id = `${id_prefix}-${Math.random().toString(36).substring(2, 8)}`;

    const filter_row = Helpers.create_element('div', {

        class_name: ['form-group', RULEFILE_CLASSIFICATIONS_FILTER_CLASS],

    });

    filter_row.appendChild(

        Helpers.create_element('label', {

            attributes: { for: filter_id },

            text_content: Translation.t(label_key),

        })

    );

    const filter_input = Helpers.create_element('input', {

        class_name: 'form-control',

        attributes: { id: filter_id, type: 'search' },

    }) as HTMLInputElement;

    filter_row.appendChild(filter_input);

    return { filter_row, filter_input };

}



export function append_classifications_table_filter_to_layout(

    layout: HTMLElement,

    ctx: TableCtx,

    row_count: number,

    options: ClassificationsTableFilterOptions

): HTMLInputElement | null {

    const min_rows = options.min_rows ?? 1;

    if (row_count < min_rows) {

        return null;

    }

    const { filter_row, filter_input } = create_classifications_table_filter(

        ctx,

        options.label_key,

        options.id_prefix ?? 'classifications-table-filter'

    );

    layout.appendChild(filter_row);

    return filter_input;

}



export function append_classifications_table_scroll_area(

    layout: HTMLElement,

    Helpers: TableCtx['Helpers'],

    table: HTMLTableElement,

    extra_classes?: string | string[]

): HTMLElement {

    const scroll_wrapper = create_classifications_table_scroll_wrapper(Helpers, extra_classes);

    scroll_wrapper.appendChild(table);

    layout.appendChild(scroll_wrapper);

    return scroll_wrapper;

}



function build_column_header(

    Helpers: TableCtx['Helpers'],

    column: ClassificationsTableColumn

): HTMLElement {

    const th = Helpers.create_element('th', {

        class_name: join_class_names(column.class_name) || undefined,

        attributes: { scope: 'col' },

    });

    if (column.sr_only) {

        th.appendChild(

            Helpers.create_element('span', {

                class_name: 'visually-hidden',

                text_content: column.text,

            })

        );

        return th;

    }

    th.textContent = column.text;

    return th;

}



function build_row_header(

    Helpers: TableCtx['Helpers'],

    row: ClassificationsTableRowSpec

): HTMLElement {

    const th = Helpers.create_element('th', {

        class_name: join_class_names(RULEFILE_CLASSIFICATIONS_ROW_HEADER_CLASS, row.row_header_class),

        attributes: { scope: 'row' },

    });

    if (row.row_header_element) {

        th.appendChild(row.row_header_element);

    } else {

        th.textContent = row.row_header_text;

    }

    return th;

}



export function create_classifications_table(

    ctx: TableCtx,

    options: {

        caption?: string;

        extra_table_classes?: string | string[];

        columns: ClassificationsTableColumn[];

        rows: ClassificationsTableRowSpec[];

    }

): { table: HTMLTableElement; tbody: HTMLTableSectionElement; row_elements: HTMLElement[] } {

    const { Helpers } = ctx;

    const table = Helpers.create_element('table', {

        class_name: join_class_names(RULEFILE_CLASSIFICATIONS_TABLE_CLASS, options.extra_table_classes),

    }) as HTMLTableElement;



    if (options.caption) {
        table.appendChild(
            Helpers.create_element('caption', { text_content: options.caption })
        );
    }



    const header_row = Helpers.create_element('tr');

    options.columns.forEach((column) => {

        header_row.appendChild(build_column_header(Helpers, column));

    });

    const thead = Helpers.create_element('thead');

    thead.appendChild(header_row);

    table.appendChild(thead);



    const tbody = Helpers.create_element('tbody') as HTMLTableSectionElement;

    const row_elements: HTMLElement[] = [];



    options.rows.forEach((row) => {

        const tr = Helpers.create_element('tr', {

            class_name: row.row_class,

            attributes: { 'data-requirement-key': row.key },

        });

        tr.appendChild(build_row_header(Helpers, row));

        row.cells.forEach((cell) => tr.appendChild(cell));

        tbody.appendChild(tr);

        row_elements.push(tr);

    });



    table.appendChild(tbody);

    return { table, tbody, row_elements };

}



export function attach_classifications_elements_filter(

    filter_input: HTMLInputElement,

    elements: HTMLElement[],

    options: { key_attribute?: string; title_selector?: string } = {}

): void {

    const key_attribute = options.key_attribute ?? 'data-requirement-key';

    const title_selector = options.title_selector ?? 'th';

    filter_input.addEventListener('input', () => {

        const needle = normalize_filter(filter_input.value);

        elements.forEach((element) => {

            const title = normalize_filter(element.querySelector(title_selector)?.textContent ?? '');

            const key = normalize_filter(element.getAttribute(key_attribute) ?? '');

            element.hidden = Boolean(needle) && !title.includes(needle) && !key.includes(needle);

        });

    });

}



export function attach_classifications_table_row_filter(

    filter_input: HTMLInputElement,

    row_elements: HTMLElement[],

    options: { key_attribute?: string } = {}

): void {

    attach_classifications_elements_filter(filter_input, row_elements, options);

}



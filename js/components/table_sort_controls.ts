/**
 * @fileoverview Sorteringsrad ovanför tabell – används när kolumner döljs responsivt.
 */

export type TableSortColumn = {
    headerLabel: string;
    columnKey?: string;
    getSortValue?: (row: unknown) => string | number;
    isAction?: boolean;
};

export type TableSortState = {
    columnIndex: number;
    direction: 'asc' | 'desc';
};

type CreateTableSortControlsOpts = {
    columns: TableSortColumn[];
    sortState?: TableSortState | null;
    onSort: (columnIndex: number, direction: 'asc' | 'desc') => void;
    t: (key: string, params?: Record<string, string | number>) => string;
    create_element: (
        tag: string,
        opts?: {
            class_name?: string | string[];
            text_content?: string;
            attributes?: Record<string, string>;
        }
    ) => HTMLElement;
    id_prefix?: string;
};

function get_sortable_columns(columns: TableSortColumn[]): { col: TableSortColumn; index: number }[] {
    return columns
        .map((col, index) => ({ col, index }))
        .filter(({ col }) => typeof col.getSortValue === 'function' && col.isAction !== true);
}

/** Skapar sorteringsrad med kolumn- och riktningsval. */
export function create_table_sort_controls(opts: CreateTableSortControlsOpts): HTMLElement | null {
    const sortable = get_sortable_columns(opts.columns);
    if (sortable.length === 0 || typeof opts.onSort !== 'function') {
        return null;
    }

    const id_prefix = opts.id_prefix || 'table-sort';
    const active_index = opts.sortState?.columnIndex ?? sortable[0].index;
    const active_direction = opts.sortState?.direction ?? 'asc';
    const t = opts.t;
    const { create_element } = opts;

    const bar = create_element('div', {
        class_name: ['audit-table-sort-controls', 'form-group']
    });

    const column_group = create_element('div', {
        class_name: 'audit-table-sort-controls__field'
    });
    const column_label = create_element('label', {
        attributes: { for: `${id_prefix}-column` },
        text_content: t('audit_table_sort_label')
    });
    const column_select = create_element('select', {
        class_name: ['form-control', 'audit-table-sort-controls__select'],
        attributes: {
            id: `${id_prefix}-column`,
            name: `${id_prefix}-column`
        }
    }) as HTMLSelectElement;
    for (const { col, index } of sortable) {
        column_select.appendChild(
            create_element('option', {
                attributes: { value: String(index) },
                text_content: col.headerLabel
            })
        );
    }
    column_select.value = String(active_index);
    column_group.appendChild(column_label);
    column_group.appendChild(column_select);
    bar.appendChild(column_group);

    const direction_group = create_element('div', {
        class_name: 'audit-table-sort-controls__field'
    });
    const direction_label = create_element('label', {
        attributes: { for: `${id_prefix}-direction` },
        text_content: t('audit_table_sort_direction_label')
    });
    const direction_select = create_element('select', {
        class_name: ['form-control', 'audit-table-sort-controls__select'],
        attributes: {
            id: `${id_prefix}-direction`,
            name: `${id_prefix}-direction`
        }
    }) as HTMLSelectElement;
    direction_select.appendChild(
        create_element('option', {
            attributes: { value: 'asc' },
            text_content: t('generic_table_sort_asc')
        })
    );
    direction_select.appendChild(
        create_element('option', {
            attributes: { value: 'desc' },
            text_content: t('generic_table_sort_desc')
        })
    );
    direction_select.value = active_direction;
    direction_group.appendChild(direction_label);
    direction_group.appendChild(direction_select);
    bar.appendChild(direction_group);

    const apply_sort = () => {
        const col_index = Number.parseInt(column_select.value, 10);
        const direction = direction_select.value === 'desc' ? 'desc' : 'asc';
        if (Number.isNaN(col_index)) return;
        opts.onSort(col_index, direction);
    };

    column_select.addEventListener('change', apply_sort);
    direction_select.addEventListener('change', apply_sort);

    return bar;
}

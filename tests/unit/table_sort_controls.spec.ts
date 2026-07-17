/**
 * @fileoverview Enhetstester för sorteringsrad ovanför tabell.
 */

import { create_table_sort_controls } from '../../js/components/table_sort_controls.ts';

function mock_create_element(
    tag: string,
    opts?: {
        class_name?: string | string[];
        text_content?: string;
        attributes?: Record<string, string>;
    }
): HTMLElement {
    const el = document.createElement(tag);
    if (opts?.class_name) {
        const classes = Array.isArray(opts.class_name) ? opts.class_name : [opts.class_name];
        el.classList.add(...classes);
    }
    if (opts?.text_content) {
        el.textContent = opts.text_content;
    }
    if (opts?.attributes) {
        for (const [key, value] of Object.entries(opts.attributes)) {
            el.setAttribute(key, value);
        }
    }
    return el;
}

describe('create_table_sort_controls', () => {
    it('returnerar null när inga sorterbara kolumner finns', () => {
        const result = create_table_sort_controls({
            columns: [{ headerLabel: 'Ladda ner', isAction: true }],
            onSort: () => {},
            t: (key) => key,
            create_element: mock_create_element
        });
        expect(result).toBeNull();
    });

    it('renderar val för sorterbara kolumner och anropar onSort', () => {
        const sort_calls: Array<[number, 'asc' | 'desc']> = [];
        const on_sort = (column_index: number, direction: 'asc' | 'desc') => {
            sort_calls.push([column_index, direction]);
        };
        const columns = [
            { headerLabel: 'Ärendenummer', columnKey: 'case_number', getSortValue: () => '' },
            { headerLabel: 'Aktör', columnKey: 'actor', getSortValue: () => '' },
            { headerLabel: 'Ladda ner', columnKey: 'download', isAction: true }
        ];
        const bar = create_table_sort_controls({
            columns,
            sortState: { columnIndex: 1, direction: 'desc' },
            onSort: on_sort,
            t: (key) => key,
            create_element: mock_create_element,
            id_prefix: 'test-sort'
        });
        expect(bar).not.toBeNull();
        const column_select = bar!.querySelector('#test-sort-column') as HTMLSelectElement;
        const direction_select = bar!.querySelector('#test-sort-direction') as HTMLSelectElement;
        expect(column_select.options).toHaveLength(2);
        expect(column_select.value).toBe('1');
        expect(direction_select.value).toBe('desc');

        column_select.value = '0';
        column_select.dispatchEvent(new Event('change'));
        expect(sort_calls).toContainEqual([0, 'desc']);

        direction_select.value = 'asc';
        direction_select.dispatchEvent(new Event('change'));
        expect(sort_calls).toContainEqual([0, 'asc']);
    });
});

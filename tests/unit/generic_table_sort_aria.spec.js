/**
 * Tillgänglighet för sorteringsrubriker i GenericTableComponent.
 */
import { describe, test, expect } from '@jest/globals';
import { create_element } from '../../js/dom/create_element.js';
import { GenericTableComponent } from '../../js/components/GenericTableComponent.js';

describe('GenericTableComponent sort accessibility', () => {
    test('inaktiv sortknapp saknar aria-label och aktiv har riktning', () => {
        const table = new GenericTableComponent();
        table.Helpers = { create_element };
        const root = document.createElement('div');

        table.render({
            root,
            columns: [
                {
                    headerLabel: 'Namn',
                    getContent: (row) => row.name,
                    getSortValue: (row) => row.name
                },
                {
                    headerLabel: 'Datum',
                    getContent: (row) => row.date,
                    getSortValue: (row) => row.date
                }
            ],
            data: [{ id: '1', name: 'A', date: '2024-01-01' }],
            emptyMessage: 'Tom',
            ariaLabel: 'Testtabell',
            sortState: { columnIndex: 0, direction: 'asc' },
            onSort: () => {},
            t: (key, opts = {}) => {
                if (key === 'generic_table_sort_aria_active') {
                    return `${opts.label}, ${opts.direction}`;
                }
                if (key === 'generic_table_sort_asc') return 'stigande';
                if (key === 'generic_table_sort_desc') return 'fallande';
                return key;
            }
        });

        const buttons = [...root.querySelectorAll('.generic-table-header-sort-btn')];
        expect(buttons).toHaveLength(2);
        expect(buttons[0].getAttribute('aria-label')).toBe('Namn, stigande');
        expect(buttons[0].hasAttribute('aria-label')).toBe(true);
        expect(buttons[1].hasAttribute('aria-label')).toBe(false);
        expect(buttons[1].textContent).toBe('Datum');
    });
});

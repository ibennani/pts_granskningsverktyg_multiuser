/**
 * Enhetstester för rulefile_classifications_table_ui.
 */
import { describe, test, expect } from '@jest/globals';
import {
    append_classifications_table_filter_to_layout,
    append_classifications_table_scroll_area,
    attach_classifications_elements_filter,
    attach_classifications_table_row_filter,
    create_classifications_table,
    create_classifications_table_filter,
    create_classifications_table_layout,
    RULEFILE_CLASSIFICATIONS_TABLE_CLASS,
} from '../../js/components/rulefile_sections/rulefile_classifications_table_ui.ts';

function create_helpers() {
    return {
        create_element: (tag: string, opts: Record<string, unknown> = {}) => {
            const el = document.createElement(tag);
            const class_name = opts.class_name;
            if (typeof class_name === 'string') {
                el.className = class_name;
            } else if (Array.isArray(class_name)) {
                el.className = class_name.join(' ');
            }
            if (typeof opts.text_content === 'string') {
                el.textContent = opts.text_content;
            }
            const attrs = opts.attributes as Record<string, string> | undefined;
            if (attrs) {
                for (const [key, value] of Object.entries(attrs)) {
                    el.setAttribute(key, value);
                }
            }
            return el;
        },
    };
}

describe('rulefile_classifications_table_ui', () => {
    test('create_classifications_table bygger caption, kolumnrubriker och rader', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };
        const text_cell = document.createElement('td');
        text_cell.textContent = 'Cell';

        const { table, row_elements } = create_classifications_table(ctx, {
            caption: 'Tabell',
            extra_table_classes: 'deficiency-types-table',
            columns: [
                { text: 'Krav', class_name: 'deficiency-types-requirement-header' },
                { text: 'Text', class_name: 'deficiency-types-text-header' },
            ],
            rows: [
                {
                    key: 'req_a',
                    row_header_class: 'deficiency-types-row-header',
                    row_header_text: '1.1.1 Krav',
                    cells: [text_cell],
                },
            ],
        });

        expect(table.classList.contains(RULEFILE_CLASSIFICATIONS_TABLE_CLASS)).toBe(true);
        expect(table.classList.contains('deficiency-types-table')).toBe(true);
        expect(table.querySelector('caption')?.textContent).toBe('Tabell');
        expect(table.querySelectorAll('thead th').length).toBe(2);
        expect(row_elements.length).toBe(1);
        expect(row_elements[0].getAttribute('data-requirement-key')).toBe('req_a');
        expect(row_elements[0].querySelector('.rulefile-classifications-row-header')?.textContent).toBe(
            '1.1.1 Krav'
        );
    });

    test('create_classifications_table_filter och attach_classifications_table_row_filter döljer rader', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };
        const { filter_input } = create_classifications_table_filter(
            ctx,
            'rulefile_classifications_mapping_filter_label',
            'test-filter'
        );
        const row = document.createElement('tr');
        row.setAttribute('data-requirement-key', 'req_a');
        const th = document.createElement('th');
        th.textContent = 'Alfa krav';
        row.appendChild(th);

        attach_classifications_table_row_filter(filter_input, [row]);
        filter_input.value = 'beta';
        filter_input.dispatchEvent(new Event('input'));

        expect(row.hidden).toBe(true);

        filter_input.value = 'alfa';
        filter_input.dispatchEvent(new Event('input'));
        expect(row.hidden).toBe(false);
    });

    test('create_classifications_table_layout sätter delad layout-klass', () => {
        const layout = create_classifications_table_layout(create_helpers());
        expect(layout.classList.contains('rulefile-classifications-table-layout')).toBe(true);
    });

    test('append_classifications_table_filter_to_layout lägger filter i layout och respekterar min_rows', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };
        const layout = create_classifications_table_layout(create_helpers());

        const filter_input = append_classifications_table_filter_to_layout(layout, ctx, 2, {
            label_key: 'rulefile_classifications_deficiency_types_filter_label',
            id_prefix: 'test-filter',
            min_rows: 3,
        });
        expect(filter_input).toBeNull();
        expect(layout.querySelector('.rulefile-classifications-table-filter')).toBeNull();

        const visible_filter = append_classifications_table_filter_to_layout(layout, ctx, 3, {
            label_key: 'rulefile_classifications_deficiency_types_filter_label',
            id_prefix: 'test-filter-visible',
            min_rows: 3,
        });
        expect(visible_filter).not.toBeNull();
        expect(layout.querySelector('.rulefile-classifications-table-filter')).not.toBeNull();
        expect(
            layout.querySelector('label')?.textContent
        ).toBe('rulefile_classifications_deficiency_types_filter_label');
    });

    test('append_classifications_table_scroll_area monterar tabell i scroll-wrapper', () => {
        const layout = create_classifications_table_layout(create_helpers());
        const table = document.createElement('table');
        table.className = 'deficiency-types-table';

        append_classifications_table_scroll_area(layout, create_helpers(), table, 'deficiency-types-scroll-wrapper');

        const wrapper = layout.querySelector('.deficiency-types-scroll-wrapper');
        expect(wrapper).not.toBeNull();
        expect(wrapper?.querySelector('table.deficiency-types-table')).toBe(table);
    });

    test('attach_classifications_elements_filter filtrerar via valfri titel-selektor', () => {
        const filter_input = document.createElement('input');
        const card = document.createElement('li');
        card.setAttribute('data-requirement-key', 'req_a');
        const title = document.createElement('h3');
        title.className = 'requirement-mapping-card-title';
        title.textContent = 'Alfa krav';
        card.appendChild(title);

        attach_classifications_elements_filter(filter_input, [card], {
            title_selector: '.requirement-mapping-card-title',
        });
        filter_input.value = 'beta';
        filter_input.dispatchEvent(new Event('input'));
        expect(card.hidden).toBe(true);
    });

    test('create_classifications_table sätter visually-hidden på sr_only-kolumn', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };
        const { table } = create_classifications_table(ctx, {
            caption: 'Tabell',
            columns: [
                { text: 'Krav' },
                { text: 'Åtgärder', sr_only: true, class_name: 'actions-header' },
            ],
            rows: [],
        });
        const actions_header = table.querySelector('.actions-header');
        expect(actions_header?.classList.contains('visually-hidden')).toBe(false);
        expect(actions_header?.querySelector('.visually-hidden')?.textContent).toBe('Åtgärder');
        expect(actions_header?.getAttribute('scope')).toBe('col');
        expect(table.querySelectorAll('thead th').length).toBe(2);
    });

    test('create_classifications_table renderar th för varje kolumn inklusive sr_only', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };
        const { table } = create_classifications_table(ctx, {
            caption: 'Tabell',
            columns: [
                { text: 'Kolumn A' },
                { text: 'Kolumn B' },
                { text: 'Åtgärder', sr_only: true, class_name: 'actions-header' },
            ],
            rows: [],
        });
        const headers = table.querySelectorAll('thead th');
        expect(headers.length).toBe(3);
        headers.forEach((header) => {
            expect(header.classList.contains('visually-hidden')).toBe(false);
        });
    });
});

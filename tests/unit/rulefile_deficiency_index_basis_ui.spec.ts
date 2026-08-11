/**

 * Enhetstester för rulefile_deficiency_index_basis_ui.

 */

import { describe, test, expect } from '@jest/globals';

import { render_deficiency_index_basis_ui } from '../../js/components/rulefile_sections/rulefile_deficiency_index_basis_ui.ts';



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



function build_rule_file() {

    return {

        requirements: {

            req_b: {

                id: 'req_b',

                title: 'Beta krav',

                standardReference: { text: '2.2.2' },

                metadata: { impact: { isCritical: false, primaryScore: 4, secondaryScore: 0 } },

            },

            req_a: {

                id: 'req_a',

                title: 'Alfa krav',

                standardReference: { text: '1.1.1' },

                metadata: { impact: { isCritical: true, primaryScore: 9, secondaryScore: 4 } },

            },

        },

    };

}



const COLUMN_KEYS = [

    'rulefile_classifications_mapping_requirement_column',

    'rulefile_classifications_deficiency_index_basis_critical_column',

    'primary_score',

    'secondary_score',

    'rulefile_classifications_deficiency_index_basis_weight_column',

];



describe('rulefile_deficiency_index_basis_ui', () => {

    test('renderar tabell med krav och totalpoäng', () => {

        const container = document.createElement('div');

        render_deficiency_index_basis_ui(

            {

                Helpers: create_helpers(),

                Translation: { t: (key: string) => key },

                router: () => {},

            },

            container,

            build_rule_file()

        );



        expect(container.querySelector('.deficiency-index-basis-table')).not.toBeNull();

        expect(container.querySelectorAll('tbody tr').length).toBe(2);



        const header_texts = Array.from(container.querySelectorAll('thead th')).map(

            (cell) => cell.textContent

        );

        expect(header_texts).toEqual(COLUMN_KEYS);



        const first_row = container.querySelector('tr[data-requirement-key="req_a"]');

        const total_score = first_row?.querySelector('.deficiency-index-basis-weight-value')?.textContent;

        expect(total_score).toBe('3.32');

    });



    test('apply_changes sparar ändrad primär poäng', () => {

        const container = document.createElement('div');

        const { apply_changes } = render_deficiency_index_basis_ui(

            {

                Helpers: create_helpers(),

                Translation: { t: (key: string) => key },

                router: () => {},

            },

            container,

            build_rule_file()

        );



        const primary_input = container.querySelector(

            'tr[data-requirement-key="req_a"] .deficiency-index-basis-primary-input'

        ) as HTMLInputElement;

        primary_input.value = '16';

        primary_input.dispatchEvent(new Event('input', { bubbles: true }));



        const next = apply_changes();

        const req_a = (next.requirements as Record<string, Record<string, unknown>>).req_a;

        const impact = (req_a.metadata as Record<string, unknown>).impact as Record<string, unknown>;

        expect(impact.primaryScore).toBe(16);

    });



    test('uppdaterar totalpoäng vid input utan omrendering', () => {

        const container = document.createElement('div');

        render_deficiency_index_basis_ui(

            {

                Helpers: create_helpers(),

                Translation: { t: (key: string) => key },

                router: () => {},

            },

            container,

            build_rule_file()

        );



        const row = container.querySelector('tr[data-requirement-key="req_a"]') as HTMLElement;

        const primary_input = row.querySelector('.deficiency-index-basis-primary-input') as HTMLInputElement;

        const secondary_input = row.querySelector('.deficiency-index-basis-secondary-input') as HTMLInputElement;

        primary_input.value = '0';

        secondary_input.value = '0';

        primary_input.dispatchEvent(new Event('input', { bubbles: true }));



        const total_score = row.querySelector('.deficiency-index-basis-weight-value')?.textContent;

        expect(total_score).toBe('0');

    });



    test('visar tillbaka-knapp efter tabellen', () => {

        const container = document.createElement('div');

        render_deficiency_index_basis_ui(

            {

                Helpers: create_helpers(),

                Translation: { t: (key: string) => key },

                router: () => {},

            },

            container,

            build_rule_file()

        );



        const children = Array.from(container.children);

        const part_panel_index = children.findIndex((child) => child.classList.contains('classifications-part-panel'));

        const back_row_index = children.findIndex((child) => child.classList.contains('audit-settings__back-row'));



        expect(part_panel_index).toBeGreaterThanOrEqual(0);

        expect(back_row_index).toBeGreaterThan(part_panel_index);

        expect(container.querySelector('.deficiency-index-basis-layout .deficiency-index-basis-table')).not.toBeNull();

        expect(container.querySelector('#deficiency-index-basis-calculation-heading')).not.toBeNull();
        expect(
            container.querySelector('.deficiency-index-basis-calculation-section .view-intro-text')
        ).not.toBeNull();
        const table_heading = container.querySelector('#deficiency-index-basis-table-heading');
        expect(table_heading).not.toBeNull();
        expect(table_heading?.textContent).toBe(
            'rulefile_classifications_deficiency_index_basis_table_heading'
        );
        const layout = container.querySelector('.deficiency-index-basis-layout');
        expect(layout?.firstElementChild?.id).toBe('deficiency-index-basis-table-heading');
        expect(container.querySelector('.classifications-part-panel .field-hint')).toBeNull();
        expect(container.querySelectorAll('h1').length).toBe(0);
        expect(container.querySelectorAll('h2').length).toBe(2);

    });

});



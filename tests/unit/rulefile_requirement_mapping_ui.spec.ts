/**
 * Enhetstester för rulefile_requirement_mapping_ui.
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_mapping_checkbox_key,
    build_requirement_rows,
    render_requirement_mapping_ui,
} from '../../js/components/rulefile_sections/rulefile_requirement_mapping_ui.ts';
import { get_requirement_display_label } from '../../js/logic/requirement_display_name.ts';
import { get_concept_ids_for_requirement } from '../../shared/classification/taxonomy_grouping.ts';

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

function build_rule_file(extra_taxonomy?: { id: string; label: string; concepts: Array<{ id: string; label: string }> }) {
    const taxonomies = [
        {
            id: 'wcag22-pour',
            label: 'WCAG-principer',
            concepts: [
                { id: 'perceivable', label: 'Uppfattningsbar' },
                { id: 'operable', label: 'Hanterbar' },
            ],
        },
    ];
    if (extra_taxonomy) {
        taxonomies.push(extra_taxonomy);
    }
    return {
        metadata: {
            primaryGroupingTaxonomyId: 'wcag22-pour',
            taxonomies,
        },
        requirements: {
            req_b: {
                id: 'req_b',
                title: 'Beta krav',
                standardReference: { text: '2.2.2' },
                classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'operable' }],
            },
            req_a: {
                id: 'req_a',
                title: 'Alfa krav',
                standardReference: { text: '1.1.1' },
                classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'perceivable' }],
            },
        },
    };
}

describe('rulefile_requirement_mapping_ui', () => {
    test('build_requirement_rows sorterar visningsetiketter alfabetiskt', () => {
        const rows = build_requirement_rows(build_rule_file().requirements);
        expect(rows.map((row) => row.display_label)).toEqual(['1.1.1 Alfa krav', '2.2.2 Beta krav']);
    });

    test('matrisrad visar referens och kravnamn', () => {
        const container = document.createElement('div');
        render_requirement_mapping_ui(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            build_rule_file()
        );
        const first_header = container.querySelector('.requirement-mapping-row-header');
        expect(first_header?.textContent).toBe('1.1.1 Alfa krav');
        const first_card_title = container.querySelector('.requirement-mapping-card-title');
        expect(first_card_title?.textContent).toBe('1.1.1 Alfa krav');
    });

    test('build_mapping_checkbox_key är stabil nyckel', () => {
        expect(build_mapping_checkbox_key('req_a', 'perceivable')).toBe('req_a::perceivable');
    });

    test('get_requirement_display_label kombinerar referensnummer och kravnamn', () => {
        expect(
            get_requirement_display_label({
                title: 'Non-text Content',
                standardReference: { text: '1.1.1 Non-text Content' },
            })
        ).toBe('1.1.1 Non-text Content');
        expect(
            get_requirement_display_label({
                metadata: { title: 'Icke-textuellt innehåll' },
                standardReference: { text: '1.1.1 Non-text Content' },
            })
        ).toBe('1.1.1 Icke-textuellt innehåll');
    });

    test('render_requirement_mapping_ui bygger matris och kort med rätt antal kryssrutor', () => {
        const container = document.createElement('div');
        render_requirement_mapping_ui(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            build_rule_file()
        );

        const table = container.querySelector('.requirement-mapping-table');
        expect(table).not.toBeNull();
        const header_cells = table?.querySelectorAll('thead th');
        expect(header_cells?.length).toBe(3);

        const matrix_checkboxes = container.querySelectorAll(
            '.requirement-mapping-matrix-wrapper input[type="checkbox"]'
        );
        expect(matrix_checkboxes.length).toBe(4);

        const cards = container.querySelectorAll('.requirement-mapping-card');
        expect(cards.length).toBe(2);
        const matrix_labels = container.querySelectorAll(
            '.requirement-mapping-matrix-wrapper label'
        );
        expect(matrix_labels.length).toBe(4);
        matrix_labels.forEach((label) => {
            expect(label.classList.contains('visually-hidden')).toBe(true);
        });

        const card_labels = container.querySelectorAll('.requirement-mapping-card-label');
        expect(card_labels.length).toBe(4);
        card_labels.forEach((label) => {
            expect(label.classList.contains('sr-only')).toBe(false);
            expect((label.textContent ?? '').trim().length).toBeGreaterThan(0);
        });
    });

    test('change i matris synkas till kort och apply_changes sparar checkbox_map', () => {
        const container = document.createElement('div');
        const rule_file = build_rule_file();
        const { apply_changes } = render_requirement_mapping_ui(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            rule_file
        );

        const map_key = build_mapping_checkbox_key('req_a', 'operable');
        const matrix_checkbox = container.querySelector(
            `.requirement-mapping-matrix-wrapper input[data-requirement-key="req_a"][data-concept-id="operable"]`
        ) as HTMLInputElement;
        const card_checkbox = container.querySelector(
            `.requirement-mapping-cards input[data-requirement-key="req_a"][data-concept-id="operable"]`
        ) as HTMLInputElement;

        expect(matrix_checkbox.checked).toBe(false);
        expect(card_checkbox.checked).toBe(false);

        matrix_checkbox.checked = true;
        matrix_checkbox.dispatchEvent(new Event('change', { bubbles: true }));

        expect(card_checkbox.checked).toBe(true);

        const updated = apply_changes();
        const req_record = updated.requirements as Record<string, Record<string, unknown>>;
        expect(get_concept_ids_for_requirement(req_record.req_a, 'wcag22-pour').sort()).toEqual([
            'operable',
            'perceivable',
        ]);

        card_checkbox.checked = false;
        card_checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        expect(matrix_checkbox.checked).toBe(false);

        const updated_again = apply_changes();
        const req_record_again = updated_again.requirements as Record<string, Record<string, unknown>>;
        expect(get_concept_ids_for_requirement(req_record_again.req_a, 'wcag22-pour')).toEqual([
            'perceivable',
        ]);
        expect(map_key).toBe('req_a::operable');
    });

    test('taxonomi-dropdown använder delad dropdown-select-klass', () => {
        const container = document.createElement('div');
        render_requirement_mapping_ui(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            build_rule_file()
        );

        const select = container.querySelector(
            '.requirement-mapping-taxonomy-field select'
        ) as HTMLSelectElement;
        expect(select).not.toBeNull();
        expect(select.classList.contains('form-control')).toBe(true);
        expect(select.classList.contains('dropdown-select')).toBe(true);
    });

    test('taxonomi-dropdown renderas ovanför filtret med fetstilta etiketter', () => {
        const container = document.createElement('div');
        render_requirement_mapping_ui(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            build_rule_file()
        );

        const layout = container.querySelector('.requirement-mapping-layout');
        expect(layout).not.toBeNull();

        const taxonomy_field = layout?.querySelector('.requirement-mapping-taxonomy-field');
        const filter_field = layout?.querySelector('.rulefile-classifications-table-filter');
        expect(taxonomy_field).not.toBeNull();
        expect(filter_field).not.toBeNull();

        const children = Array.from(layout?.children ?? []);
        const taxonomy_index = children.indexOf(taxonomy_field as Element);
        const filter_index = children.indexOf(filter_field as Element);
        expect(taxonomy_index).toBeGreaterThanOrEqual(0);
        expect(filter_index).toBeGreaterThan(taxonomy_index);

        const taxonomy_label = taxonomy_field?.querySelector('label');
        const filter_label = filter_field?.querySelector('label');
        expect(taxonomy_label?.textContent).toBe('rulefile_classifications_mapping_taxonomy_label');
        expect(filter_label?.textContent).toBe('rulefile_classifications_mapping_filter_label');
    });

    test('byte av taxonomi uppdaterar matrisens kolumner', () => {
        const container = document.createElement('div');
        render_requirement_mapping_ui(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            build_rule_file({
                id: 'impact',
                label: 'Påverkan',
                concepts: [{ id: 'high', label: 'Hög' }],
            })
        );

        const select = container.querySelector(
            '.requirement-mapping-taxonomy-field select'
        ) as HTMLSelectElement;
        expect(select.value).toBe('wcag22-pour');
        expect(container.querySelectorAll('.requirement-mapping-table thead th').length).toBe(3);

        select.value = 'impact';
        select.dispatchEvent(new Event('change', { bubbles: true }));

        expect(container.querySelectorAll('.requirement-mapping-table thead th').length).toBe(2);
    });

    test('apply_changes bevarar klassificeringar i andra taxonomier', () => {
        const container = document.createElement('div');
        const rule_file = build_rule_file({
            id: 'impact',
            label: 'Påverkan',
            concepts: [{ id: 'high', label: 'Hög' }],
        });
        rule_file.requirements.req_a.classifications = [
            { taxonomyId: 'wcag22-pour', conceptId: 'perceivable' },
            { taxonomyId: 'impact', conceptId: 'high' },
        ];

        const { apply_changes } = render_requirement_mapping_ui(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            rule_file
        );

        const select = container.querySelector(
            '.requirement-mapping-taxonomy-field select'
        ) as HTMLSelectElement;
        select.value = 'impact';
        select.dispatchEvent(new Event('change', { bubbles: true }));

        const impact_checkbox = container.querySelector(
            '.requirement-mapping-matrix-wrapper input[data-requirement-key="req_a"][data-concept-id="high"]'
        ) as HTMLInputElement;
        impact_checkbox.checked = false;
        impact_checkbox.dispatchEvent(new Event('change', { bubbles: true }));

        const updated = apply_changes();
        const req_record = updated.requirements as Record<string, Record<string, unknown>>;
        expect(get_concept_ids_for_requirement(req_record.req_a, 'wcag22-pour')).toEqual(['perceivable']);
        expect(get_concept_ids_for_requirement(req_record.req_a, 'impact')).toEqual([]);
    });
});

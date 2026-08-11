/**
 * Enhetstester för innehållstyper-tabell och kravkoppling.
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render_content_types_overview } from '../../js/components/rulefile_sections/rulefile_content_types_ui.ts';
import {
    build_content_type_requirement_rows,
    set_requirement_content_type_linked,
} from '../../js/components/rulefile_sections/rulefile_content_type_requirements.ts';
import { move_content_type_child_to_parent } from '../../js/components/rulefile_sections/rulefile_content_type_keys.ts';

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
            if (typeof opts.html_content === 'string') {
                el.innerHTML = opts.html_content;
            }
            const attrs = opts.attributes as Record<string, string> | undefined;
            if (attrs) {
                for (const [key, value] of Object.entries(attrs)) {
                    el.setAttribute(key, value);
                }
            }
            return el;
        },
        get_icon_svg: () => '<svg></svg>',
    };
}

const sample_metadata = {
    contentTypes: [
        {
            id: 'teknisk-grundstruktur',
            text: 'Teknisk grundstruktur',
            types: [
                { id: 'teknisk-grundstruktur-html', text: 'HTML', description: 'HTML-kod på sidan' },
                { id: 'teknisk-grundstruktur-css', text: 'CSS', description: '' },
            ],
        },
        {
            id: 'innehall',
            text: 'Innehåll',
            types: [{ id: 'innehall-text', text: 'Text', description: 'Brödtext' }],
        },
    ],
};

const sample_rule_file = {
    requirements: {
        req1: { key: 'req1', contentType: ['teknisk-grundstruktur-html'] },
        req2: { key: 'req2', contentType: ['teknisk-grundstruktur-html', 'innehall-text'] },
    },
};

describe('rulefile_content_types_ui', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    test('visar beskrivningskolumn och åtgärdsknappar', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };

        render_content_types_overview(ctx, container, sample_metadata, sample_rule_file);

        expect(container.querySelector('.content-types-description-header')?.textContent).toBe(
            'rulefile_content_types_description_column'
        );
        expect(container.querySelector('.content-types-default-selected-header')?.textContent).toBe(
            'rulefile_content_types_default_selected_column'
        );
        expect(container.querySelector('.content-types-default-selected-help')?.textContent).toBe(
            'rulefile_content_types_default_selected_help'
        );

        const html_row = Array.from(container.querySelectorAll('tbody tr')).find((row) =>
            row.querySelector('.content-types-row-header')?.textContent === 'HTML'
        );
        expect(html_row?.querySelector('.content-types-description-cell')?.textContent).toBe('HTML-kod på sidan');
        expect(html_row?.querySelector('.content-types-row-edit-button')).not.toBeNull();
    });

    test('Redigera- och Radera-knappar har aria-label med innehållstypens namn', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: {
                t: (key: string, opts?: Record<string, unknown>) => {
                    if (key === 'rulefile_content_types_edit_row_aria') {
                        return `Redigera ${opts?.name}`;
                    }
                    if (key === 'rulefile_content_types_remove_row_aria') {
                        return `Radera innehållstyp ${opts?.name}`;
                    }
                    return key;
                },
            },
        };

        render_content_types_overview(ctx, container, sample_metadata, sample_rule_file);

        const html_row = Array.from(container.querySelectorAll('tbody tr')).find((row) =>
            row.querySelector('.content-types-row-header')?.textContent === 'HTML'
        );
        const edit_button = html_row?.querySelector('.content-types-row-edit-button') as HTMLButtonElement;
        const delete_button = html_row?.querySelector('.content-types-row-delete-button') as HTMLButtonElement;
        expect(edit_button.getAttribute('aria-label')).toBe('Redigera HTML');
        expect(delete_button.getAttribute('aria-label')).toBe('Radera innehållstyp HTML');
    });

    test('tom lista visar tabell med rubriker', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };

        render_content_types_overview(ctx, container, { contentTypes: [] }, sample_rule_file);

        expect(container.querySelector('.content-types-table thead th')).not.toBeNull();
        expect(container.querySelector('tbody tr')).toBeNull();
    });
});

describe('rulefile_content_type_requirements', () => {
    test('kopplar och kopplar bort krav till innehållstyp', () => {
        const rows = build_content_type_requirement_rows(sample_rule_file, 'teknisk-grundstruktur-html');
        expect(rows.find((row) => row.key === 'req1')?.linked).toBe(true);
        expect(rows.find((row) => row.key === 'req2')?.linked).toBe(true);

        const unlinked = set_requirement_content_type_linked(
            sample_rule_file,
            'req1',
            'teknisk-grundstruktur-html',
            false
        );
        const updated_rows = build_content_type_requirement_rows(unlinked, 'teknisk-grundstruktur-html');
        expect(updated_rows.find((row) => row.key === 'req1')?.linked).toBe(false);
    });
});

describe('rulefile_content_type_keys', () => {
    test('flyttar undertyp till annan grupp', () => {
        const metadata = JSON.parse(JSON.stringify(sample_metadata)) as Record<string, unknown>;
        const location = {
            parent_index: 0,
            child_index: 0,
            parent: (metadata.contentTypes as Array<Record<string, unknown>>)[0],
            child: ((metadata.contentTypes as Array<{ types: Array<Record<string, unknown>> }>)[0].types)[0],
        };
        const moved = move_content_type_child_to_parent(metadata, location, 'innehall');
        expect(moved.parent.id).toBe('innehall');
        expect((metadata.contentTypes as Array<{ types: unknown[] }>)[0].types.length).toBe(1);
        expect((metadata.contentTypes as Array<{ types: unknown[] }>)[1].types.length).toBe(2);
    });
});

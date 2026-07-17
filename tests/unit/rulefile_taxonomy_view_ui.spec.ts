/**
 * Enhetstester för rulefile_taxonomy_view_ui.
 */
import { describe, test, expect, jest } from '@jest/globals';
import {
    find_taxonomy_by_key,
    render_taxonomy_view_section,
    taxonomy_row_key,
} from '../../js/components/rulefile_sections/rulefile_taxonomy_view_ui.ts';

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

function create_ctx(overrides: Record<string, unknown> = {}) {
    const router = jest.fn();
    const dispatch = jest.fn();
    return {
        Helpers: create_helpers(),
        Translation: {
            t: (key: string, opts?: Record<string, unknown>) => {
                const labels: Record<string, string> = {
                    rulefile_classifications_taxonomy_view_intro: 'Intro taxonomi',
                    rulefile_classifications_taxonomy_name_column: 'Namn',
                    rulefile_classifications_taxonomy_principles_column: 'Antal principer',
                    rulefile_classifications_taxonomy_actions_column: 'Åtgärder',
                    rulefile_classifications_taxonomy_view_link_aria: 'Visa information om {name}',
                    rulefile_classifications_taxonomy_edit_row_aria: 'Redigera {name}',
                    rulefile_classifications_taxonomy_remove: 'Ta bort taxonomi',
                    rulefile_classifications_taxonomy_remove_aria: 'Ta bort taxonomin {name}',
                    rulefile_classifications_taxonomy_add: 'Lägg till taxonomi',
                    rulefile_metadata_untitled_item: 'Namnlös',
                    rulefile_metadata_empty_value: 'Ingen information',
                    edit_button_label: 'Redigera',
                };
                let text = labels[key] ?? key;
                if (opts?.name) {
                    text = text.replace('{name}', String(opts.name));
                }
                return text;
            },
        },
        router,
        dispatch,
        StoreActionTypes: { UPDATE_RULEFILE_CONTENT: 'UPDATE_RULEFILE_CONTENT' },
        getState: () => ({
            auditStatus: 'rulefile_editing',
            ruleFileContent: {
                metadata: sample_metadata,
                requirements: {},
            },
        }),
        ...overrides,
    };
}

const sample_metadata = {
    taxonomies: [
        {
            id: 'wcag22-pour',
            label: 'WCAG 2.2 POUR',
            concepts: [
                { id: 'a', label: 'Möjlig att uppfatta' },
                { id: 'b', label: 'Hanterbar' },
            ],
        },
        {
            id: 'other',
            label: 'Annan taxonomi',
            concepts: [],
        },
    ],
};

describe('taxonomy_row_key', () => {
    test('använder id när det finns', () => {
        expect(taxonomy_row_key({ id: 'wcag22-pour' }, 0)).toBe('wcag22-pour');
    });

    test('använder fallback-index utan id', () => {
        expect(taxonomy_row_key({ label: 'Utan id' }, 2)).toBe('taxonomy-3');
    });
});

describe('find_taxonomy_by_key', () => {
    test('hittar taxonomi via id', () => {
        const match = find_taxonomy_by_key(sample_metadata, 'wcag22-pour');
        expect(match?.taxonomy.label).toBe('WCAG 2.2 POUR');
    });

    test('returnerar null för okänd nyckel', () => {
        expect(find_taxonomy_by_key(sample_metadata, 'saknas')).toBeNull();
    });
});

describe('render_taxonomy_view_section', () => {
    test('visar intro, tabell, Redigera, Ta bort och Lägg till taxonomi', () => {
        const ctx = create_ctx();
        const section = render_taxonomy_view_section(ctx, sample_metadata);

        expect(section.classList.contains('taxonomy-list-view')).toBe(true);
        expect(section.querySelector('.view-intro-text')?.textContent).toBe('Intro taxonomi');
        expect(section.querySelector('.audit-settings__back-row')).toBeNull();
        expect(section.querySelector('.taxonomy-add-button')?.textContent).toBe('Lägg till taxonomi');

        const row = section.querySelector('.taxonomy-table tbody tr') as HTMLElement;
        expect(row.querySelector('.taxonomy-name-link')?.textContent).toBe('WCAG 2.2 POUR');
        expect(row.querySelector('.taxonomy-principles-cell')?.textContent).toBe('2');
        expect(row.querySelector('.taxonomy-row-edit-button')?.textContent).toContain('Redigera');
        expect(row.querySelector('.taxonomy-row-delete-button')?.textContent).toBe('Ta bort taxonomi');
        expect(row.querySelector('.taxonomy-actions-stack')?.children.length).toBe(2);
    });

    test('länk och knappar navigerar korrekt', () => {
        const ctx = create_ctx();
        const section = render_taxonomy_view_section(ctx, sample_metadata);
        const row = section.querySelector('.taxonomy-table tbody tr') as HTMLElement;

        (row.querySelector('.taxonomy-name-link') as HTMLAnchorElement).click();
        expect(ctx.router).toHaveBeenCalledWith('rulefile_sections', {
            section: 'classifications',
            part: 'taxonomy',
            taxonomyId: 'wcag22-pour',
        });

        (row.querySelector('.taxonomy-row-edit-button') as HTMLButtonElement).click();
        expect(ctx.router).toHaveBeenCalledWith('rulefile_sections', {
            section: 'classifications',
            part: 'taxonomy',
            taxonomyId: 'wcag22-pour',
            edit: 'true',
        });

        (section.querySelector('.taxonomy-add-button') as HTMLButtonElement).click();
        expect(ctx.router).toHaveBeenCalledWith('rulefile_sections', {
            section: 'classifications',
            part: 'taxonomy',
            edit: 'true',
        });
    });
});

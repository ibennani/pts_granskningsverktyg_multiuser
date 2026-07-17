/**
 * Enhetstester för rulefile_taxonomy_detail_ui.
 */
import { describe, test, expect, jest } from '@jest/globals';
import {
    build_taxonomy_detail_edit_button,
    render_taxonomy_detail_ui,
} from '../../js/components/rulefile_sections/rulefile_taxonomy_detail_ui.ts';

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

function create_ctx() {
    return {
        Helpers: create_helpers(),
        Translation: {
            t: (key: string) => {
                const labels: Record<string, string> = {
                    rulefile_classifications_taxonomy_not_found: 'Hittades inte',
                    rulefile_classifications_taxonomy_principle_column: 'Principer',
                    rulefile_metadata_empty_value: 'Ingen information',
                    rulefile_metadata_untitled_item: 'Namnlös',
                    edit_button_label: 'Redigera',
                    rulefile_classifications_taxonomy_edit_row_aria: 'Redigera {name}',
                };
                return labels[key] ?? key;
            },
        },
        router: jest.fn(),
        getState: () => ({ auditStatus: 'rulefile_editing' }),
    };
}

const metadata = {
    taxonomies: [
        {
            id: 'wcag22-pour',
            label: 'WCAG 2.2 POUR',
            concepts: [{ id: 'a', label: 'Möjlig att uppfatta' }],
        },
    ],
};

describe('render_taxonomy_detail_ui', () => {
    test('visar endast principtabell utan sammanfattning eller redigeringsknapp', () => {
        const ctx = create_ctx();
        const section = render_taxonomy_detail_ui(ctx, metadata, 'wcag22-pour');

        expect(section.querySelector('.audit-settings__back-row')).toBeNull();
        expect(section.querySelector('.taxonomy-detail-heading')).toBeNull();
        expect(section.querySelector('.taxonomy-detail-summary')).toBeNull();
        expect(section.querySelector('.taxonomy-detail-edit-button')).toBeNull();
        expect(section.querySelector('.taxonomy-detail-actions')).toBeNull();
        expect(section.querySelector('.taxonomy-principles-table tbody tr')).not.toBeNull();
    });

    test('visar fel när taxonomi saknas', () => {
        const ctx = create_ctx();
        const section = render_taxonomy_detail_ui(ctx, metadata, 'saknas');

        expect(section.querySelector('.metadata-empty')?.textContent).toBe('Hittades inte');
        expect(section.querySelector('.taxonomy-detail-heading')).toBeNull();
    });
});

describe('build_taxonomy_detail_edit_button', () => {
    test('skapar redigeringsknapp med aria-label', () => {
        const ctx = create_ctx();
        const button = build_taxonomy_detail_edit_button(
            ctx,
            metadata.taxonomies[0]!,
            'wcag22-pour'
        );

        expect(button.classList.contains('taxonomy-detail-edit-button')).toBe(true);
        expect(button.getAttribute('aria-label')).toBe('Redigera {name}');
        expect(button.textContent).toContain('Redigera');
    });
});

/**
 * Enhetstester för appendix1_summary_editor_render.
 */
import { describe, test, expect } from '@jest/globals';
import { render_appendix1_summary_editor_page } from '../../js/utils/appendix1_summary_editor_render.ts';

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

describe('appendix1_summary_editor_render', () => {
    test('render_appendix1_summary_editor_page bygger samma DOM-struktur som granskning', () => {
        const container = document.createElement('div');
        const host = {
            is_editing: false,
            working_text: 'Test **markdown**',
            textarea_ref: null,
            preview_container_ref: null,
        };

        render_appendix1_summary_editor_page(
            {
                Helpers: create_helpers(),
                Translation: {
                    t: (key: string) => key,
                },
            },
            container,
            {
                heading_id: 'test-heading',
                heading_key: 'test_heading',
                intro_key: 'test_intro',
                label_key: 'test_label',
                textarea_id: 'test-textarea',
                initial_text: 'Test **markdown**',
                readonly: true,
                summary_host: host,
                on_save: () => {},
            }
        );

        expect(container.querySelector('.audit-settings__page-header-row h1')).toBeTruthy();
        expect(container.querySelector('.view-intro-text')).toBeTruthy();
        expect(container.querySelector('.audit-settings__section-divider')).toBeTruthy();
        expect(container.querySelector('.markdown-preview-editor.audit-settings__summary-section')).toBeTruthy();
        expect(container.querySelector('.markdown-preview-editor__preview')).toBeTruthy();
    });

    test('page_header_action placeras i sidhuvudsraden', () => {
        const container = document.createElement('div');
        const action = document.createElement('button');
        action.className = 'rulefile-sections-edit-button';
        action.textContent = 'Redigera';
        const host = {
            is_editing: false,
            working_text: '',
            textarea_ref: null,
            preview_container_ref: null,
        };

        render_appendix1_summary_editor_page(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            {
                heading_id: 'test-heading',
                heading_key: 'test_heading',
                intro_key: 'test_intro',
                label_key: 'test_label',
                textarea_id: 'test-textarea',
                initial_text: '',
                readonly: true,
                page_header_action: action,
                summary_host: host,
                on_save: () => {},
            }
        );

        const header_row = container.querySelector('.audit-settings__page-header-row');
        expect(header_row?.querySelector('h1 + .rulefile-sections-edit-button')).toBe(action);
    });
});

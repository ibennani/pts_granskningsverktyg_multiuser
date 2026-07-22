/**
 * Enhetstester för aria-label på markdown-redigeringsknappen.
 */
import { describe, test, expect } from '@jest/globals';
import { build_markdown_preview_editor_ui } from '../../js/utils/markdown_preview_editor_ui.ts';

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
    };
}

describe('markdown_preview_editor_ui aria-label', () => {
    test('Redigera-knapp har aria-label med rubrik', () => {
        const host = {
            is_editing: false,
            working_text: 'Text',
            textarea_ref: null,
            preview_container_ref: null,
        };
        const section = build_markdown_preview_editor_ui(
            {
                Helpers: create_helpers(),
                Translation: {
                    t: (key: string, opts?: Record<string, string>) => {
                        if (key === 'markdown_preview_editor_edit_button_aria') {
                            return `Redigera ${opts?.heading}`;
                        }
                        return key;
                    },
                },
            },
            host,
            {
                heading_id: 'test-heading',
                heading_text: 'Inledning',
                label_key: 'test_label',
                textarea_id: 'test-textarea',
                initial_text: 'Text',
            }
        );

        const edit_button = section.querySelector('.markdown-preview-editor__edit-btn') as HTMLButtonElement;
        expect(edit_button.getAttribute('aria-label')).toBe('Redigera Inledning');
    });
});

/**
 * Enhetstester för aria-label på rapportmallens ikonknappar.
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { create_report_template_section } from '../../js/components/rulefile_metadata/rulefile_metadata_report_template.js';

function create_helpers() {
    return {
        create_element: (tag, opts = {}) => {
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
            const attrs = opts.attributes;
            if (attrs) {
                for (const [key, value] of Object.entries(attrs)) {
                    el.setAttribute(key, value);
                }
            }
            return el;
        },
        get_icon_svg: () => '<svg></svg>',
        generate_uuid_v4: () => 'test-uuid-12345678',
        init_auto_resize_for_textarea: () => undefined,
    };
}

describe('rulefile_metadata_report_template aria-label', () => {
    let host;

    beforeEach(() => {
        host = {};
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('ikonknappar får aria-label med sektionsnamn', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: {
                t: (key, opts = {}) => {
                    if (key === 'rulefile_metadata_report_section_move_up_aria') {
                        return `Flytta upp sektion ${opts.name}`;
                    }
                    if (key === 'rulefile_metadata_report_section_move_down_aria') {
                        return `Flytta ner sektion ${opts.name}`;
                    }
                    if (key === 'rulefile_metadata_report_section_delete_aria') {
                        return `Ta bort sektion ${opts.name}`;
                    }
                    if (key === 'report_section_name_placeholder') {
                        return 'Sektionsnamn';
                    }
                    return key;
                },
            },
        };

        const report_template = {
            sections: {
                intro: { name: 'Inledning', required: true, content: '' },
                body: { name: 'Brödtext', required: false, content: '' },
            },
        };
        const metadata = {
            blockOrders: {
                reportSections: ['intro', 'body'],
            },
        };

        const section = create_report_template_section(ctx, report_template, metadata, host);
        document.body.appendChild(section);

        const cards = section.querySelectorAll('.report-section-card');
        const intro_card = cards[0];
        const body_card = cards[1];
        const intro_move_down = intro_card.querySelector('[data-action="move-section-down"]');
        const body_move_up = body_card.querySelector('[data-action="move-section-up"]');
        const body_delete = body_card.querySelector('[data-action="delete-section"]');

        expect(intro_move_down?.getAttribute('aria-label')).toBe('Flytta ner sektion Inledning');
        expect(body_move_up?.getAttribute('aria-label')).toBe('Flytta upp sektion Brödtext');
        expect(body_delete?.getAttribute('aria-label')).toBe('Ta bort sektion Brödtext');
    });
});

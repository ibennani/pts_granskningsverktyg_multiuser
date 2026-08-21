/**
 * Enhetstester för delad Bilaga 1-bristtypslista.
 */
import { describe, test, expect } from '@jest/globals';
import {
    append_deficiency_types_list_dom,
    build_deficiency_list_html,
} from '../../js/utils/appendix1_deficiency_list_render.ts';

function create_helpers() {
    return {
        create_element: (tag: string, opts: Record<string, unknown> = {}) => {
            const el = document.createElement(tag);
            const class_name = opts.class_name;
            if (typeof class_name === 'string') {
                el.className = class_name;
            }
            if (typeof opts.text_content === 'string') {
                el.textContent = opts.text_content;
            }
            return el;
        },
    };
}

describe('appendix1_deficiency_list_render', () => {
    test('build_deficiency_list_html renderar primary i strong och secondary efter', () => {
        const html = build_deficiency_list_html([
            { primary: 'Primär text', secondary: 'Sekundär text.' },
            { primary: 'Bara primär', secondary: '' },
        ]);
        expect(html).toContain('<ul>');
        expect(html).toContain('<strong>Primär text</strong> Sekundär text.');
        expect(html).toContain('<strong>Bara primär</strong>');
        expect(html).not.toContain('<strong>Bara primär</strong> ');
    });

    test('append_deficiency_types_list_dom skapar punktlista i DOM', () => {
        const parent = document.createElement('div');
        append_deficiency_types_list_dom(create_helpers(), parent, [
            { primary: 'Fet text', secondary: 'Fortsättning.' },
        ]);
        const list = parent.querySelector('.appendix1-deficiency-list ul');
        expect(list).toBeTruthy();
        const strong = parent.querySelector('li strong');
        expect(strong?.textContent).toBe('Fet text');
        expect(parent.querySelector('li')?.textContent).toBe('Fet text Fortsättning.');
    });

    test('append_deficiency_types_list_dom lämnar parent oförändrad utan typer', () => {
        const parent = document.createElement('div');
        append_deficiency_types_list_dom(create_helpers(), parent, []);
        expect(parent.innerHTML).toBe('');
    });
});

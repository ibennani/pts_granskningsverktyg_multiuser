/**
 * @file Enhetstester för metadataformulärets granskare-dropdown.
 */
import {
    build_metadata_auditor_options,
    clear_metadata_auditor_options_cache,
    metadata_form_create_auditor_name_field,
} from '../../js/logic/metadata_auditor_name_field.js';

const Helpers = {
    create_element(tag: string, opts: Record<string, unknown> = {}) {
        const el = document.createElement(tag);
        const class_name = opts.class_name as string | string[] | undefined;
        if (class_name) {
            el.className = Array.isArray(class_name) ? class_name.join(' ') : class_name;
        }
        if (typeof opts.text_content === 'string') {
            el.textContent = opts.text_content;
        }
        const attributes = opts.attributes as Record<string, string> | undefined;
        if (attributes) {
            for (const [key, value] of Object.entries(attributes)) {
                if (value !== undefined) el.setAttribute(key, value);
            }
        }
        return el;
    },
};

const Translation = {
    t(key: string) {
        return key === 'auditor_name' ? 'Ansvarig granskare' : key;
    },
};

describe('metadata auditor name field', () => {
    beforeEach(() => {
        clear_metadata_auditor_options_cache();
    });

    test('build_metadata_auditor_options sorterar på namn och använder id som värde', () => {
        const options = build_metadata_auditor_options([
            { id: 'id-z', name: 'Zara Zetterlund' },
            { id: 'id-a', name: 'Anna Andersson' },
        ]);
        expect(options).toEqual([
            { value: 'id-a', label: 'Anna Andersson' },
            { value: 'id-z', label: 'Zara Zetterlund' },
        ]);
    });

    test('metadata_form_create_auditor_name_field väljer initialt användar-id', () => {
        const options = build_metadata_auditor_options([
            { id: 'user-1', name: 'Anna Andersson' },
        ]);
        const field = metadata_form_create_auditor_name_field(
            Helpers,
            Translation,
            options,
            'user-1',
            ''
        );
        expect(field.select_element.value).toBe('user-1');
        expect(field.get_selected_auditor_user_id()).toBe('user-1');
        expect(field.get_selected_auditor_name()).toBe('Anna Andersson');
    });

    test('fallback till namn när id saknas', () => {
        const options = build_metadata_auditor_options([
            { id: 'user-2', name: 'Bob Bobsson' },
        ]);
        const field = metadata_form_create_auditor_name_field(
            Helpers,
            Translation,
            options,
            '',
            'Bob Bobsson'
        );
        expect(field.select_element.value).toBe('user-2');
    });
});

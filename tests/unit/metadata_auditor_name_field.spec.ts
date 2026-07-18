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

    test('build_metadata_auditor_options sorterar och inkluderar aktuell användare', () => {
        const options = build_metadata_auditor_options(
            [{ name: 'Zara Zetterlund' }, { name: 'Anna Andersson' }],
            'Bob Bobsson'
        );
        expect(options.map((row) => row.value)).toEqual([
            'Anna Andersson',
            'Bob Bobsson',
            'Zara Zetterlund',
        ]);
    });

    test('metadata_form_create_auditor_name_field väljer initialt värde', () => {
        const options = build_metadata_auditor_options([{ name: 'Anna Andersson' }], 'Anna Andersson');
        const field = metadata_form_create_auditor_name_field(
            Helpers,
            Translation,
            options,
            'Anna Andersson'
        );
        expect(field.select_element.value).toBe('Anna Andersson');
        expect(field.get_selected_auditor_name()).toBe('Anna Andersson');
    });
});

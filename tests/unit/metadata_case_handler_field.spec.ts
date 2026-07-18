/**

 * @file Enhetstester för metadataformulärets handläggare-dropdown.

 */

import {

    METADATA_CASE_HANDLER_ADD_NEW_VALUE,

    build_metadata_case_handler_options,

    clear_metadata_case_handler_options_cache,

    metadata_form_create_case_handler_field,

} from '../../js/logic/metadata_case_handler_field.js';



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

        const labels: Record<string, string> = {

            case_handler: 'Handläggare',

            metadata_case_handler_select_prompt: 'Välj handläggare',

            metadata_case_handler_add_option: 'Lägg till handläggare',

            metadata_case_handler_new_name_label: 'Vad heter den nya handläggaren',

        };

        return labels[key] ?? key;

    },

};



describe('metadata case handler field', () => {

    beforeEach(() => {

        clear_metadata_case_handler_options_cache();

    });



    test('build_metadata_case_handler_options deduplicerar och sorterar', () => {

        const options = build_metadata_case_handler_options(

            [

                { metadata: { caseHandler: 'Zara Zetterlund' } },

                { metadata: { caseHandler: 'Anna Andersson' } },

                { metadata: { caseHandler: 'Anna Andersson' } },

            ],

            'Bob Bobsson'

        );

        expect(options.map((row) => row.value)).toEqual([

            'Anna Andersson',

            'Bob Bobsson',

            'Zara Zetterlund',

        ]);

    });



    test('metadata_form_create_case_handler_field visar prompt vid tomt värde', () => {
        const options = build_metadata_case_handler_options(
            [{ metadata: { caseHandler: 'Anna Andersson' } }],
            ''
        );
        const field = metadata_form_create_case_handler_field(
            Helpers,
            Translation,
            options,
            ''
        );
        expect(field.select_element.value).toBe('');
        expect(field.select_element.options[0].textContent).toBe('Välj handläggare');
        expect(field.get_selected_case_handler()).toBe('');
    });

    test('metadata_form_create_case_handler_field väljer befintligt värde', () => {

        const options = build_metadata_case_handler_options(

            [{ metadata: { caseHandler: 'Anna Andersson' } }],

            'Anna Andersson'

        );

        const field = metadata_form_create_case_handler_field(

            Helpers,

            Translation,

            options,

            'Anna Andersson'

        );

        expect(field.select_element.value).toBe('Anna Andersson');

        expect(field.get_selected_case_handler()).toBe('Anna Andersson');

        expect(field.new_name_input?.closest('[hidden]')).not.toBeNull();

    });



    test('metadata_form_create_case_handler_field visar nytt namn vid okänt värde', () => {

        const options = build_metadata_case_handler_options(

            [{ metadata: { caseHandler: 'Anna Andersson' } }],

            ''

        );

        const field = metadata_form_create_case_handler_field(

            Helpers,

            Translation,

            options,

            'Ny Handläggare'

        );

        expect(field.select_element.value).toBe(METADATA_CASE_HANDLER_ADD_NEW_VALUE);

        expect(field.new_name_input?.value).toBe('Ny Handläggare');

        expect(field.get_selected_case_handler()).toBe('Ny Handläggare');

        expect(field.new_name_input?.closest('[hidden]')).toBeNull();

    });

});



/**

 * @fileoverview Tester för metadata_monitoring_type_field.

 */

import { describe, expect, test } from '@jest/globals';

import { metadata_form_create_monitoring_type_field } from '../../js/logic/metadata_monitoring_type_field.ts';
import {
    metadata_form_create_monitoring_type_readonly_field,
    resolve_monitoring_type_display_label,
    resolve_monitoring_type_label,
} from '../../js/logic/metadata_monitoring_type_field.ts';



const Helpers = {

    create_element(

        tag: string,

        opts: {

            class_name?: string | string[];

            text_content?: string;

            attributes?: Record<string, string>;

        } = {}

    ) {

        const el = document.createElement(tag);

        if (opts.class_name) {

            const classes = Array.isArray(opts.class_name) ? opts.class_name : [opts.class_name];

            el.className = classes.join(' ');

        }

        if (opts.text_content) {

            el.textContent = opts.text_content;

        }

        if (opts.attributes) {

            for (const [key, value] of Object.entries(opts.attributes)) {

                el.setAttribute(key, value);

            }

        }

        return el;

    },

};



const Translation = {

    t: (key: string) => {

        if (key === 'metadata_monitoring_type_select_prompt') {

            return 'Välj vad som ska granskas';

        }

        if (key === 'rulefile_metadata_field_monitoring_type_label') {

            return 'Vad ska granskas?';

        }

        return key;

    },

};



describe('metadata_form_create_monitoring_type_field', () => {

    test('behåller tom placeholder när endast ett alternativ och include_empty_placeholder', () => {

        const options = [{ key: 'webb', label: 'Webb', rule_id: '1' }];

        const field = metadata_form_create_monitoring_type_field(

            Helpers,

            Translation,

            options,

            '',

            undefined,

            { include_empty_placeholder: true }

        );

        expect(field).not.toBeNull();

        expect(field!.select_element.value).toBe('');

        expect(field!.select_element.options[0].textContent).toBe('Välj vad som ska granskas');

    });



    test('väljer enda alternativet utan placeholder-läge', () => {

        const options = [{ key: 'webb', label: 'Webb', rule_id: '1' }];

        const field = metadata_form_create_monitoring_type_field(

            Helpers,

            Translation,

            options,

            '',

            undefined,

            { include_empty_placeholder: false }

        );

        expect(field!.select_element.value).toBe('webb');

    });

    test('behåller tom placeholder med två alternativ', () => {

        const options = [

            { key: 'Webbplats', rule_id: 'web-id', label: 'Webb' },

            { key: 'PDF-dokument', rule_id: 'pdf-id', label: 'PDF' },

        ];

        const field = metadata_form_create_monitoring_type_field(

            Helpers,

            Translation,

            options,

            '',

            undefined,

            { include_empty_placeholder: true }

        );

        expect(field!.select_element.value).toBe('');

        expect(field!.select_element.options[0].textContent).toBe('Välj vad som ska granskas');

    });

    test('väljer angivet alternativ med placeholder-läge när nyckel är giltig', () => {
        const options = [
            { key: 'Webbplats', rule_id: 'web-id', label: 'Webb' },
            { key: 'PDF-dokument', rule_id: 'pdf-id', label: 'PDF' },
        ];
        const field = metadata_form_create_monitoring_type_field(
            Helpers,
            Translation,
            options,
            'PDF-dokument',
            undefined,
            { include_empty_placeholder: true }
        );
        expect(field!.select_element.value).toBe('PDF-dokument');
    });

    test('resolve_monitoring_type_label läser text från regelfil', () => {
        expect(
            resolve_monitoring_type_label({
                metadata: { monitoringType: { text: 'Webb' } },
            })
        ).toBe('Webb');
        expect(resolve_monitoring_type_label({ metadata: {} })).toBe('');
    });

    test('resolve_monitoring_type_display_label faller tillbaka till valt alternativ', () => {
        expect(
            resolve_monitoring_type_display_label(
                { metadata: {} },
                [{ key: 'web-a', label: 'Webbplats', rule_id: 'r1' }],
                'web-a'
            )
        ).toBe('Webbplats');
    });

    test('readonly-fält renderar etikett och text utan inmatningsruta', () => {
        const form_group = metadata_form_create_monitoring_type_readonly_field(
            Helpers,
            Translation,
            'PDF'
        );
        expect(form_group.querySelector('select')).toBeNull();
        expect(form_group.querySelector('label')?.textContent).toBe('Vad ska granskas?');
        expect(form_group.querySelector('p')?.textContent).toBe('PDF');
        expect(form_group.querySelector('p')?.classList.contains('metadata-field-value')).toBe(true);
        expect(form_group.querySelector('p')?.classList.contains('form-control')).toBe(false);
    });

});


/**
 * @file Enhetstester för metadataformulärets granskningstyp-fält.
 */
import {
    metadata_form_audit_type_rule_content,
    metadata_form_create_audit_type_field,
} from '../../js/logic/metadata_audit_type_field.js';
import { DEFAULT_AUDIT_TYPES } from '../../shared/rulefile/rulefile_audit_types.js';

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
        const map: Record<string, string> = {
            metadata_audit_type_question_label: 'Vilken typ av granskning är detta?',
            metadata_audit_type_select_prompt: 'Välj typ',
        };
        return map[key] ?? key;
    },
};

const RULE_WITH_TYPES = {
    metadata: {
        auditTypes: DEFAULT_AUDIT_TYPES.map((row) => ({ ...row })),
    },
};

describe('metadata_form_audit_type_rule_content', () => {
    test('tom metadata för ny granskning innan Webb/PDF valts', () => {
        expect(
            metadata_form_audit_type_rule_content(RULE_WITH_TYPES, false, 'not_started')
        ).toEqual({ metadata: {} });
    });

    test('effektiv regelfil för pågående granskning utan monitoringTypeConfirmed', () => {
        expect(
            metadata_form_audit_type_rule_content(RULE_WITH_TYPES, false, 'in_progress')
        ).toBe(RULE_WITH_TYPES);
    });
});

describe('metadata_form_create_audit_type_field', () => {
    test('visar alltid fältet med platshållare när inga typer finns', () => {
        const field = metadata_form_create_audit_type_field(
            Helpers,
            Translation,
            { metadata: {} },
            'not_started',
            ''
        );
        expect(field.select_element).not.toBeNull();
        expect(field.form_group.querySelector('label')?.textContent).toBe(
            'Vilken typ av granskning är detta?'
        );
        expect(field.select_element?.options).toHaveLength(1);
        expect(field.select_element?.options[0].textContent).toBe('Välj typ');
        expect(field.validate_selection()).toBe(true);
    });

    test('kräver val när flera typer finns', () => {
        const field = metadata_form_create_audit_type_field(
            Helpers,
            Translation,
            RULE_WITH_TYPES,
            'not_started',
            ''
        );
        expect(field.select_element?.options.length).toBeGreaterThan(1);
        expect(field.validate_selection()).toBe(false);
        field.select_element!.value = 'tillsyn-lptt';
        expect(field.validate_selection()).toBe(true);
    });

    test('kräver val när endast en typ finns', () => {
        const field = metadata_form_create_audit_type_field(
            Helpers,
            Translation,
            {
                metadata: {
                    auditTypes: [{ id: 'tillsyn', label: 'Tillsyn', taxonomyId: 'tax-a' }],
                },
            },
            'not_started',
            ''
        );
        expect(field.select_element?.options[0].textContent).toBe('Välj typ');
        expect(field.select_element?.options[0].selected).toBe(true);
        expect(field.get_selected_audit_type_id()).toBe('');
        expect(field.validate_selection()).toBe(false);
        field.select_element!.value = 'tillsyn';
        expect(field.validate_selection()).toBe(true);
    });

    test('visar skrivskyddad text när granskningstyp redan är vald', () => {
        const field = metadata_form_create_audit_type_field(
            Helpers,
            Translation,
            RULE_WITH_TYPES,
            'in_progress',
            'tillsyn-lptt',
            'Tillsyn, LPTT'
        );
        expect(field.select_element).toBeNull();
        expect(field.form_group.querySelector('p')?.textContent).toBe('Tillsyn, LPTT');
        expect(field.form_group.querySelector('p')?.classList.contains('metadata-field-value')).toBe(true);
        expect(field.form_group.querySelector('p')?.classList.contains('form-control')).toBe(false);
    });

    test('visar dropdown under pågående granskning om typ saknas', () => {
        const field = metadata_form_create_audit_type_field(
            Helpers,
            Translation,
            RULE_WITH_TYPES,
            'in_progress',
            ''
        );
        expect(field.select_element).not.toBeNull();
        expect(field.validate_selection()).toBe(false);
        field.select_element!.value = 'marknadskontroll-lptt';
        expect(field.validate_selection()).toBe(true);
    });
});

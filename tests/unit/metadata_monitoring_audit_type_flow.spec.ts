/**
 * @file Enhetstester för Webb/PDF-val och granskningstyp i metadataformuläret.
 */
import { describe, expect, test } from '@jest/globals';
import {
    metadata_form_audit_type_rule_content,
    metadata_form_create_audit_type_field,
} from '../../js/logic/metadata_audit_type_field.js';
import { metadata_form_create_monitoring_type_field } from '../../js/logic/metadata_monitoring_type_field.js';
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
            metadata_monitoring_type_select_prompt: 'Välj vad som ska granskas',
            rulefile_metadata_field_monitoring_type_label: 'Vad ska granskas?',
            audit_type_filter_webb: 'Webb',
            audit_type_filter_pdf: 'PDF',
        };
        return map[key] ?? key;
    },
};

const WEBB_RULE = {
    metadata: {
        auditTypes: DEFAULT_AUDIT_TYPES.map((row) => ({ ...row })),
    },
};

describe('metadata monitoring and audit type flow', () => {
    test('metadata_form_audit_type_rule_content döljer typer tills Webb/PDF valts', () => {
        expect(
            metadata_form_create_audit_type_field(
                Helpers,
                Translation,
                metadata_form_audit_type_rule_content(WEBB_RULE, false),
                'not_started',
                ''
            ).select_element?.options
        ).toHaveLength(1);
        expect(
            metadata_form_create_audit_type_field(
                Helpers,
                Translation,
                metadata_form_audit_type_rule_content(WEBB_RULE, true),
                'not_started',
                ''
            ).select_element?.options.length
        ).toBeGreaterThan(1);
    });

    test('monitoring-fält kan visa platshållare innan val', () => {
        const field = metadata_form_create_monitoring_type_field(
            Helpers,
            Translation,
            [
                { key: 'Webbplats', rule_id: 'web-id', label: 'Webb' },
                { key: 'PDF-dokument', rule_id: 'pdf-id', label: 'PDF' },
            ],
            '',
            undefined,
            { include_empty_placeholder: true }
        );
        expect(field?.select_element.options[0].value).toBe('');
        expect(field?.select_element.options[0].textContent).toBe('Välj vad som ska granskas');
    });

    test('granskningstyp-fält listar typer från vald regelfil', () => {
        const field = metadata_form_create_audit_type_field(
            Helpers,
            Translation,
            WEBB_RULE,
            'not_started',
            ''
        );
        const labels = Array.from(field.select_element?.options ?? []).map((opt) => opt.textContent);
        expect(labels).toContain('Välj typ');
        expect(labels).toContain('Tillsyn, LPTT');
        expect(labels).toContain('Marknadskontroll LPTT');
        field.select_element!.value = 'tillsyn-lptt';
        expect(field.validate_selection()).toBe(true);
    });
});

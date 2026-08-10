/**
 * @file Enhetstester för uppdatering av metadataformuläret vid val av Webb/PDF.
 */
import { describe, expect, test, beforeEach } from '@jest/globals';
import { MetadataFormComponent } from '../../js/components/MetadataFormComponent.js';
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
            case_number: 'Ärendenummer',
            actor_name: 'Aktör',
            actor_link: 'Länk',
            internal_comment: 'Kommentar',
            metadata_form_submit: 'Spara',
        };
        return map[key] ?? key;
    },
};

const WEBB_RULE = {
    metadata: {
        monitoringType: { text: 'Webb' },
        auditTypes: DEFAULT_AUDIT_TYPES.map((row) => ({ ...row })),
    },
};

describe('MetadataFormComponent refresh_rule_dependent_fields', () => {
    let root: HTMLDivElement;

    beforeEach(() => {
        root = document.createElement('div');
        document.body.appendChild(root);
        MetadataFormComponent.init({
            root,
            deps: {
                Translation,
                Helpers,
                NotificationComponent: null,
                AutosaveService: null,
                getState: () => ({}),
                dispatch: () => {},
                StoreActionTypes: {},
            },
        });
        MetadataFormComponent.render({
            initialData: {},
            hide_form_actions: true,
            showMonitoringTypeSelection: true,
            monitoringTypeOptions: [
                { key: 'Webbplats', rule_id: 'web-id', label: 'Webb' },
                { key: 'PDF-dokument', rule_id: 'pdf-id', label: 'PDF' },
            ],
            ruleFileContent: null,
            auditStatus: 'not_started',
            auditorNameOptions: [],
            caseHandlerOptions: [],
        });
    });

    test('visar platshållare i monitoring-dropdown vid första render', () => {
        const select = root.querySelector('#monitoringTypeKey') as HTMLSelectElement | null;
        expect(select).not.toBeNull();
        expect(select?.value).toBe('');
        expect(select?.options[0].textContent).toBe('Välj vad som ska granskas');
    });

    test('behåller granskningstyp direkt efter monitoring-fält vid regeluppdatering', () => {
        const form = root.querySelector('form');
        expect(form?.querySelector('#monitoringTypeKey')).not.toBeNull();
        expect(form?.querySelector('#auditTypeId')).not.toBeNull();

        MetadataFormComponent.refresh_rule_dependent_fields(WEBB_RULE, '', true);

        const monitoring_group = form?.querySelector('#monitoringTypeKey')?.closest('.form-group');
        const audit_type_group = form?.querySelector('#auditTypeId')?.closest('.form-group');
        const case_group = form?.querySelector('label[for="caseNumber"]')?.closest('.form-group');

        expect(audit_type_group).not.toBeNull();
        expect(monitoring_group).not.toBeNull();
        expect(case_group).not.toBeNull();
        expect(monitoring_group?.nextElementSibling).toBe(audit_type_group);
        expect(audit_type_group?.nextElementSibling).toBe(case_group);
        expect(form?.querySelector('#auditTypeId option[value="tillsyn-lptt"]')).not.toBeNull();
    });
});

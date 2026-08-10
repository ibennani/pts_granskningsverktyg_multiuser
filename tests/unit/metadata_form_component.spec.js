/**
 * @file Enhetstester för MetadataFormComponent DOM-ordning.
 */
import { describe, expect, test, beforeEach } from '@jest/globals';
import { MetadataFormComponent } from '../../js/components/MetadataFormComponent.js';
import { DEFAULT_AUDIT_TYPES } from '../../shared/rulefile/rulefile_audit_types.js';

const Helpers = {
    create_element(tag, opts = {}) {
        const el = document.createElement(tag);
        const class_name = opts.class_name;
        if (class_name) {
            el.className = Array.isArray(class_name) ? class_name.join(' ') : class_name;
        }
        if (typeof opts.text_content === 'string') {
            el.textContent = opts.text_content;
        }
        if (typeof opts.html_content === 'string') {
            el.innerHTML = opts.html_content;
        }
        const attributes = opts.attributes;
        if (attributes) {
            for (const [key, value] of Object.entries(attributes)) {
                if (value !== undefined) {
                    el.setAttribute(key, value);
                }
            }
        }
        return el;
    },
    build_save_button_html_content(text) {
        return text;
    },
};

const Translation = {
    t(key) {
        const map = {
            case_number: 'Ärendenummer',
            actor_name: 'Aktör',
            actor_link: 'Länk',
            internal_comment: 'Intern kommentar',
            metadata_form_submit: 'Spara',
            metadata_audit_type_question_label: 'Vilken typ av granskning är detta?',
            metadata_audit_type_select_prompt: 'Välj typ',
            metadata_monitoring_type_select_prompt: 'Välj vad som ska granskas',
            rulefile_metadata_field_monitoring_type_label: 'Vad ska granskas?',
        };
        return map[key] ?? key;
    },
};

const WEBB_RULE = {
    metadata: {
        auditTypes: DEFAULT_AUDIT_TYPES.map((row) => ({ ...row })),
        monitoringType: { text: 'Webb' },
    },
};

const MONITORING_OPTIONS = [
    { key: 'Webbplats', rule_id: 'web-id', label: 'Webb' },
    { key: 'PDF-dokument', rule_id: 'pdf-id', label: 'PDF' },
];

function create_form_instance() {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const instance = Object.create(MetadataFormComponent);
    instance.init({
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
        options: {},
    });
    return { instance, root };
}

function get_form_group_labels(form) {
    return Array.from(form.querySelectorAll('.form-group > label')).map((label) => label.textContent);
}

function get_form_child_index(form, element) {
    return Array.from(form.children).indexOf(element);
}

describe('MetadataFormComponent audit type field order', () => {
    let instance;
    let root;

    beforeEach(() => {
        document.body.innerHTML = '';
        ({ instance, root } = create_form_instance());
    });

    test('render visar platshållare vid ny granskning även med sparad regelfil i state', () => {
        instance.render({
            ruleFileContent: WEBB_RULE,
            showMonitoringTypeSelection: true,
            monitoringTypeOptions: MONITORING_OPTIONS,
            selectedMonitoringKey: 'Webbplats',
            monitoringTypeConfirmed: false,
            auditStatus: 'not_started',
        });

        const select = root.querySelector('#monitoringTypeKey');
        expect(select).not.toBeNull();
        expect(select.value).toBe('');
        expect(select.options[0].value).toBe('');
        expect(select.options[0].textContent).toBe('Välj vad som ska granskas');
    });

    test('upprepad render utan bekräftelse visar platshållare trots regelfil i state', () => {
        const render_options = {
            ruleFileContent: WEBB_RULE,
            showMonitoringTypeSelection: true,
            monitoringTypeOptions: MONITORING_OPTIONS,
            selectedMonitoringKey: 'PDF-dokument',
            monitoringTypeConfirmed: false,
            auditStatus: 'not_started',
        };
        instance.render(render_options);
        instance.render(render_options);

        const select = root.querySelector('#monitoringTypeKey');
        expect(select?.value).toBe('');
        expect(select?.options[0].textContent).toBe('Välj vad som ska granskas');
    });

    test('render visar valt alternativ när monitoring bekräftats av användaren', () => {
        instance.render({
            ruleFileContent: WEBB_RULE,
            showMonitoringTypeSelection: true,
            monitoringTypeOptions: MONITORING_OPTIONS,
            selectedMonitoringKey: 'Webbplats',
            monitoringTypeConfirmed: true,
            auditStatus: 'not_started',
        });

        const select = root.querySelector('#monitoringTypeKey');
        expect(select?.value).toBe('Webbplats');
    });

    test('render placerar granskningstyp direkt efter vad-som-ska-granskas när val bekräftats', () => {
        instance.render({
            ruleFileContent: WEBB_RULE,
            showMonitoringTypeSelection: false,
            monitoringTypeOptions: MONITORING_OPTIONS,
            selectedMonitoringKey: 'Webbplats',
            monitoringTypeConfirmed: true,
        });

        const form = root.querySelector('form');
        const labels = get_form_group_labels(form);
        const monitoring_index = labels.indexOf('Vad ska granskas?');
        const audit_type_index = labels.indexOf('Vilken typ av granskning är detta?');

        expect(monitoring_index).toBeGreaterThanOrEqual(0);
        expect(audit_type_index).toBe(monitoring_index + 1);
    });

    test('refresh_rule_dependent_fields behåller granskningstyp efter vad-som-ska-granskas', () => {
        instance.render({
            ruleFileContent: WEBB_RULE,
            showMonitoringTypeSelection: true,
            monitoringTypeOptions: MONITORING_OPTIONS,
            selectedMonitoringKey: '',
            monitoringTypeConfirmed: false,
        });

        const form = root.querySelector('form');
        const actions = form.querySelector('.form-actions');
        expect(actions).not.toBeNull();

        instance.refresh_monitoring_type_field(WEBB_RULE, true, 'Webbplats', MONITORING_OPTIONS);
        instance.refresh_rule_dependent_fields(WEBB_RULE, '', true);

        const monitoring_group = instance.monitoring_type_field_handles?.form_group;
        const audit_type_group = instance.audit_type_field_handles?.form_group;

        expect(monitoring_group).not.toBeNull();
        expect(audit_type_group).not.toBeNull();
        expect(get_form_child_index(form, monitoring_group)).toBeLessThan(
            get_form_child_index(form, audit_type_group)
        );
        expect(get_form_child_index(form, audit_type_group)).toBeLessThan(
            get_form_child_index(form, actions)
        );

        const labels = get_form_group_labels(form);
        expect(labels.indexOf('Vilken typ av granskning är detta?')).toBe(
            labels.indexOf('Vad ska granskas?') + 1
        );
    });
});

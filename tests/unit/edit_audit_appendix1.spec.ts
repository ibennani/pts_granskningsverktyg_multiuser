/**
 * Enhetstester för Bilaga 1-redigering i granskning (auditMetadata-överstyrningar).
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import { get_default_appendix1_body_text } from '../../js/logic/appendix1_sections.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server_sync_path = path.join(__dirname, '../../js/logic/server_sync.js');

const sync_mock = jest.fn<() => Promise<void>>();

jest.unstable_mockModule(server_sync_path, () => ({
    sync_to_server_now: sync_mock,
}));

const { render_appendix1_sections_editor } = await import(
    '../../js/components/rulefile_sections/rulefile_appendix1_sections_editor_ui.ts'
);
const { EditAuditAppendix1Component } = await import(
    '../../js/components/audit_actions/EditAuditAppendix1Component.ts'
);

function create_helpers() {
    return {
        create_element: (tag: string, opts: Record<string, unknown> = {}) => {
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
            const attrs = opts.attributes as Record<string, string> | undefined;
            if (attrs) {
                for (const [key, value] of Object.entries(attrs)) {
                    el.setAttribute(key, value);
                }
            }
            return el;
        },
        init_auto_resize_for_textarea: () => {},
        get_icon_svg: () => '',
    };
}

const sample_rule_file = {
    appendix1: {
        groupingTaxonomyId: 'wcag22-pour',
        bodyText: get_default_appendix1_body_text(),
    },
    metadata: {
        auditTypes: [
            {
                id: 'tillsyn-fptt',
                label: 'Tillsyn FPTT',
                taxonomyId: 'fptt-bilaga-2',
            },
        ],
        taxonomies: [
            {
                id: 'wcag22-pour',
                label: 'WCAG 2.2 POUR',
                concepts: [
                    { id: 'perceivable', label: 'Uppfattningsbar' },
                    { id: 'operable', label: 'Hanterbar' },
                ],
            },
            {
                id: 'fptt-bilaga-2',
                label: 'FPTT, bilaga 2',
                concepts: [{ id: 'a', label: 'Uppfattningsbar' }],
            },
        ],
    },
};

describe('render_appendix1_sections_editor audit scope', () => {
    test('visar bara kapitel 3.x för granskningens taxonomi', () => {
        const container = document.createElement('div');

        const handles = render_appendix1_sections_editor(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            sample_rule_file,
            {
                scope: 'audit',
                grouping_taxonomy_id: 'fptt-bilaga-2',
                deficiency_intros_hint_key: 'audit_appendix1_deficiency_intros_hint',
                initial_body_text_by_taxonomy: { 'fptt-bilaga-2': '# FPTT' },
                initial_concept_intros: { a: 'FPTT-inledning' },
            }
        );

        expect(container.querySelector('.appendix1-grouping-taxonomy-field')).toBeNull();
        expect(handles.get_grouping_taxonomy_id()).toBe('fptt-bilaga-2');
        expect(handles.get_sections()).toHaveLength(1);
        expect(handles.get_sections()[0]?.conceptId).toBe('a');
        expect(container.querySelectorAll('.appendix1-deficiency-intro-field')).toHaveLength(1);
        const panel = container.querySelector('.appendix1-deficiency-intros-panel');
        const list = container.querySelector('.appendix1-deficiency-intros-list');
        expect(panel?.contains(list as Node)).toBe(false);
        expect(
            container.querySelector('.appendix1-deficiency-intros-panel__hint')?.textContent
        ).toBe('audit_appendix1_deficiency_intros_hint');
        expect(handles.get_concept_intros()).toEqual({ a: 'FPTT-inledning' });
    });

    test('låser taxonomi även om regelfilens standard skiljer sig', () => {
        const container = document.createElement('div');

        const handles = render_appendix1_sections_editor(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            sample_rule_file,
            {
                scope: 'audit',
                grouping_taxonomy_id: 'fptt-bilaga-2',
                initial_body_text_by_taxonomy: { 'fptt-bilaga-2': '' },
            }
        );

        expect(handles.get_sections().map((section) => section.conceptId)).toEqual(['a']);
        expect(container.querySelectorAll('.appendix1-deficiency-intro-field')).toHaveLength(1);
    });
});

describe('EditAuditAppendix1Component', () => {
    beforeEach(() => {
        sync_mock.mockReset();
        sync_mock.mockResolvedValue(undefined);
    });

    test('sparar inledningar för granskningens taxonomi i auditMetadata', async () => {
        const dispatch_payloads: Record<string, unknown>[] = [];
        const comp = new EditAuditAppendix1Component();
        const root = document.createElement('div');

        await comp.init({
            root,
            deps: {
                router: () => {},
                getState: () => ({
                    ruleFileContent: sample_rule_file,
                    auditMetadata: {
                        auditTypeId: 'tillsyn-fptt',
                        appendix1PrincipleIntroOverrides: {},
                    },
                }),
                dispatch: async (action: { payload?: Record<string, unknown> }) => {
                    if (action.payload) dispatch_payloads.push(action.payload);
                },
                StoreActionTypes: { UPDATE_METADATA: 'UPDATE_METADATA' },
                Translation: { t: (key: string) => key },
                Helpers: create_helpers(),
                NotificationComponent: { show_global_message: () => {} },
            },
        });

        comp.render();

        const intro_textarea = root.querySelector(
            '.appendix1-deficiency-intro-textarea'
        ) as HTMLTextAreaElement | null;
        expect(intro_textarea).toBeTruthy();
        intro_textarea!.value = 'Granskningsspecifik inledning';
        intro_textarea!.dispatchEvent(new Event('input', { bubbles: true }));

        const save_btn = root.querySelector(
            '.form-actions button.button-primary'
        ) as HTMLButtonElement | null;
        save_btn?.click();

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(dispatch_payloads).toHaveLength(1);
        expect(dispatch_payloads[0]?.appendix1PrincipleIntroOverrides).toEqual({
            a: 'Granskningsspecifik inledning',
        });
        expect(dispatch_payloads[0]?.appendix1Override).toMatchObject({
            bodyTextByTaxonomy: { 'fptt-bilaga-2': expect.any(String) },
        });
        expect(dispatch_payloads[0]?.appendix1Override).not.toHaveProperty('sections');
    });
});

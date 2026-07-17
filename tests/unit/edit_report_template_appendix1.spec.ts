/**
 * Enhetstester för Bilaga 1-redigering i regelfilens rapportmall.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server_sync_path = path.join(__dirname, '../../js/logic/server_sync.js');

const flush_mock = jest.fn<() => Promise<void>>();

jest.unstable_mockModule(server_sync_path, () => ({
    flush_rulefile_editing_sync_if_active: flush_mock,
}));

const { render_appendix1_sections_editor } = await import(
    '../../js/components/rulefile_sections/rulefile_appendix1_sections_editor_ui.ts'
);
const { EditReportTemplateAppendix1Component } = await import(
    '../../js/components/rulefile_sections/EditReportTemplateAppendix1Component.ts'
);
const { get_default_appendix1_body_text } = await import('../../js/logic/appendix1_sections.ts');

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
    };
}

const sample_rule_file = {
    appendix1: {
        groupingTaxonomyId: 'wcag22-pour',
        bodyText: get_default_appendix1_body_text(),
    },
    metadata: {
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
                id: 'custom-taxonomy',
                label: 'Anpassad taxonomi',
                concepts: [{ id: 'robust', label: 'Robust' }],
            },
            {
                id: 'fptt-bilaga-2',
                label: 'FPTT, bilaga 2',
                concepts: [{ id: 'a', label: 'Uppfattningsbar' }],
            },
        ],
    },
};

describe('rulefile_appendix1_sections_editor_ui', () => {
    test('visar bristgrupper och generera-knapp vid laddning', () => {
        const container = document.createElement('div');

        const handles = render_appendix1_sections_editor(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            sample_rule_file
        );

        const preview_items = container.querySelectorAll(
            '.appendix1-deficiency-intro-field'
        );
        expect(preview_items.length).toBe(2);
        expect(
            container.querySelector('.appendix1-generate-sections-button')
        ).toBeTruthy();

        const sections = handles.get_sections();
        expect(sections.every((section) => section.kind === 'deficiency_group')).toBe(true);
    });

    test('visar h2-avsnitt för brödtext, taxonomi och platshållare', () => {
        const container = document.createElement('div');

        render_appendix1_sections_editor(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            sample_rule_file
        );

        const headings = Array.from(
            container.querySelectorAll('.appendix1-section-panel__heading')
        ).map((heading) => heading.textContent);

        expect(headings).toContain('rulefile_appendix1_body_text_heading');
        expect(headings).toContain('rulefile_appendix1_taxonomy_groups_heading');
        expect(headings).toContain('rulefile_appendix1_deficiency_intros_heading');
        expect(headings).toContain('rulefile_appendix1_body_text_placeholders_heading');
    });

    test('visar kort rubrik och hjälptext för bristinledningar', () => {
        const container = document.createElement('div');

        render_appendix1_sections_editor(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            sample_rule_file
        );

        const heading = container.querySelector(
            '.appendix1-deficiency-intros-panel__heading'
        );
        const hint = container.querySelector(
            '.appendix1-deficiency-intros-panel__hint.field-hint'
        );

        expect(heading?.tagName).toBe('H2');
        expect(heading?.textContent).toBe('rulefile_appendix1_deficiency_intros_heading');
        expect(hint?.tagName).toBe('P');
        expect(hint?.textContent).toBe('rulefile_appendix1_deficiency_intros_hint');
        expect(
            container.querySelector('.appendix1-deficiency-intros-list')?.getAttribute('aria-labelledby')
        ).toBe(heading?.id);
    });

    test('generera-knappen anropar on_generate vid klick', () => {
        const container = document.createElement('div');
        const on_generate = jest.fn();

        render_appendix1_sections_editor(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            sample_rule_file,
            { on_generate }
        );

        const generate_btn = container.querySelector(
            '.appendix1-generate-sections-button'
        ) as HTMLButtonElement;
        generate_btn.click();

        expect(on_generate).toHaveBeenCalledTimes(1);
        expect(on_generate.mock.calls[0]?.[0]?.every((section) => section.kind === 'deficiency_group')).toBe(
            true
        );
    });

    test('uppdaterar bristgruppsförhandsvisning när taxonomi byts', () => {
        const container = document.createElement('div');

        const handles = render_appendix1_sections_editor(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            sample_rule_file
        );

        const select = container.querySelector(
            '.appendix1-grouping-taxonomy-select'
        ) as HTMLSelectElement;
        select.value = 'custom-taxonomy';
        select.dispatchEvent(new Event('change', { bubbles: true }));

        expect(handles.get_grouping_taxonomy_id()).toBe('custom-taxonomy');
        expect(handles.get_sections()).toHaveLength(1);
        expect(handles.get_sections()[0]?.conceptId).toBe('robust');

        const preview_items = container.querySelectorAll(
            '.appendix1-deficiency-intro-field'
        );
        expect(preview_items).toHaveLength(1);
    });

    test('visar tom brödtext för FPTT och behåller WCAG-text vid taxonomibyte', () => {
        const container = document.createElement('div');
        const wcag_default = get_default_appendix1_body_text();

        const handles = render_appendix1_sections_editor(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
            },
            container,
            sample_rule_file
        );

        const body_input = container.querySelector(
            '.appendix1-body-text-editor'
        ) as HTMLTextAreaElement;
        const select = container.querySelector(
            '.appendix1-grouping-taxonomy-select'
        ) as HTMLSelectElement;

        expect(body_input.value).toContain('# 1. Inledning');

        select.value = 'fptt-bilaga-2';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        expect(body_input.value).toBe('');

        body_input.value = '# FPTT\n\nEgen FPTT-text.';
        body_input.dispatchEvent(new Event('input', { bubbles: true }));

        select.value = 'wcag22-pour';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        expect(body_input.value).toBe(wcag_default);

        select.value = 'fptt-bilaga-2';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        expect(body_input.value).toBe('# FPTT\n\nEgen FPTT-text.');

        const by_taxonomy = handles.get_body_text_by_taxonomy();
        expect(by_taxonomy['wcag22-pour']).toBe(wcag_default);
        expect(by_taxonomy['fptt-bilaga-2']).toBe('# FPTT\n\nEgen FPTT-text.');
    });
});

describe('EditReportTemplateAppendix1Component', () => {
    beforeEach(() => {
        flush_mock.mockReset();
    });

    test('Spara-knappen visar toast även om komponenten förstörs under serversynk', async () => {
        const messages: Array<{ msg: string; type: string }> = [];
        const comp = new EditReportTemplateAppendix1Component();
        const root = document.createElement('div');

        flush_mock.mockImplementation(async () => {
            comp.destroy();
        });

        await comp.init({
            root,
            deps: {
                router: () => {},
                getState: () => ({
                    auditStatus: 'rulefile_editing',
                    ruleSetId: 'rule-1',
                    ruleFileContent: sample_rule_file,
                }),
                dispatch: async () => {},
                StoreActionTypes: { UPDATE_RULEFILE_CONTENT: 'UPDATE_RULEFILE_CONTENT' },
                Translation: { t: (key: string) => key },
                Helpers: create_helpers(),
                NotificationComponent: {
                    show_global_message: (msg: string, type: string) => {
                        messages.push({ msg, type });
                    },
                },
            },
        });

        comp.render();

        const save_btn = root.querySelector(
            '.form-actions button.button-primary'
        ) as HTMLButtonElement | null;
        expect(save_btn).toBeTruthy();
        save_btn?.click();

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(flush_mock).toHaveBeenCalledTimes(1);
        expect(messages).toEqual([
            { msg: 'rulefile_appendix1_section_saved', type: 'success' },
        ]);
    });

    test('generera-knappen visar toast även om komponenten förstörs under serversynk', async () => {
        const messages: Array<{ msg: string; type: string }> = [];
        const comp = new EditReportTemplateAppendix1Component();
        const root = document.createElement('div');

        flush_mock.mockImplementation(async () => {
            comp.destroy();
        });

        await comp.init({
            root,
            deps: {
                router: () => {},
                getState: () => ({
                    auditStatus: 'rulefile_editing',
                    ruleSetId: 'rule-1',
                    ruleFileContent: sample_rule_file,
                }),
                dispatch: async () => {},
                StoreActionTypes: { UPDATE_RULEFILE_CONTENT: 'UPDATE_RULEFILE_CONTENT' },
                Translation: { t: (key: string) => key },
                Helpers: create_helpers(),
                NotificationComponent: {
                    show_global_message: (msg: string, type: string) => {
                        messages.push({ msg, type });
                    },
                },
            },
        });

        comp.render();

        const generate_btn = root.querySelector(
            '.appendix1-generate-sections-button'
        ) as HTMLButtonElement | null;
        expect(generate_btn).toBeTruthy();
        generate_btn?.click();

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(flush_mock).toHaveBeenCalledTimes(1);
        expect(messages).toEqual([
            { msg: 'rulefile_appendix1_sections_generated', type: 'success' },
        ]);
    });
});

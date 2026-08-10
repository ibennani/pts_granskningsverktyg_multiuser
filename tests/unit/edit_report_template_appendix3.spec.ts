/**
 * Enhetstester för Bilaga 3-redigering och visning i regelfilens rapportmall.
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

const { EditReportTemplateAppendix3Component } = await import(
    '../../js/components/rulefile_sections/EditReportTemplateAppendix3Component.ts'
);
const { render_rulefile_appendix3_template_section } = await import(
    '../../js/components/rulefile_sections/rulefile_sections_type_views.js'
);
const { create_rulefile_section_header } = await import(
    '../../js/components/rulefile_sections/rulefile_sections_header.js'
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
        get_icon_svg: () => '',
    };
}

const sample_rule_file = {
    appendix3: {
        introText: 'Sparad intro **markdown**',
    },
};

describe('EditReportTemplateAppendix3Component', () => {
    beforeEach(() => {
        flush_mock.mockReset();
    });

    test('render visar textarea direkt utan tillbaka-rad eller redigeringsrubrik', async () => {
        const comp = new EditReportTemplateAppendix3Component();
        const root = document.createElement('div');

        await comp.init({
            root,
            deps: {
                router: () => {},
                getState: () => ({ ruleFileContent: sample_rule_file }),
                dispatch: async () => {},
                StoreActionTypes: { UPDATE_RULEFILE_CONTENT: 'UPDATE_RULEFILE_CONTENT' },
                Translation: { t: (key: string) => key },
                Helpers: create_helpers(),
                NotificationComponent: { show_global_message: () => {} },
            },
        });

        comp.render();

        expect(root.querySelector('.audit-settings__back-row')).toBeNull();
        expect(root.querySelector('h1')).toBeNull();
        expect(root.textContent).not.toContain('rulefile_appendix3_edit_heading');
        expect(root.querySelector('.markdown-preview-editor')).toBeNull();

        const textarea = root.querySelector('#rulefile-appendix3-intro-text') as HTMLTextAreaElement | null;
        expect(textarea).toBeTruthy();
        expect(textarea?.value).toBe('Sparad intro **markdown**');
    });

    test('Spara uppdaterar introtext i state', async () => {
        const dispatch = jest.fn<() => Promise<void>>();
        const messages: Array<{ msg: string; type: string }> = [];
        const comp = new EditReportTemplateAppendix3Component();
        const root = document.createElement('div');

        await comp.init({
            root,
            deps: {
                router: () => {},
                getState: () => ({
                    auditStatus: 'rulefile_editing',
                    ruleSetId: 'rule-1',
                    ruleFileContent: sample_rule_file,
                }),
                dispatch,
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

        const textarea = root.querySelector('#rulefile-appendix3-intro-text') as HTMLTextAreaElement;
        textarea.value = 'Ny introtext';

        const save_btn = root.querySelector('.form-actions button.button-primary') as HTMLButtonElement;
        save_btn.click();

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(dispatch).toHaveBeenCalled();
        const action = dispatch.mock.calls[0]?.[0] as {
            payload?: { ruleFileContent?: { appendix3?: { introText?: string } } };
        };
        expect(action?.payload?.ruleFileContent?.appendix3?.introText).toBe('Ny introtext');
        expect(messages).toEqual([{ msg: 'rulefile_appendix3_saved', type: 'success' }]);
    });
});

describe('render_rulefile_appendix3_template_section', () => {
    test('visningsläge följer Bilaga 1-mönster med h1 och redigera-knapp', () => {
        const section = render_rulefile_appendix3_template_section(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
                router: () => {},
                getState: () => ({ auditStatus: 'rulefile_editing', ruleSetId: 'rule-1' }),
            },
            sample_rule_file
        );

        const heading = section.querySelector('#rulefile-appendix3-heading');
        expect(heading?.tagName).toBe('H1');
        expect(heading?.textContent).toBe('rulefile_appendix_hub_3_title');
        expect(section.querySelector('.rulefile-sections-edit-button')).toBeTruthy();
        expect(section.querySelector('.audit-settings__back-row')).toBeNull();
        expect(section.querySelector('.markdown-preview-editor__preview')).toBeTruthy();
    });
});

describe('create_rulefile_section_header för Bilaga 3', () => {
    test('döljer yttre sidhuvud i visningsläge', () => {
        const header = create_rulefile_section_header(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
                router: () => {},
                getState: () => ({ auditStatus: 'rulefile_editing', ruleSetId: 'rule-1' }),
            },
            { id: 'report_template', title: 'Rapportmall' },
            false,
            '3'
        );

        expect(header.hidden).toBe(true);
    });

    test('visar hub-rubrik och intro i redigeringsläge', () => {
        const header = create_rulefile_section_header(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
                router: () => {},
                getState: () => ({ auditStatus: 'rulefile_editing', ruleSetId: 'rule-1' }),
            },
            { id: 'report_template', title: 'Rapportmall' },
            true,
            '3'
        );

        expect(header.hidden).toBe(false);
        const heading = header.querySelector('h1');
        expect(heading?.textContent).toBe('rulefile_appendix_hub_3_title');
        expect(header.textContent).toContain('rulefile_appendix3_edit_intro');
        expect(header.querySelector('.rulefile-sections-edit-button')).toBeNull();
    });
});

/**
 * @file Enhetstester för bristtyper per krav (DeficiencyType).
 */
import { describe, test, expect, jest } from '@jest/globals';
import { validate_rulefile_requirements_section } from '../../js/logic/validation_rulefile_requirements.ts';
import {
    render_deficiency_types_editor,
    render_deficiency_types_view_section,
} from '../../js/components/rulefile_sections/rulefile_deficiency_types_ui.js';

const t = (key: string) => key;

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
        get_icon_svg: () => '<svg></svg>',
    };
}

function build_rule_file() {
    return {
        requirements: {
            req_b: {
                id: 'req_b',
                title: 'Beta krav',
                standardReference: { text: '2.2.2' },
                DeficiencyType: { PrimaryText: 'Beta del 1', SecondaryText: 'Beta del 2' },
            },
            req_a: {
                id: 'req_a',
                title: 'Alfa krav',
                standardReference: { text: '1.1.1' },
                DeficiencyType: { PrimaryText: 'Alfa del 1', SecondaryText: 'Alfa del 2' },
            },
        },
    };
}

describe('rulefile_deficiency_types', () => {
    test('DeficiencyType accepteras som objekt med strängfält', () => {
        const result = validate_rulefile_requirements_section(
            {
                req1: {
                    id: 'req1',
                    title: 'Krav 1',
                    DeficiencyType: {
                        PrimaryText: 'Del 1',
                        SecondaryText: 'Del 2',
                    },
                },
            },
            t
        );
        expect(result.isValid).toBe(true);
    });

    test('DeficiencyType med fel typ ger valideringsfel', () => {
        const result = validate_rulefile_requirements_section(
            {
                req1: {
                    id: 'req1',
                    title: 'Krav 1',
                    DeficiencyType: { PrimaryText: 123 },
                },
            },
            t
        );
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('PrimaryText');
    });

    test('render_deficiency_types_editor bygger delad tabell med filter och redigeringsknappar', () => {
        const container = document.createElement('div');
        render_deficiency_types_editor(
            {
                Helpers: create_helpers(),
                Translation: { t },
            },
            container,
            build_rule_file()
        );

        expect(container.querySelector('.rulefile-classifications-table-layout')).not.toBeNull();
        expect(container.querySelector('.rulefile-classifications-table-filter')).not.toBeNull();
        expect(container.querySelector('.rulefile-classifications-table-filter label')?.textContent).toBe(
            'rulefile_classifications_deficiency_types_filter_label'
        );
        const layout = container.querySelector('.rulefile-classifications-table-layout') as HTMLElement;
        expect(layout.querySelector('.rulefile-classifications-table-filter')?.parentElement).toBe(layout);
        expect(layout.querySelector('.deficiency-types-scroll-wrapper')?.parentElement).toBe(layout);
        const actions_header = container.querySelector('.deficiency-types-actions-header');
        expect(actions_header?.classList.contains('visually-hidden')).toBe(false);
        expect(actions_header?.textContent).toBe(
            'rulefile_classifications_deficiency_types_actions_column'
        );
        expect(actions_header?.querySelector('.visually-hidden')).toBeNull();
        expect(container.querySelector('.deficiency-types-scroll-wrapper')).not.toBeNull();
        expect(container.querySelector('.rulefile-classifications-table.deficiency-types-table')).not.toBeNull();
        expect(container.querySelectorAll('.deficiency-types-row-edit-button').length).toBe(2);
        expect(container.querySelector('.rulefile-classifications-row-header')?.textContent).toBe(
            '1.1.1 Alfa krav'
        );
    });

    test('render_deficiency_types_view_section visar tabell utan redigeringsknappar', () => {
        const section = render_deficiency_types_view_section(
            {
                Helpers: create_helpers(),
                Translation: { t },
            },
            build_rule_file(),
            { show_back: false }
        );

        expect(section.querySelector('.deficiency-types-table')).not.toBeNull();
        expect(section.querySelector('.deficiency-types-row-edit-button')).toBeNull();
        expect(section.querySelectorAll('.deficiency-types-part-line').length).toBeGreaterThan(0);
    });

    test('render_deficiency_types_view_section visar endast requirement.DeficiencyType', () => {
        const section = render_deficiency_types_view_section(
            {
                Helpers: create_helpers(),
                Translation: { t },
            },
            {
                requirements: {
                    req_pc: {
                        id: 'req_pc',
                        title: 'Krav med passCriteria',
                        checks: [
                            {
                                passCriteria: [
                                    {
                                        DeficiencyType: {
                                            PrimaryText: 'Primär från passCriteria',
                                            SecondaryText: 'Sekundär från passCriteria',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
            { show_back: false }
        );

        const lines = Array.from(section.querySelectorAll('.deficiency-types-part-line')).map(
            (line) => line.textContent
        );
        expect(lines).not.toContain('Primär från passCriteria');
        expect(lines).not.toContain('Sekundär från passCriteria');
        expect(lines.filter((line) => line === 'rulefile_metadata_empty_value')).toHaveLength(2);
    });

    test('render_deficiency_types_view_section visar kravnivå DeficiencyType', () => {
        const section = render_deficiency_types_view_section(
            {
                Helpers: create_helpers(),
                Translation: { t },
            },
            {
                requirements: {
                    req_level: {
                        id: 'req_level',
                        title: 'Krav med DeficiencyType',
                        DeficiencyType: { PrimaryText: 'Krav del 1', SecondaryText: 'Krav del 2' },
                    },
                    req_map: {
                        id: 'req_map',
                        title: 'Krav med karta',
                        checks: [
                            {
                                id: 'chk1',
                                passCriteria: {
                                    pc2: {
                                        PrimaryText: 'Karta del 1',
                                        SecondaryText: 'Karta del 2',
                                    },
                                },
                            },
                        ],
                    },
                },
            },
            { show_back: false }
        );

        const lines = Array.from(section.querySelectorAll('.deficiency-types-part-line')).map(
            (line) => line.textContent
        );
        expect(lines).toContain('Krav del 1');
        expect(lines).toContain('Krav del 2');
        expect(lines).not.toContain('Karta del 1');
        expect(lines).not.toContain('Karta del 2');
        expect(lines.filter((line) => line === 'rulefile_metadata_empty_value')).toHaveLength(2);
    });

    test('render_deficiency_types_view_section ignorerar failureStatementTemplate', () => {
        const template =
            'Allt som är inte visuellt formgivet som en rubrik är uppmärkt med <h1>…<h6>. [ange var och hur det brister]';
        const section = render_deficiency_types_view_section(
            {
                Helpers: create_helpers(),
                Translation: { t },
            },
            {
                requirements: {
                    krav_rubriker: {
                        id: 'krav_rubriker',
                        title: 'Information och relationer för rubriker',
                        standardReference: { text: '1.3.1 Info and Relationships' },
                        checks: [
                            {
                                id: '1',
                                passCriteria: [
                                    {
                                        id: '1.1',
                                        requirement:
                                            'Allt som är visuellt formgivet som en rubrik är uppmärkt med <h1>…<h6>.',
                                        failureStatementTemplate: template,
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
            { show_back: false }
        );

        const lines = Array.from(section.querySelectorAll('.deficiency-types-part-line')).map(
            (line) => line.textContent
        );
        expect(lines).not.toContain(template);
        expect(lines.filter((line) => line === 'rulefile_metadata_empty_value')).toHaveLength(2);
    });

    test('render_deficiency_types_view_section visar Ingen information endast när all text saknas', () => {
        const section = render_deficiency_types_view_section(
            {
                Helpers: create_helpers(),
                Translation: { t },
            },
            {
                requirements: {
                    req_empty: {
                        id: 'req_empty',
                        title: 'Krav utan bristtext',
                        checks: [
                            {
                                id: 'chk1',
                                passCriteria: [{ id: 'pc1', requirement: 'Kravtext' }],
                            },
                        ],
                    },
                },
            },
            { show_back: false }
        );

        const lines = Array.from(section.querySelectorAll('.deficiency-types-part-line')).map(
            (line) => line.textContent
        );
        expect(lines).toEqual(['rulefile_metadata_empty_value', 'rulefile_metadata_empty_value']);
    });

    test('redigeringsknapp öppnar synlig dialog-modal', async () => {
        const show_modal = jest.fn();
        HTMLDialogElement.prototype.showModal = show_modal;

        const container = document.createElement('div');
        render_deficiency_types_editor(
            {
                Helpers: create_helpers(),
                Translation: { t },
            },
            container,
            build_rule_file()
        );

        const edit_button = container.querySelector('.deficiency-types-row-edit-button') as HTMLButtonElement;
        edit_button.click();

        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const dialog = document.body.querySelector('.deficiency-type-edit-dialog') as HTMLDialogElement;
        expect(show_modal).toHaveBeenCalled();
        expect(dialog).not.toBeNull();
        expect(dialog.classList.contains('modal-dialog--visible')).toBe(true);

        dialog.remove();
    });
});

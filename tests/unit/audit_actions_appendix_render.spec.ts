/**
 * Enhetstester för granskningens Bilaga 1-översikt (åtgärder → malltexter).
 */
import { describe, test, expect } from '@jest/globals';
import { get_default_appendix1_sections_list } from '../../js/logic/appendix1_sections.ts';
import { render_audit_appendix1_view_section } from '../../js/components/audit_actions_appendix_render.ts';

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

function create_audit_state_with_deficiency() {
    return {
        auditMetadata: {
            auditTypeId: 'tillsyn-fptt',
            appendix1PrincipleIntroOverrides: { perceivable: 'Granskningsspecifik inledning' },
        },
        ruleFileContent: {
            appendix1: {
                groupingTaxonomyId: 'wcag22-pour',
                sections: get_default_appendix1_sections_list(),
                bodyText: '# Sammanfattning',
            },
            metadata: {
                auditTypes: [{ id: 'tillsyn-fptt', taxonomyId: 'wcag22-pour' }],
                taxonomies: [
                    {
                        id: 'wcag22-pour',
                        concepts: [
                            { id: 'perceivable', label: 'Möjligt att uppfatta' },
                            { id: 'operable', label: 'Möjligt att använda' },
                        ],
                    },
                ],
            },
            requirements: {
                req1: {
                    key: 'req1',
                    classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'perceivable' }],
                    checks: [{ id: 'chk1', passCriteria: [{ id: 'pc1', requirement: 'Krav' }] }],
                },
            },
        },
        samples: [
            {
                id: 's1',
                requirementResults: {
                    req1: {
                        checkResults: {
                            chk1: {
                                passCriteria: {
                                    pc1: {
                                        status: 'failed',
                                        deficiencyId: 'B001',
                                        DeficiencyType: {
                                            PrimaryText: 'Semantiska element används inte.',
                                            SecondaryText: 'Till exempel rubriker.',
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        ],
    };
}

describe('render_audit_appendix1_view_section', () => {
    test('visar punktlista med bristtyper under rätt 3.x-sektion', () => {
        const section = render_audit_appendix1_view_section(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
                router: () => {},
            },
            create_audit_state_with_deficiency(),
            { can_edit: false }
        );

        expect(section.querySelector('.appendix1-deficiency-intros-view')).toBeTruthy();
        expect(
            section.querySelector('.appendix1-deficiency-intros-panel__hint')?.textContent
        ).toBe('audit_appendix1_deficiency_intros_hint');

        const strong = section.querySelector('.appendix1-deficiency-list li strong');
        expect(strong?.textContent).toBe('Semantiska element används inte.');
        expect(section.querySelector('.appendix1-deficiency-list li')?.textContent).toBe(
            'Semantiska element används inte. Till exempel rubriker.'
        );
        expect(section.querySelector('.appendix1-deficiency-list ul')).toBeTruthy();
    });

    test('visar ingen bristtypslista när granskningen saknar underkända brister', () => {
        const state = create_audit_state_with_deficiency();
        const samples = state.samples as Array<Record<string, unknown>>;
        const req_results = (
            (samples[0]?.requirementResults as Record<string, unknown>)?.req1 as Record<string, unknown>
        )?.checkResults as Record<string, unknown>;
        const pc1 = (
            (req_results?.chk1 as Record<string, unknown>)?.passCriteria as Record<string, unknown>
        )?.pc1 as Record<string, unknown>;
        pc1.status = 'passed';

        const section = render_audit_appendix1_view_section(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
                router: () => {},
            },
            state,
            { can_edit: false }
        );

        expect(section.querySelector('.appendix1-deficiency-intros-view')).toBeTruthy();
        expect(section.querySelector('.appendix1-deficiency-list')).toBeNull();
    });

    test('visar bristtypslista under pågående granskning utan tilldelat brist-id', () => {
        const state = create_audit_state_with_deficiency();
        const samples = state.samples as Array<Record<string, unknown>>;
        const pc1 = (
            ((samples[0]?.requirementResults as Record<string, unknown>)?.req1 as Record<string, unknown>)
                ?.checkResults as Record<string, unknown>
        )?.chk1 as Record<string, unknown>;
        const pass_criteria = pc1?.passCriteria as Record<string, unknown>;
        const pc_result = pass_criteria?.pc1 as Record<string, unknown>;
        delete pc_result.deficiencyId;

        const section = render_audit_appendix1_view_section(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
                router: () => {},
            },
            state,
            { can_edit: false }
        );

        expect(section.querySelector('.appendix1-deficiency-list ul')).toBeTruthy();
        expect(section.querySelector('.appendix1-deficiency-list li strong')?.textContent).toBe(
            'Semantiska element används inte.'
        );
    });
});

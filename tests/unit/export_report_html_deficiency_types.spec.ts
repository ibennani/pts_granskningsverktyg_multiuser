import {
    collect_deficiency_types_grouped_by_principle,
    read_deficiency_type_node,
} from '../../js/export/export_deficiency_types_collect.ts';
import { build_deficiency_types_appendix_body_html } from '../../js/export/export_report_html_deficiency_types.ts';
import {
    build_deficiency_types_appendix_pdf_filename,
    build_deficiency_types_appendix_word_filename,
} from '../../js/export/export_report_filename.ts';
import { append_word_deficiency_types_appendix_paragraphs } from '../../js/export/export_word_deficiency_types.ts';
import { Paragraph } from 'docx';

const t = (key: string) => {
    const labels: Record<string, string> = {
        perceivable: 'Möjligt att uppfatta',
        operable: 'Möjligt att använda',
        understandable: 'Möjligt att förstå',
        robust: 'Robust',
        export_pdf_deficiency_types_title: 'Bilaga 1: Bristtyper',
        export_pdf_deficiency_types_intro: 'Introtext.',
        export_pdf_deficiency_types_empty: 'Inga bristtyper.',
        filename_fallback_actor: 'Aktör',
    };
    return labels[key] ?? key;
};

function create_audit_with_deficiency_types() {
    return {
        auditMetadata: { actorName: 'Test AB', caseNumber: '2026-001' },
        ruleFileContent: {
            metadata: {
                taxonomies: [
                    {
                        id: 'wcag22-pour',
                        concepts: [
                            { id: 'perceivable', label: 'Möjligt att uppfatta' },
                            { id: 'operable', label: 'Möjligt att använda' },
                            { id: 'understandable', label: 'Möjligt att förstå' },
                            { id: 'robust', label: 'Robust' },
                        ],
                    },
                ],
            },
            requirements: {
                req1: {
                    key: 'req1',
                    title: 'Krav 1',
                    classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'perceivable' }],
                    checks: [
                        {
                            id: 'chk1',
                            passCriteria: [{ id: 'pc1', requirement: 'Kravtext' }],
                        },
                    ],
                },
                req2: {
                    key: 'req2',
                    title: 'Krav 2',
                    classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'operable' }],
                    checks: [
                        {
                            id: 'chk2',
                            passCriteria: [{ id: 'pc2', requirement: 'Kravtext 2' }],
                        },
                    ],
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
                    req2: {
                        checkResults: {
                            chk2: {
                                passCriteria: {
                                    pc2: {
                                        status: 'failed',
                                        deficiencyId: 'B002',
                                        DeficiencyType: {
                                            PrimaryText: 'Tangentbordsnavigering saknas.',
                                            SecondaryText: '',
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

describe('export_deficiency_types_collect', () => {
    test('read_deficiency_type_node kräver PrimaryText', () => {
        expect(read_deficiency_type_node({ DeficiencyType: { SecondaryText: 'Sekundär' } })).toBeNull();
        expect(
            read_deficiency_type_node({
                DeficiencyType: { PrimaryText: ' Primär ', SecondaryText: ' Sekundär ' },
            })
        ).toEqual({ primary: 'Primär', secondary: 'Sekundär' });
    });

    test('collect_deficiency_types_grouped_by_principle sorterar per princip och avdubblerar', () => {
        const audit = create_audit_with_deficiency_types();
        const groups = collect_deficiency_types_grouped_by_principle(audit, t);
        expect(groups).toHaveLength(2);
        expect(groups[0].principle_id).toBe('perceivable');
        expect(groups[0].types[0].primary).toBe('Semantiska element används inte.');
        expect(groups[0].types[0].secondary).toBe('Till exempel rubriker.');
        expect(groups[1].principle_id).toBe('operable');
    });
});

describe('export_report_html_deficiency_types', () => {
    test('build_deficiency_types_appendix_body_html renderar h1, intro, h2 och lista', () => {
        const html = build_deficiency_types_appendix_body_html(create_audit_with_deficiency_types(), t);
        expect(html).toContain('<h1>Bilaga 1: Bristtyper</h1>');
        expect(html).toContain('<p>Introtext.</p>');
        expect(html).toContain('<h2>Möjligt att uppfatta</h2>');
        expect(html).toContain('<strong>Semantiska element används inte.</strong> Till exempel rubriker.');
        expect(html).toContain('<h2>Möjligt att använda</h2>');
        expect(html).toContain('<strong>Tangentbordsnavigering saknas.</strong>');
    });

    test('build_deficiency_types_appendix_pdf_filename använder bilaga-suffix', () => {
        const filename = build_deficiency_types_appendix_pdf_filename(
            { auditMetadata: { actorName: 'Test AB', caseNumber: '2026-001' } },
            t
        );
        expect(filename).toMatch(/_bilaga_1_bristtyper\.pdf$/);
    });

    test('build_deficiency_types_appendix_word_filename använder bilaga-suffix', () => {
        const filename = build_deficiency_types_appendix_word_filename(
            { auditMetadata: { actorName: 'Test AB', caseNumber: '2026-001' } },
            t
        );
        expect(filename).toMatch(/_bilaga_1_bristtyper\.docx$/);
    });
});

describe('export_word_deficiency_types', () => {
    test('append_word_deficiency_types_appendix_paragraphs bygger rubriker och punktlista', () => {
        const children: unknown[] = [];
        append_word_deficiency_types_appendix_paragraphs(children, create_audit_with_deficiency_types(), t);
        expect(children).toHaveLength(6);
        expect(children.every((child) => child instanceof Paragraph)).toBe(true);
    });
});

import {
    collect_deficiency_types_grouped_by_principle,
    read_deficiency_type_node,
} from '../../js/export/export_deficiency_types_collect.ts';
import { build_appendix1_summary_body_html } from '../../js/export/export_report_html_appendix1_summary.ts';
import {
    build_appendix1_summary_pdf_filename,
    build_appendix1_summary_word_filename,
} from '../../js/export/export_report_filename.ts';
import { append_word_appendix1_summary_paragraphs } from '../../js/export/export_word_appendix1_summary.ts';
import { Paragraph } from 'docx';

const t = (key: string) => {
    const labels: Record<string, string> = {
        perceivable: 'Möjligt att uppfatta',
        operable: 'Möjligt att använda',
        understandable: 'Möjligt att förstå',
        robust: 'Robust',
        export_appendix1_summary_title: 'Bilaga 1: Sammanfattning',
        export_appendix1_summary_deficiency_types_heading: 'Bristtyper',
        export_appendix1_summary_deficiency_types_empty: 'Inga bristtyper.',
        filename_fallback_actor: 'Aktör',
    };
    return labels[key] ?? key;
};

function create_audit_with_deficiency_types() {
    return {
        auditMetadata: {
            actorName: 'Test AB',
            caseNumber: '2026-001',
            appendix1SummaryText: '## Sammanfattning\n\nDetta är **markdown**.',
        },
        ruleFileContent: {
            appendix1: { summaryText: 'Standard' },
            metadata: {
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
                    title: 'Krav 1',
                    classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'perceivable' }],
                    checks: [{ id: 'chk1', passCriteria: [{ id: 'pc1', requirement: 'Kravtext' }] }],
                },
                req2: {
                    key: 'req2',
                    title: 'Krav 2',
                    classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'operable' }],
                    checks: [{ id: 'chk2', passCriteria: [{ id: 'pc2', requirement: 'Kravtext 2' }] }],
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
    });

    test('collect_deficiency_types_grouped_by_principle sorterar per princip och avdubblerar', () => {
        const audit = create_audit_with_deficiency_types();
        const groups = collect_deficiency_types_grouped_by_principle(audit, t);
        expect(groups).toHaveLength(2);
        expect(groups[0].types[0].primary).toBe('Semantiska element används inte.');
    });
});

describe('export_report_html_appendix1_summary', () => {
    test('build_appendix1_summary_body_html renderar titel, markdown och bristtyper', () => {
        const html = build_appendix1_summary_body_html(create_audit_with_deficiency_types(), t);
        expect(html).toContain('<h1>Bilaga 1: Sammanfattning</h1>');
        expect(html).toContain('<h2>Sammanfattning</h2>');
        expect(html).toContain('<strong>markdown</strong>');
        expect(html).toContain('<h2>Bristtyper</h2>');
        expect(html).toContain('<h3>Möjligt att uppfatta</h3>');
        expect(html).toContain('<strong>Semantiska element används inte.</strong>');
    });

    test('build_appendix1_summary_pdf_filename använder sammanfattning-suffix', () => {
        const filename = build_appendix1_summary_pdf_filename(
            { auditMetadata: { actorName: 'Test AB', caseNumber: '2026-001' } },
            t
        );
        expect(filename).toMatch(/_bilaga_1_sammanfattning\.pdf$/);
    });

    test('build_appendix1_summary_word_filename använder sammanfattning-suffix', () => {
        const filename = build_appendix1_summary_word_filename(
            { auditMetadata: { actorName: 'Test AB', caseNumber: '2026-001' } },
            t
        );
        expect(filename).toMatch(/_bilaga_1_sammanfattning\.docx$/);
    });
});

describe('export_word_appendix1_summary', () => {
    test('append_word_appendix1_summary_paragraphs bygger stycken för text och bristtyper', () => {
        const children: unknown[] = [];
        append_word_appendix1_summary_paragraphs(children, create_audit_with_deficiency_types(), t);
        expect(children.length).toBeGreaterThan(4);
        expect(children.every((child) => child instanceof Paragraph)).toBe(true);
    });
});

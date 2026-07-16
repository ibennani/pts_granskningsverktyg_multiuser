import {
    collect_deficiency_types_grouped_by_principle,
    collect_deficiency_types_grouped_by_taxonomy,
    read_deficiency_type_node,
} from '../../js/export/export_deficiency_types_collect.ts';
import { build_appendix1_summary_body_html } from '../../js/export/export_report_html_appendix1_summary.ts';
import { build_appendix1_pts_pdf_document } from '../../js/export/export_report_html_appendix1_pts.ts';
import {
    build_appendix1_summary_pdf_filename,
    build_appendix1_summary_word_filename,
} from '../../js/export/export_report_filename.ts';
import { append_word_appendix1_summary_paragraphs } from '../../js/export/export_word_appendix1_summary.ts';
import { get_default_appendix1_sections_list } from '../../js/logic/appendix1_sections.ts';
import { Paragraph } from 'docx';

const t = (key: string) => {
    const labels: Record<string, string> = {
        perceivable: 'Möjligt att uppfatta',
        operable: 'Möjligt att använda',
        understandable: 'Möjligt att förstå',
        robust: 'Robust',
        case_number: 'Diarienummer',
        filename_fallback_actor: 'Aktör',
        export_appendix1_audit_info_heading: 'Information om granskningen',
        export_appendix1_toc_heading: 'Innehåll',
        export_appendix1_toc_nav_aria: 'Innehållsförteckning',
        export_appendix1_cover_aria: 'Omslag',
        export_appendix1_cover_title: 'Granskningssammanfattning',
        export_appendix1_cover_subtitle: 'Bilaga 1',
        export_appendix1_cover_image_alt: 'Omslagsbild för granskningssammanfattning',
        export_appendix1_document_title_suffix: 'Granskningssammanfattning bilaga 1',
        export_appendix1_service_prefix: 'E-handelstjänsten',
        export_appendix1_service_fallback: 'E-handelstjänsten',
        export_appendix1_audited_service_label: 'Granskad digital tjänst',
        export_appendix1_service_link_label: 'Länk till tjänst',
        export_appendix1_audit_started_label: 'Granskning inledd',
        export_appendix1_audit_ended_label: 'Granskning avslutad',
        export_appendix1_case_handler_label: 'Handläggare',
        export_appendix1_investigator_label: 'Utredare',
        export_appendix1_pts_name: 'Post- och telestyrelsen',
        export_appendix1_pts_address_line1: 'Box 6101',
        export_appendix1_pts_address_line2: '102 32 Stockholm',
        export_appendix1_pts_phone: '08-678 55 00',
    };
    return labels[key] ?? key;
};

function create_audit_with_deficiency_types() {
    return {
        auditMetadata: {
            actorName: 'Test AB',
            caseNumber: '2026-001',
            appendix1SummaryText: 'Granskningsspecifik inledning med **markdown**.',
        },
        ruleFileContent: {
            appendix1: {
                groupingTaxonomyId: 'wcag22-pour',
                sections: get_default_appendix1_sections_list(),
            },
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

    test('collect_deficiency_types_grouped_by_taxonomy använder taxonomy-id', () => {
        const audit = create_audit_with_deficiency_types();
        const groups = collect_deficiency_types_grouped_by_taxonomy(audit, 'wcag22-pour', t);
        expect(groups).toHaveLength(2);
        expect(groups[0].concept_id).toBe('perceivable');
    });
});

describe('export_report_html_appendix1_pts', () => {
    test('build_appendix1_summary_body_html renderar PTS-struktur med sektioner och bristtyper', () => {
        const html = build_appendix1_summary_body_html(create_audit_with_deficiency_types(), t);
        expect(html).toContain('class="appendix1-cover"');
        expect(html).toContain('id="section-audit-info"');
        expect(html).toContain('<nav aria-label="Innehållsförteckning"');
        expect(html).toContain('id="section-introduction"');
        expect(html).toContain('<h1>1. Inledning</h1>');
        expect(html).toContain('<strong>markdown</strong>');
        expect(html).toContain('<h2>3.1 Uppfattningsbar – sammanfattning av brister</h2>');
        expect(html).toContain('<strong>Semantiska element används inte.</strong>');
    });

    test('build_appendix1_pts_pdf_document har lang och semantiska element', () => {
        const html = build_appendix1_pts_pdf_document(create_audit_with_deficiency_types(), t);
        expect(html).toContain('lang="sv"');
        expect(html).toContain('<dl>');
        expect(html).toContain('{{APPENDIX1_COVER_SRC}}');
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
    test('append_word_appendix1_summary_paragraphs bygger stycken för PTS-struktur', () => {
        const children: unknown[] = [];
        append_word_appendix1_summary_paragraphs(children, create_audit_with_deficiency_types(), t);
        expect(children.length).toBeGreaterThan(10);
        expect(children.every((child) => child instanceof Paragraph)).toBe(true);
    });
});

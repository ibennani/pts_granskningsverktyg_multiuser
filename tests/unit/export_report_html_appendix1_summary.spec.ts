import {
    collect_deficiency_types_grouped_by_principle,
    collect_deficiency_types_grouped_by_taxonomy,
    read_deficiency_type_node,
    resolve_requirement_deficiency_type_display,
} from '../../js/export/export_deficiency_types_collect.ts';
import { build_appendix1_pdf_print_css } from '../../js/export/export_report_appendix1_print_css.ts';
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
        export_appendix1_audit_info_table_summary: 'Sammanfattning av granskningens metadata',
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

    test('resolve_requirement_deficiency_type_display läser endast requirement.DeficiencyType', () => {
        const from_requirement = resolve_requirement_deficiency_type_display({
            DeficiencyType: { PrimaryText: 'Kravnivå', SecondaryText: 'Sekundär krav' },
            checks: [
                {
                    passCriteria: [
                        {
                            DeficiencyType: {
                                PrimaryText: 'PassCriteria',
                                SecondaryText: 'Sekundär pc',
                            },
                        },
                    ],
                },
            ],
        });
        expect(from_requirement).toEqual({ primary: 'Kravnivå', secondary: 'Sekundär krav' });
    });

    test('resolve_requirement_deficiency_type_display ignorerar passCriteria utan kravnivå', () => {
        const from_pass_criteria = resolve_requirement_deficiency_type_display({
            checks: [
                {
                    passCriteria: [
                        { requirement: 'Utan bristtyp' },
                        {
                            DeficiencyType: {
                                PrimaryText: 'Semantiska element används inte.',
                                SecondaryText: 'Till exempel rubriker.',
                            },
                        },
                    ],
                },
            ],
        });
        expect(from_pass_criteria).toBeNull();
    });

    test('resolve_requirement_deficiency_type_display ignorerar passCriteria som objekt-karta utan kravnivå', () => {
        const resolved = resolve_requirement_deficiency_type_display({
            checks: [
                {
                    id: 'chk1',
                    passCriteria: {
                        pc1: { requirement: 'Utan bristtyp' },
                        pc2: {
                            DeficiencyType: {
                                PrimaryText: 'Primär från objekt-karta',
                                SecondaryText: 'Sekundär från objekt-karta',
                            },
                        },
                    },
                },
            ],
        });
        expect(resolved).toBeNull();
    });

    test('read_deficiency_type_node ignorerar platta PrimaryText-fält utan DeficiencyType-wrapper', () => {
        expect(
            read_deficiency_type_node({
                PrimaryText: 'Platt primär',
                SecondaryText: 'Platt sekundär',
            })
        ).toBeNull();
    });

    test('resolve_requirement_deficiency_type_display ignorerar failureStatementTemplate', () => {
        const template =
            'Allt som är inte visuellt formgivet som en rubrik är uppmärkt med <h1>…<h6>. [ange var och hur det brister]';
        const resolved = resolve_requirement_deficiency_type_display({
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
        });
        expect(resolved).toBeNull();
    });

    test('collect_deficiency_types_grouped_by_taxonomy samlar bristtyper utan tilldelat brist-id', () => {
        const audit = create_audit_with_deficiency_types();
        const samples = audit.samples as Array<Record<string, unknown>>;
        const pc1 = (
            ((samples[0]?.requirementResults as Record<string, unknown>)?.req1 as Record<string, unknown>)
                ?.checkResults as Record<string, unknown>
        )?.chk1 as Record<string, unknown>;
        const pass_criteria = pc1?.passCriteria as Record<string, unknown>;
        delete (pass_criteria?.pc1 as Record<string, unknown>).deficiencyId;

        const groups = collect_deficiency_types_grouped_by_taxonomy(audit, 'wcag22-pour', t);
        expect(groups).toHaveLength(2);
        expect(groups[0].types[0].primary).toBe('Semantiska element används inte.');
    });

    test('collect_deficiency_types_grouped_by_taxonomy faller tillbaka till requirement.DeficiencyType i regelfilen', () => {
        const audit = {
            ruleFileContent: {
                appendix1: { groupingTaxonomyId: 'wcag22-pour' },
                metadata: {
                    taxonomies: [
                        {
                            id: 'wcag22-pour',
                            concepts: [{ id: 'perceivable', label: 'Möjligt att uppfatta' }],
                        },
                    ],
                },
                requirements: {
                    req1: {
                        key: 'req1',
                        title: 'Rubriker',
                        classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'perceivable' }],
                        DeficiencyType: {
                            PrimaryText: 'Rubrikerna förekommer i icke-hierarkisk ordning.',
                            SecondaryText: 'Till exempel hopp över nivåer.',
                        },
                        checks: [
                            {
                                id: 'chk1',
                                passCriteria: [
                                    {
                                        id: 'pc1',
                                        requirement: 'Rubrikerna kommer i hierarkisk ordning.',
                                        failureStatementTemplate:
                                            'Rubrikerna förekommer i icke‑hierarkisk ordning. [ange var och hur det brister]',
                                    },
                                ],
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
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        };
        const groups = collect_deficiency_types_grouped_by_taxonomy(audit, 'wcag22-pour', t);
        expect(groups).toHaveLength(1);
        expect(groups[0].types[0].primary).toBe('Rubrikerna förekommer i icke-hierarkisk ordning.');
        expect(groups[0].types[0].secondary).toBe('Till exempel hopp över nivåer.');
    });

    test('collect_deficiency_types_grouped_by_taxonomy ignorerar failureStatementTemplate utan DeficiencyType', () => {
        const template = 'Rubrikerna förekommer i icke‑hierarkisk ordning. [ange var och hur det brister]';
        const audit = {
            ruleFileContent: {
                appendix1: { groupingTaxonomyId: 'wcag22-pour' },
                metadata: {
                    taxonomies: [
                        {
                            id: 'wcag22-pour',
                            concepts: [{ id: 'perceivable', label: 'Möjligt att uppfatta' }],
                        },
                    ],
                },
                requirements: {
                    req1: {
                        key: 'req1',
                        title: 'Rubriker',
                        classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'perceivable' }],
                        checks: [
                            {
                                id: 'chk1',
                                passCriteria: [
                                    {
                                        id: 'pc1',
                                        requirement: 'Rubrikerna kommer i hierarkisk ordning.',
                                        failureStatementTemplate: template,
                                    },
                                ],
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
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        };
        const groups = collect_deficiency_types_grouped_by_taxonomy(audit, 'wcag22-pour', t);
        expect(groups).toHaveLength(0);
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
        expect(html).toContain('appendix1-cover__case-number');
        expect(html).toContain('Diarienummer 2026-001');
        expect(html).toContain('id="section-audit-info"');
        expect(html).toContain('<nav aria-label="Innehållsförteckning"');
        expect(html).toContain('id="section-introduction"');
        expect(html).toContain('<h1>1. Inledning</h1>');
        expect(html).toContain('<strong>markdown</strong>');
        expect(html).toContain('<h2>3.1 Uppfattningsbar – sammanfattning av brister</h2>');
        expect(html).toContain('<strong>Semantiska element används inte.</strong>');
    });

    test('build_appendix1_summary_body_html visar diarienummer på omslaget utan domän', () => {
        const audit = {
            ...create_audit_with_deficiency_types(),
            auditMetadata: {
                ...create_audit_with_deficiency_types().auditMetadata,
                actorLink: 'https://www.xxl.se/',
                caseNumber: '25-20478',
            },
        };
        const html = build_appendix1_summary_body_html(audit, t);
        const cover_html = html.split('</section>')[0];
        expect(cover_html).toContain('Diarienummer 25-20478');
        expect(cover_html).not.toContain('xxl.se');
    });

    test('build_appendix1_pts_pdf_document har lang och semantiska element', () => {
        const html = build_appendix1_pts_pdf_document(create_audit_with_deficiency_types(), t);
        expect(html).toContain('lang="sv"');
        expect(html).toContain(
            '<table class="appendix1-audit-info__meta" summary="Sammanfattning av granskningens metadata">'
        );
        expect(html).toContain('<th scope="row">');
        expect(html).toContain('{{APPENDIX1_COVER_SRC}}');
    });

    test('PDF HTML har omslag dolt från taggträd och TOC-rubrik som h1', () => {
        const html = build_appendix1_pts_pdf_document(create_audit_with_deficiency_types(), t);
        expect(html).toContain('<section class="appendix1-cover" aria-hidden="true">');
        expect(html).toContain('<h1 class="appendix1-toc-title">Innehåll</h1>');
        expect(html).not.toContain('role="heading"');
    });

    test('PDF HTML visar granskning avslutad när sluttid finns', () => {
        const audit = {
            ...create_audit_with_deficiency_types(),
            auditStatus: 'locked',
            endTime: '2024-06-20T14:00:00.000Z',
            auditMetadata: {
                ...create_audit_with_deficiency_types().auditMetadata,
                endTime: '2024-06-20T14:00:00.000Z',
            },
        };
        const html = build_appendix1_pts_pdf_document(audit, t);
        expect(html).toContain('Granskning avslutad');
        expect(html).toMatch(/2024-06-2[01]/);
    });

    test('PDF HTML ersätter {{endDate}} i sektionsinnehåll', () => {
        const audit = {
            ...create_audit_with_deficiency_types(),
            auditStatus: 'locked',
            endTime: '2024-06-20T14:00:00.000Z',
            auditMetadata: {
                ...create_audit_with_deficiency_types().auditMetadata,
                appendix1SummaryText: 'Avslutad den {{endDate}}.',
            },
        };
        const html = build_appendix1_pts_pdf_document(audit, t);
        expect(html).toMatch(/Avslutad den 2024-06-2[01]/);
        expect(html).not.toContain('{{endDate}}');
    });

    test('PDF HTML tar bort duplicerad inledningsrubrik i sektionsinnehåll', () => {
        const audit = {
            ...create_audit_with_deficiency_types(),
            auditMetadata: {
                ...create_audit_with_deficiency_types().auditMetadata,
                appendix1SummaryText: '# 1. Inledning\n\nUnik brödtext.',
            },
        };
        const html = build_appendix1_pts_pdf_document(audit, t);
        const introduction_matches = html.match(/<h1>1\. Inledning<\/h1>/g) ?? [];
        expect(introduction_matches).toHaveLength(1);
        expect(html).toContain('Unik brödtext.');
    });

    test('PDF HTML har kompakt PTS-kontaktblock utan separata adressstycken', () => {
        const html = build_appendix1_pts_pdf_document(create_audit_with_deficiency_types(), t);
        expect(html).toContain('class="appendix1-audit-info__contact"');
        expect(html).toContain('Post- och telestyrelsen<br>Box 6101<br>');
        expect(html.match(/<p>Post- och telestyrelsen<\/p>/g)).toBeNull();
    });

    test('PDF print-CSS har tight kontakt och punktledare i innehållsförteckning', () => {
        const css = build_appendix1_pdf_print_css();
        expect(css).toContain("'Aeonik'");
        expect(css).not.toContain('Cambria');
        expect(css).toContain('.appendix1-audit-info__contact');
        expect(css).toMatch(/line-height:\s*1\.15/);
        expect(css).toContain('.appendix1-toc__leader');
        expect(css).toContain('.appendix1-toc__label::after');
        expect(css).toMatch(/dotted #000000/);
        expect(css).toContain('display: block');
        expect(css).toContain('.appendix1-toc__item--level-1 .appendix1-toc__label');
        expect(css).toContain('.appendix1-toc__item--level-2 .appendix1-toc__label');
        expect(css).toContain('padding-left: 3.75mm');
        expect(css).not.toContain('transform: translateY');
    });

    test('PDF HTML har innehållsförteckning med ledare-span och taggade sidnummer', () => {
        const html = build_appendix1_pts_pdf_document(create_audit_with_deficiency_types(), t);
        expect(html).toContain('class="appendix1-toc__leader"');
        expect(html).toContain('role="presentation"');
        expect(html).toContain('class="appendix1-toc__page"');
        expect(html).not.toContain('appendix1-toc__page" aria-hidden="true"');
        expect(html).toContain('class="appendix1-toc__link"');
        expect(html).toContain('appendix1-toc__item--level-1');
        expect(html).toContain('appendix1-toc__item--level-2');
        expect(html).toContain('href="#section-audit-info"');
        expect(html).toContain('summary="Sammanfattning av granskningens metadata"');
    });

    test('PDF HTML har punktlistor med bristtyper under 3.x', () => {
        const html = build_appendix1_pts_pdf_document(create_audit_with_deficiency_types(), t);
        expect(html).toContain('<div class="appendix1-deficiency-list"><ul>');
        expect(html).toContain('<strong>Semantiska element används inte.</strong>');
    });

    test('PDF print-CSS har sidnummer i innehållsförteckning och helsidesomslag', () => {
        const css = build_appendix1_pdf_print_css();
        expect(css).toContain('.appendix1-toc__page');
        expect(css).not.toContain('target-counter');
        expect(css).toMatch(/height:\s*297mm/);
        expect(css).toContain('object-fit: cover');
    });

    test('build_appendix1_summary_pdf_filename använder dnr, aktör, bilaga och typ utan datum', () => {
        const filename = build_appendix1_summary_pdf_filename(
            { auditMetadata: { actorName: 'NetOnNet AB', caseNumber: '25-20478' } },
            t
        );
        expect(filename).toBe('25-20478_NetOnNet_AB_bilaga_1_sammanfattning.pdf');
    });

    test('build_appendix1_summary_word_filename använder dnr, aktör, bilaga och typ utan datum', () => {
        const filename = build_appendix1_summary_word_filename(
            { auditMetadata: { actorName: 'NetOnNet AB', caseNumber: '25-20478' } },
            t
        );
        expect(filename).toBe('25-20478_NetOnNet_AB_bilaga_1_sammanfattning.docx');
    });
});

describe('export_word_appendix1_summary', () => {
    test('append_word_appendix1_summary_paragraphs bygger stycken för PTS-struktur', () => {
        const children: unknown[] = [];
        append_word_appendix1_summary_paragraphs(children, create_audit_with_deficiency_types(), t);
        expect(children.length).toBeGreaterThan(10);
        expect(children.every((child) => child instanceof Paragraph)).toBe(true);
    });

    test('Word-innehållsförteckning använder högerställd positional tab mot marginal', () => {
        const children: unknown[] = [];
        append_word_appendix1_summary_paragraphs(children, create_audit_with_deficiency_types(), t);

        const serialized = JSON.stringify(children);
        expect(serialized).toContain('"rootKey":"w:ptab"');
        expect(serialized).toContain('"alignment":"right"');
        expect(serialized).toContain('"relativeTo":"margin"');
        expect(serialized).toContain('"leader":"dot"');
    });

    test('Word-export sätter sidbrytning så omslag räknas som sida 1', () => {
        const children: unknown[] = [];
        append_word_appendix1_summary_paragraphs(children, create_audit_with_deficiency_types(), t);

        const serialized = JSON.stringify(children);
        expect(serialized).toContain('"rootKey":"w:pageBreakBefore"');
        expect(serialized).toContain('"name":"appendix1_audit_info"');
    });
});

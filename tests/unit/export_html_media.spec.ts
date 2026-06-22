/**
 * @fileoverview Enhetstester för HTML-export zip och mediemarkup.
 */

import {
    collect_html_export_zip_entries,
    get_deficiency_media_export_names,
    get_sample_media_export_names,
    HTML_EXPORT_MEDIA_DIR
} from '../../js/export/export_html_media.ts';
import {
    build_content_sorted_by_requirement,
    build_content_sorted_by_sample
} from '../../js/export/export_html_build_layouts.ts';
import { create_html_observation_media } from '../../js/export/export_html_build_primitives.ts';

const media_context = {
    audit_type_label: 'WEBB',
    granskning_sequence: 1,
    case_number: '26-11111',
    deficiency_id_part_width: 3,
    capture_dates: new Map([
        ['skarm1.png', '2026-04-11'],
        ['stickprov.png', '2026-04-11']
    ])
};

const sample_audit = {
    auditId: 'audit-1',
    ruleFileContent: {
        metadata: { auditType: 'web' },
        requirements: {
            req1: {
                id: 'req1',
                title: 'Krav 1',
                checks: [
                    {
                        id: 'c1',
                        passCriteria: [{ id: 'pc1', failureStatementTemplate: 'Mall', requirement: 'Kravtext' }]
                    }
                ]
            }
        }
    },
    auditMetadata: { caseNumber: '26-11111' },
    samples: [
        {
            id: 's1',
            description: 'Startsida',
            attachedMediaFilenames: ['stickprov.png'],
            requirementResults: {
                req1: {
                    checkResults: {
                        c1: {
                            passCriteria: {
                                pc1: {
                                    status: 'failed',
                                    deficiencyId: 'B047',
                                    observationDetail: 'Observation',
                                    attachedMediaFilenames: ['skarm1.png']
                                }
                            }
                        }
                    }
                }
            }
        }
    ]
};

describe('export_html_media', () => {
    test('get_deficiency_media_export_names använder PTS-format', () => {
        expect(
            get_deficiency_media_export_names(['skarm1.png'], media_context, 'B047')
        ).toEqual(['047_1_WEBB_1_2026-04-11_26-11111.png']);
    });

    test('get_sample_media_export_names använder stickprovsnummer', () => {
        expect(
            get_sample_media_export_names(
                ['stickprov.png'],
                media_context,
                's1',
                sample_audit.samples
            )
        ).toEqual(['000_1_WEBB_1_2026-04-11_26-11111.png']);
    });

    test('collect_html_export_zip_entries samlar brist och stickprov', () => {
        const entries = collect_html_export_zip_entries(sample_audit, media_context);
        expect(entries).toEqual([
            {
                original_filename: 'skarm1.png',
                zip_path: `${HTML_EXPORT_MEDIA_DIR}/047_1_WEBB_1_2026-04-11_26-11111.png`
            },
            {
                original_filename: 'stickprov.png',
                zip_path: `${HTML_EXPORT_MEDIA_DIR}/000_1_WEBB_1_2026-04-11_26-11111.png`
            }
        ]);
    });

    test('create_html_observation_media renderar relativ media-sökväg', () => {
        const html = create_html_observation_media(['skarm1.png'], 'B047', media_context);
        expect(html).toContain('src="media/047_1_WEBB_1_2026-04-11_26-11111.png"');
        expect(html).toContain('<figcaption>047_1_WEBB_1_2026-04-11_26-11111.png</figcaption>');
    });

    test('krav-sortering innehåller bristbild men inte stickprovssektion', () => {
        const t = (key: string) => key;
        const { content_html } = build_content_sorted_by_requirement(sample_audit, t, media_context);
        expect(content_html).toContain('src="media/047_1_WEBB_1_2026-04-11_26-11111.png"');
        expect(content_html).not.toContain('sample-media-section');
    });

    test('stickprov-sortering innehåller stickprovsbild och bristbild', () => {
        const t = (key: string) => key;
        const { content_html } = build_content_sorted_by_sample(sample_audit, t, media_context);
        expect(content_html).toContain('sample-media-section');
        expect(content_html).toContain('src="media/000_1_WEBB_1_2026-04-11_26-11111.png"');
        expect(content_html).toContain('src="media/047_1_WEBB_1_2026-04-11_26-11111.png"');
    });
});

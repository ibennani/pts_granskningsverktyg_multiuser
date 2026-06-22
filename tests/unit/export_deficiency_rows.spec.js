import {
    build_deficiencies_data,
    build_deficiency_column_defs,
    format_screenshot_reference_for_export
} from '../../js/export/export_deficiency_rows.ts';
import { escape_for_csv } from '../../js/export/export_format_helpers.ts';

describe('export_deficiency_rows', () => {
    const t = (key) => {
        const map = {
            excel_col_deficiency_id: 'Brist-ID',
            excel_col_req_title: 'Kravets titel',
            excel_col_reference: 'Referens',
            excel_col_sample_name: 'Granskningsdelens namn',
            excel_col_sample_url: 'Granskningsdelens URL',
            excel_col_deficiency_type: 'Typ av brist',
            excel_col_observation: 'Observation',
            excel_col_screenshot_reference: 'Skärmbild referens',
            excel_col_comment: 'Kommentar',
            excel_col_wcag_perceivable: 'Möjlig att uppfatta',
            excel_col_wcag_operable: 'Möjlig att hantera',
            excel_col_wcag_understandable: 'Möjlig att begripa',
            excel_col_wcag_robust: 'Robust',
            yes: 'Ja',
            no: 'Nej'
        };
        return map[key] || key;
    };

    test('format_screenshot_reference_for_export med flera filnamn', () => {
        expect(format_screenshot_reference_for_export(['a.png', 'b.jpg'])).toBe('a.png\nb.jpg');
    });

    test('format_screenshot_reference_for_export tom eller ogiltig', () => {
        expect(format_screenshot_reference_for_export([])).toBe('');
        expect(format_screenshot_reference_for_export(null)).toBe('');
        expect(format_screenshot_reference_for_export(['  ', 'c.png'])).toBe('c.png');
    });

    test('build_deficiency_column_defs placerar screenshotReference efter observation', () => {
        const defs = build_deficiency_column_defs(t, false);
        const keys = defs.map((def) => def.key);
        const obs_index = keys.indexOf('observation');
        const shot_index = keys.indexOf('screenshotReference');
        expect(obs_index).toBeGreaterThanOrEqual(0);
        expect(shot_index).toBe(obs_index + 1);
    });

    test('build_deficiencies_data sätter screenshotReference från attachedMediaFilenames', () => {
        const audit = {
            ruleFileContent: {
                requirements: {
                    req1: {
                        key: 'req1',
                        title: 'Krav 1',
                        checks: [
                            {
                                id: 'chk1',
                                passCriteria: [
                                    {
                                        id: 'pc1',
                                        requirement: 'Kravtext',
                                        failureStatementTemplate: ''
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            samples: [
                {
                    id: 's1',
                    description: 'Startsida',
                    url: 'https://example.com',
                    requirementResults: {
                        req1: {
                            checkResults: {
                                chk1: {
                                    passCriteria: {
                                        pc1: {
                                            status: 'failed',
                                            deficiencyId: 'B1',
                                            observationDetail: 'Min observation',
                                            attachedMediaFilenames: ['skarm1.png', 'skarm2.png']
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        };

        const rows = build_deficiencies_data(audit, t);
        expect(rows).toHaveLength(1);
        expect(rows[0].screenshotReference).toBe('skarm1.png\nskarm2.png');
    });
});

describe('escape_for_csv med radbrytningar', () => {
    test('bevarar radbrytning i citerat fält', () => {
        expect(escape_for_csv('rad1\nrad2')).toBe('"rad1\nrad2"');
    });

    test('citerar fält med semikolon utan att ta bort radbrytning', () => {
        expect(escape_for_csv('a;b\nc')).toBe('"a;b\nc"');
    });
});

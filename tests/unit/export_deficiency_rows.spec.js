import {
    build_deficiencies_data,
    build_deficiency_column_defs,
    deficiency_row_to_flat_values
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

    test('build_deficiency_column_defs placerar screenshotReference efter observation', () => {
        const audit = {
            ruleFileContent: {
                metadata: {
                    taxonomies: [{
                        id: 'wcag22-pour',
                        concepts: [
                            { id: 'perceivable', label: 'Möjlig att uppfatta' },
                            { id: 'operable', label: 'Möjlig att hantera' }
                        ]
                    }]
                }
            }
        };
        const defs = build_deficiency_column_defs(t, false, audit);
        const keys = defs.map((def) => def.key);
        const obs_index = keys.indexOf('observation');
        const shot_index = keys.indexOf('screenshotReference');
        expect(obs_index).toBeGreaterThanOrEqual(0);
        expect(shot_index).toBe(obs_index + 1);
    });

    test('build_deficiency_column_defs skapar dynamiska taxonomikolumner', () => {
        const audit = {
            ruleFileContent: {
                metadata: {
                    taxonomies: [{
                        id: 'wcag22-pour',
                        concepts: [
                            { id: 'perceivable', label: 'Möjlig att uppfatta' },
                            { id: 'operable', label: 'Möjlig att hantera' }
                        ]
                    }]
                }
            }
        };
        const defs = build_deficiency_column_defs(t, false, audit);
        expect(defs.some((def) => def.key === 'taxonomy_perceivable')).toBe(true);
        expect(defs.some((def) => def.key === 'taxonomy_operable')).toBe(true);
        expect(defs.find((def) => def.key === 'taxonomy_perceivable')?.header).toBe('Möjlig att uppfatta');
    });

    test('build_deficiency_column_defs sätter deficiencyType-bredd till 48', () => {
        const defs = build_deficiency_column_defs(t, false);
        const def_type_col = defs.find((def) => def.key === 'deficiencyType');
        expect(def_type_col?.width).toBe(48);
    });

    test('build_deficiency_column_defs använder regelfil-override för rubriker', () => {
        const audit = {
            ruleFileContent: {
                metadata: { language: 'sv-SE' },
                appendix2: {
                    labelsByLocale: {
                        'sv-SE': {
                            generalInfo: [],
                            deficiencyColumns: [{ key: 'id', label: 'Eget ID' }],
                        },
                    },
                },
            },
        };
        const defs = build_deficiency_column_defs(t, false, audit);
        expect(defs.find((def) => def.key === 'id')?.header).toBe('Eget ID');
    });

    test('deficiency_row_to_flat_values inkluderar deficiencyType för CSV-export', () => {
        const primary_text = 'Fokusordningen är inkonsekvent och oförutsägbar.';
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
                                    { id: 'pc1', requirement: 'Kravtext', failureStatementTemplate: '' }
                                ]
                            }
                        ]
                    }
                }
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
                                            deficiencyId: 'B003',
                                            DeficiencyType: { PrimaryText: primary_text }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        };

        const column_defs = build_deficiency_column_defs(t, false);
        const column_keys = column_defs.map((def) => def.key);
        const type_index = column_keys.indexOf('deficiencyType');
        const rows = build_deficiencies_data(audit, t);
        const csv_values = deficiency_row_to_flat_values(rows[0], column_keys);

        expect(type_index).toBeGreaterThanOrEqual(0);
        expect(csv_values[type_index]).toBe(primary_text);

        const csv_line = csv_values.map((value) => escape_for_csv(value)).join(';');
        expect(csv_line).toContain(primary_text);
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

    test('build_deficiencies_data med exportcontext ger PTS-filnamn i en cell', () => {
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
                    requirementResults: {
                        req1: {
                            checkResults: {
                                chk1: {
                                    passCriteria: {
                                        pc1: {
                                            status: 'failed',
                                            deficiencyId: 'B047',
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

        const media_context = {
            audit_type_label: 'WEBB',
            granskning_sequence: 1,
            case_number: '26-11111',
            deficiency_id_part_width: 3,
            capture_dates: new Map([
                ['skarm1.png', '2026-04-11'],
                ['skarm2.png', '2026-04-12']
            ])
        };

        const rows = build_deficiencies_data(audit, t, media_context);
        expect(rows).toHaveLength(1);
        expect(rows[0].screenshotReference).toBe(
            '047_1_WEBB_1_2026-04-11_26-11111.png\n047_2_WEBB_1_2026-04-12_26-11111.png'
        );
        expect(rows[0].screenshotReference.split('\n')).toHaveLength(2);
    });

    test('build_deficiencies_data sätter deficiencyType från DeficiencyType.PrimaryText', () => {
        const primary_text = 'Semantiska element används inte där det behövs.';
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
                    requirementResults: {
                        req1: {
                            checkResults: {
                                chk1: {
                                    passCriteria: {
                                        pc1: {
                                            status: 'failed',
                                            deficiencyId: 'B001',
                                            DeficiencyType: {
                                                PrimaryText: primary_text,
                                                SecondaryText: 'Ska inte exporteras'
                                            }
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
        expect(rows[0].deficiencyType).toBe(primary_text);
    });

    test('build_deficiencies_data lämnar deficiencyType tom utan DeficiencyType-nod', () => {
        const audit = {
            ruleFileContent: {
                requirements: {
                    req1: {
                        key: 'req1',
                        title: 'Krav 1',
                        checks: [
                            {
                                id: 'chk1',
                                passCriteria: [{ id: 'pc1', requirement: 'Kravtext', failureStatementTemplate: '' }]
                            }
                        ]
                    }
                }
            },
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        req1: {
                            checkResults: {
                                chk1: {
                                    passCriteria: {
                                        pc1: { status: 'failed', deficiencyId: 'B001' }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        };

        const rows = build_deficiencies_data(audit, t);
        expect(rows[0].deficiencyType).toBe('');
    });

    test('build_deficiencies_data lämnar deficiencyType tom när PrimaryText saknas', () => {
        const audit = {
            ruleFileContent: {
                requirements: {
                    req1: {
                        key: 'req1',
                        title: 'Krav 1',
                        checks: [
                            {
                                id: 'chk1',
                                passCriteria: [{ id: 'pc1', requirement: 'Kravtext', failureStatementTemplate: '' }]
                            }
                        ]
                    }
                }
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
                                            DeficiencyType: {}
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
        expect(rows[0].deficiencyType).toBe('');
    });
});

describe('escape_for_csv med radbrytningar', () => {
    test('bevarar radbrytning i citerat fält', () => {
        expect(escape_for_csv('rad1\nrad2')).toBe('"rad1\nrad2"');
    });

    test('citerar fält med semikolon utan att ta bort radbrytning', () => {
        expect(escape_for_csv('a;b\nc')).toBe('"a;b\nc"');
    });

    test('citerar flera PTS-filnamn i samma CSV-fält', () => {
        const screenshot_reference =
            '047_1_WEBB_1_2026-04-11_26-11111.png\n047_2_WEBB_1_2026-04-12_26-11111.png';
        expect(escape_for_csv(screenshot_reference)).toBe(
            '"047_1_WEBB_1_2026-04-11_26-11111.png\n047_2_WEBB_1_2026-04-12_26-11111.png"'
        );
    });
});

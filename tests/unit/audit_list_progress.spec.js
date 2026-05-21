import {
    compute_audit_progress_percent,
    enrich_audits_with_live_progress,
    format_audit_row_progress_display,
    get_overall_audit_progress_summary,
    progress_percent_for_audit_row,
    progress_percent_sort_value
} from '../../js/logic/audit_list_progress.ts';

const minimal_rule = {
    requirements: {
        r1: { key: 'r1', id: 'r1', checks: [{ id: 'c1', passCriteria: [{ id: 'pc1' }] }] },
        r2: { key: 'r2', id: 'r2', checks: [{ id: 'c1', passCriteria: [{ id: 'pc1' }] }] }
    }
};

describe('audit_list_progress', () => {
    test('get_overall_audit_progress_summary returnerar null utan data', () => {
        expect(get_overall_audit_progress_summary(null)).toBeNull();
        expect(get_overall_audit_progress_summary({})).toBeNull();
    });

    test('samma procent som översikten (en decimal, inte heltalsavrundning)', () => {
        const state = {
            ruleFileContent: minimal_rule,
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        r1: {
                            checkResults: {
                                c1: { overallStatus: 'passed', passCriteria: { pc1: { status: 'passed' } } }
                            }
                        }
                    }
                }
            ]
        };
        const summary = get_overall_audit_progress_summary(state);
        expect(summary.audited).toBe(1);
        expect(summary.total).toBe(2);
        expect(summary.percent).toBe(50);
        expect(progress_percent_sort_value(summary)).toBe(50);
        expect(compute_audit_progress_percent(state)).toBe(50);
    });

    test('parsar samples om JSON-sträng', () => {
        const state = {
            ruleFileContent: minimal_rule,
            samples: JSON.stringify([
                {
                    id: 's1',
                    requirementResults: {
                        r1: {
                            checkResults: {
                                c1: { overallStatus: 'passed', passCriteria: { pc1: { status: 'passed' } } }
                            }
                        },
                        r2: {
                            checkResults: {
                                c1: { overallStatus: 'passed', passCriteria: { pc1: { status: 'passed' } } }
                            }
                        }
                    }
                }
            ])
        };
        expect(compute_audit_progress_percent(state)).toBe(100);
    });

    test('progress_percent_for_audit_row använder live state före API-värde', () => {
        const row = { id: 'audit-1', progress: 50 };
        const live = {
            auditId: 'audit-1',
            ruleFileContent: minimal_rule,
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        r1: {
                            checkResults: {
                                c1: { overallStatus: 'passed', passCriteria: { pc1: { status: 'passed' } } }
                            }
                        },
                        r2: {
                            checkResults: {
                                c1: { overallStatus: 'passed', passCriteria: { pc1: { status: 'passed' } } }
                            }
                        }
                    }
                }
            ]
        };
        expect(progress_percent_for_audit_row(row, live)).toBe(100);
        expect(progress_percent_for_audit_row(row, { auditId: 'other' })).toBe(50);
    });

    test('format_audit_row_progress_display följer live state', () => {
        const row = { id: 'a1', progress: 86 };
        const live = {
            auditId: 'a1',
            ruleFileContent: minimal_rule,
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        r1: {
                            checkResults: {
                                c1: { overallStatus: 'passed', passCriteria: { pc1: { status: 'passed' } } }
                            }
                        },
                        r2: {
                            checkResults: {
                                c1: { overallStatus: 'passed', passCriteria: { pc1: { status: 'passed' } } }
                            }
                        }
                    }
                }
            ]
        };
        expect(format_audit_row_progress_display(row, live, 'sv-SE')).toBe('100,0 %');
    });

    test('enrich_audits_with_live_progress uppdaterar endast matchande rad', () => {
        const rows = [
            { id: 'a1', progress: 10 },
            { id: 'a2', progress: 20 }
        ];
        const live = {
            auditId: 'a1',
            ruleFileContent: minimal_rule,
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        r1: {
                            checkResults: {
                                c1: { overallStatus: 'passed', passCriteria: { pc1: { status: 'passed' } } }
                            }
                        },
                        r2: {
                            checkResults: {
                                c1: { overallStatus: 'passed', passCriteria: { pc1: { status: 'passed' } } }
                            }
                        }
                    }
                }
            ]
        };
        const out = enrich_audits_with_live_progress(rows, live);
        expect(out[0].progress).toBe(100);
        expect(out[1].progress).toBe(20);
    });
});

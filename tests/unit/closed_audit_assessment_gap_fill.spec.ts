import { describe, expect, test } from '@jest/globals';
import {
    apply_closed_audit_assessment_gap_fill,
    audit_has_fully_assessed_relevant_requirements,
    count_incomplete_assessments_in_audit
} from '../../js/logic/closed_audit_assessment_gap_fill.js';
import { calculate_overall_audit_progress } from '../../js/logic/audit_logic_progress.js';
import { compute_audit_progress_percent } from '../../js/logic/audit_list_progress.js';

function make_state(overrides = {}) {
    const req_def = {
        key: 'krav_a',
        title: 'Krav A',
        checks: [
            {
                id: 'check_1',
                passCriteria: [
                    { id: 'pc_1' },
                    { id: 'pc_2' }
                ]
            },
            {
                id: 'check_2',
                passCriteria: [{ id: 'pc_3' }]
            }
        ]
    };
    return {
        auditStatus: 'locked',
        ruleFileContent: { requirements: { krav_a: req_def } },
        samples: [
            {
                id: 'sample_1',
                description: 'Stickprov',
                requirementResults: {
                    krav_a: {
                        checkResults: {
                            check_1: {
                                overallStatus: 'passed',
                                passCriteria: {
                                    pc_1: { status: 'failed', observationDetail: 'Brist' },
                                    pc_2: { status: 'not_audited' }
                                }
                            }
                        }
                    }
                }
            }
        ],
        ...overrides
    };
}

describe('apply_closed_audit_assessment_gap_fill', () => {
    test('hoppar över granskningar som inte är låsta eller arkiverade', () => {
        const state = make_state({ auditStatus: 'in_progress' });
        const out = apply_closed_audit_assessment_gap_fill(state as never);
        expect(out.changed).toBe(false);
    });

    test('sätter ogranskad kontrollpunkt till inte aktuellt', () => {
        const state = make_state();
        const out = apply_closed_audit_assessment_gap_fill(state as never);
        const check_2 = out.state.samples![0].requirementResults!.krav_a.checkResults!.check_2;
        expect(check_2.overallStatus).toBe('not_applicable');
        expect(out.stats.checks_set_not_applicable).toBe(1);
    });

    test('sätter ogjort kriterium till passed endast under Stämmer', () => {
        const state = make_state();
        const out = apply_closed_audit_assessment_gap_fill(state as never);
        const pc_2 = out.state.samples![0].requirementResults!.krav_a.checkResults!.check_1.passCriteria!.pc_2;
        expect(pc_2.status).toBe('passed');
        expect(out.stats.pass_criteria_set_passed).toBe(1);
    });

    test('rör inte befintligt underkänt kriterium', () => {
        const state = make_state();
        const out = apply_closed_audit_assessment_gap_fill(state as never);
        const pc_1 = out.state.samples![0].requirementResults!.krav_a.checkResults!.check_1.passCriteria!.pc_1;
        expect(pc_1.status).toBe('failed');
        expect(pc_1.observationDetail).toBe('Brist');
    });

    test('rör inte kontrollpunkt med overall failed', () => {
        const state = make_state({
            samples: [
                {
                    id: 'sample_1',
                    requirementResults: {
                        krav_a: {
                            checkResults: {
                                check_1: { overallStatus: 'failed', passCriteria: { pc_1: { status: 'not_audited' } } },
                                check_2: { overallStatus: 'not_applicable', passCriteria: {} }
                            }
                        }
                    }
                }
            ]
        });
        const out = apply_closed_audit_assessment_gap_fill(state as never);
        expect(out.state.samples![0].requirementResults!.krav_a.checkResults!.check_1.overallStatus).toBe('failed');
        expect(out.stats.checks_set_not_applicable).toBe(0);
    });

    test('fyller luckor så att delvis granskat krav blir fullt bedömt', () => {
        const state = make_state({
            samples: [
                {
                    id: 'sample_1',
                    requirementResults: {
                        krav_a: {
                            checkResults: {
                                check_1: {
                                    overallStatus: 'passed',
                                    passCriteria: { pc_1: { status: 'passed' }, pc_2: { status: 'not_audited' } }
                                },
                                check_2: { overallStatus: 'not_audited', passCriteria: {} }
                            }
                        }
                    }
                }
            ]
        });
        const before = compute_audit_progress_percent(state as never);
        const out = apply_closed_audit_assessment_gap_fill(state as never);
        const after = compute_audit_progress_percent(out.state as never);
        expect(before).toBeLessThan(100);
        expect(after).toBe(100);
        expect(calculate_overall_audit_progress(out.state as never).audited).toBe(
            calculate_overall_audit_progress(out.state as never).total
        );
        expect(count_incomplete_assessments_in_audit(out.state as never)).toEqual({
            partially_audited: 0,
            not_audited: 0
        });
        expect(audit_has_fully_assessed_relevant_requirements(out.state as never)).toBe(true);
    });
});

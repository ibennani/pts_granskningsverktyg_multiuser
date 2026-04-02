
import { jest } from '@jest/globals';
import {
    calculate_check_status,
    calculate_requirement_status,
    calculate_overall_audit_progress,
    calculate_sample_requirement_status_counts,
    calculate_overall_audit_status_counts,
    get_audit_last_updated_display_timestamp,
    compute_audit_last_updated_live_timestamp,
    requirement_results_equal_for_last_updated
} from '../../js/audit_logic.js';

describe('AuditLogic', () => {
    
    // Silence console.warn during these tests
    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Test calculate_check_status
    describe('calculate_check_status', () => {
        
        test('returns "passed" if check_object is null or has no pass criteria', () => {
            expect(calculate_check_status(null, {})).toBe('passed');
            expect(calculate_check_status({ passCriteria: [] }, {})).toBe('passed');
        });

        test('returns "failed" if overall_manual_status is "failed"', () => {
            expect(calculate_check_status({ passCriteria: [{id: 'pc1'}] }, {}, 'failed')).toBe('failed');
        });

        test('returns "not_audited" if overall_manual_status is "not_audited"', () => {
            expect(calculate_check_status({ passCriteria: [{id: 'pc1'}] }, {}, 'not_audited')).toBe('not_audited');
        });

        // Test AND logic (default)
        describe('AND logic (default)', () => {
            const checkDef = {
                id: 'check1',
                logic: 'AND',
                passCriteria: [ { id: 'pc1' }, { id: 'pc2' } ]
            };

            test('returns "failed" if any criterion is failed', () => {
                const pcStatuses = {
                    'pc1': { status: 'passed' },
                    'pc2': { status: 'failed' }
                };
                expect(calculate_check_status(checkDef, pcStatuses, 'passed')).toBe('failed');
            });

            test('returns "partially_audited" if any criterion is not_audited (and none failed)', () => {
                const pcStatuses = {
                    'pc1': { status: 'passed' },
                    'pc2': { status: 'not_audited' }
                };
                expect(calculate_check_status(checkDef, pcStatuses, 'passed')).toBe('partially_audited');
            });

            test('returns "passed" if all criteria are passed', () => {
                const pcStatuses = {
                    'pc1': { status: 'passed' },
                    'pc2': { status: 'passed' }
                };
                expect(calculate_check_status(checkDef, pcStatuses, 'passed')).toBe('passed');
            });
        });

        // Test OR logic
        describe('OR logic', () => {
            const checkDef = {
                id: 'check1',
                logic: 'OR',
                passCriteria: [ { id: 'pc1' }, { id: 'pc2' } ]
            };

            test('returns "passed" if at least one criterion is passed', () => {
                const pcStatuses = {
                    'pc1': { status: 'passed' },
                    'pc2': { status: 'failed' }
                };
                expect(calculate_check_status(checkDef, pcStatuses, 'passed')).toBe('passed');
            });

            test('returns "failed" if all audited criteria are failed (and none passed)', () => {
                const pcStatuses = {
                    'pc1': { status: 'failed' },
                    'pc2': { status: 'failed' }
                };
                expect(calculate_check_status(checkDef, pcStatuses, 'passed')).toBe('failed');
            });

            test('returns "partially_audited" if some not_audited and none passed', () => {
                const pcStatuses = {
                    'pc1': { status: 'failed' },
                    'pc2': { status: 'not_audited' }
                };
                expect(calculate_check_status(checkDef, pcStatuses, 'passed')).toBe('partially_audited');
            });

            test('returns "partially_audited" if all criteria not_audited but user selected Stämmer (at least one button selected)', () => {
                const pcStatuses = {
                    'pc1': { status: 'not_audited' },
                    'pc2': { status: 'not_audited' }
                };
                expect(calculate_check_status(checkDef, pcStatuses, 'passed')).toBe('partially_audited');
            });
        });
    });

    // Test calculate_requirement_status
    describe('calculate_requirement_status', () => {
        test('returns "not_audited" for invalid inputs', () => {
            expect(calculate_requirement_status(null, {})).toBe('not_audited');
            expect(calculate_requirement_status(undefined, {})).toBe('not_audited');
            expect(calculate_requirement_status({}, null)).toBe('not_audited');
            expect(calculate_requirement_status({}, undefined)).toBe('not_audited');
        });

        test('tom checks-array använder resultatets status om den finns', () => {
            const reqDef = { checks: [] };
            const reqResult = { status: 'passed', checkResults: {} };
            expect(calculate_requirement_status(reqDef, reqResult)).toBe('passed');
        });

        test('returns "failed" if any check is failed', () => {
            const reqDefWithDetails = {
                checks: [
                    { id: 'check1', passCriteria: [] },
                    { 
                        id: 'check2', 
                        passCriteria: [{ id: 'pc1' }] 
                    }
                ]
            };
            
            const reqResult = {
                checkResults: {
                    'check1': { overallStatus: 'passed', passCriteria: {} },
                    'check2': { 
                        overallStatus: 'passed', 
                        passCriteria: { 'pc1': { status: 'failed' } } 
                    } 
                }
            };

            expect(calculate_requirement_status(reqDefWithDetails, reqResult)).toBe('failed');
        });

        test('returns "passed" if all checks are passed', () => {
            const reqDef = {
                checks: [{ id: 'c1', passCriteria: [] }]
            };
            const reqResult = {
                checkResults: {
                    'c1': { overallStatus: 'passed', passCriteria: {} }
                }
            };
            expect(calculate_requirement_status(reqDef, reqResult)).toBe('passed');
        });

        test('returns "partially_audited" when user selected Stämmer but no pass criteria assessed', () => {
            const reqDef = {
                checks: [{
                    id: 'check1',
                    logic: 'OR',
                    passCriteria: [{ id: 'pc1' }, { id: 'pc2' }]
                }]
            };
            const reqResult = {
                checkResults: {
                    'check1': {
                        overallStatus: 'passed',
                        passCriteria: {
                            'pc1': { status: 'not_audited' },
                            'pc2': { status: 'not_audited' }
                        }
                    }
                }
            };
            expect(calculate_requirement_status(reqDef, reqResult)).toBe('partially_audited');
        });
    });

    describe('calculate_overall_audit_progress', () => {
        test('returnerar noll vid null, undefined eller tomma stickprov', () => {
            expect(calculate_overall_audit_progress(null)).toEqual({ audited: 0, total: 0 });
            expect(calculate_overall_audit_progress(undefined)).toEqual({ audited: 0, total: 0 });
            expect(
                calculate_overall_audit_progress({
                    samples: [],
                    ruleFileContent: { requirements: { r1: { id: 'r1', title: 'T', checks: [] } } }
                })
            ).toEqual({ audited: 0, total: 0 });
        });
    });

    const minimal_rule_file = {
        requirements: {
            r1: { key: 'r1', id: 'r1', title: 'Krav 1', checks: [{ id: 'c1', passCriteria: [{ id: 'pc1' }], passCriteriaLogic: 'AND' }] },
            r2: { key: 'r2', id: 'r2', title: 'Krav 2', checks: [{ id: 'c1', passCriteria: [{ id: 'pc1' }], passCriteriaLogic: 'AND' }] }
        }
    };

    describe('calculate_sample_requirement_status_counts', () => {
        test('returnerar noll vid saknad data', () => {
            expect(calculate_sample_requirement_status_counts(null, {})).toEqual({
                passed: 0, partially_audited: 0, failed: 0, not_audited: 0, total: 0
            });
            expect(calculate_sample_requirement_status_counts(minimal_rule_file, null)).toEqual({
                passed: 0, partially_audited: 0, failed: 0, not_audited: 0, total: 0
            });
        });

        test('räknar fyra statusar för ett stickprov', () => {
            const sample = {
                id: 's1',
                requirementResults: {
                    r1: {
                        status: 'passed',
                        checkResults: {
                            c1: {
                                overallStatus: 'passed',
                                passCriteria: { pc1: { status: 'passed' } }
                            }
                        }
                    },
                    r2: {
                        status: 'failed',
                        checkResults: {
                            c1: {
                                overallStatus: 'failed',
                                passCriteria: { pc1: { status: 'failed' } }
                            }
                        }
                    }
                }
            };
            const counts = calculate_sample_requirement_status_counts(minimal_rule_file, sample);
            expect(counts.total).toBe(2);
            expect(counts.passed).toBe(1);
            expect(counts.failed).toBe(1);
            expect(counts.partially_audited).toBe(0);
            expect(counts.not_audited).toBe(0);
        });
    });

    describe('calculate_overall_audit_status_counts', () => {
        test('returnerar noll vid null eller tom lista', () => {
            expect(calculate_overall_audit_status_counts(null)).toEqual({
                passed: 0, partially_audited: 0, failed: 0, not_audited: 0, total: 0
            });
            expect(
                calculate_overall_audit_status_counts({
                    samples: [],
                    ruleFileContent: minimal_rule_file
                })
            ).toEqual({
                passed: 0, partially_audited: 0, failed: 0, not_audited: 0, total: 0
            });
        });

        test('summerar över flera stickprov', () => {
            const audit = {
                ruleFileContent: minimal_rule_file,
                samples: [
                    {
                        id: 'a',
                        requirementResults: {
                            r1: {
                                status: 'passed',
                                checkResults: {
                                    c1: { overallStatus: 'passed', passCriteria: { pc1: { status: 'passed' } } }
                                }
                            },
                            r2: {
                                status: 'not_audited',
                                checkResults: {
                                    c1: { overallStatus: 'not_audited', passCriteria: { pc1: { status: 'not_audited' } } }
                                }
                            }
                        }
                    },
                    {
                        id: 'b',
                        requirementResults: {
                            r1: {
                                status: 'passed',
                                checkResults: {
                                    c1: { overallStatus: 'passed', passCriteria: { pc1: { status: 'passed' } } }
                                }
                            },
                            r2: {
                                status: 'failed',
                                checkResults: {
                                    c1: { overallStatus: 'failed', passCriteria: { pc1: { status: 'failed' } } }
                                }
                            }
                        }
                    }
                ]
            };
            const c = calculate_overall_audit_status_counts(audit);
            expect(c.total).toBe(4);
            expect(c.passed).toBe(2);
            expect(c.failed).toBe(1);
            expect(c.not_audited).toBe(1);
            expect(c.partially_audited).toBe(0);
        });
    });

    describe('requirement_results_equal_for_last_updated', () => {
        test('returnerar true när endast lastStatusUpdate skiljer', () => {
            const base = { status: 'passed', checkResults: {}, commentToAuditor: '', commentToActor: '', stuckProblemDescription: '' };
            expect(requirement_results_equal_for_last_updated(
                { ...base, lastStatusUpdate: '2020-01-01T00:00:00.000Z', lastStatusUpdateBy: 'A' },
                { ...base, lastStatusUpdate: '2025-01-01T00:00:00.000Z', lastStatusUpdateBy: 'B' }
            )).toBe(true);
        });

        test('returnerar false när observation innehåll ändrats', () => {
            const a = { status: 'passed', checkResults: { c1: { passCriteria: { pc1: { observationDetail: 'x' } } } } };
            const b = { status: 'passed', checkResults: { c1: { passCriteria: { pc1: { observationDetail: 'y' } } } } };
            expect(requirement_results_equal_for_last_updated(a, b)).toBe(false);
        });
    });

    describe('get_audit_last_updated_display_timestamp', () => {
        test('returnerar null när inga tidsstämplar eller metadata-fält finns', () => {
            expect(get_audit_last_updated_display_timestamp(null)).toBeNull();
            expect(get_audit_last_updated_display_timestamp({ samples: [] })).toBeNull();
        });

        test('använder endast observationstidsstämplar när metadata-fält saknas', () => {
            const ts = '2025-06-01T10:00:00.000Z';
            const state = {
                samples: [{
                    id: 's1',
                    requirementResults: {
                        r1: {
                            lastStatusUpdate: ts,
                            checkResults: {}
                        }
                    }
                }]
            };
            expect(get_audit_last_updated_display_timestamp(state)).toBe(ts);
        });

        test('använder endast auditLastNonObservationActivityAt när inga observationer finns', () => {
            const meta_ts = '2025-07-15T12:30:00.000Z';
            const state = {
                samples: [],
                auditLastNonObservationActivityAt: meta_ts
            };
            expect(get_audit_last_updated_display_timestamp(state)).toBe(meta_ts);
        });

        test('väljer senaste av observation och metadata-tidsstämpel', () => {
            const older = '2025-01-01T00:00:00.000Z';
            const newer = '2025-12-31T23:59:59.999Z';
            const state_samples_only = {
                samples: [{
                    id: 's1',
                    requirementResults: {
                        r1: {
                            lastStatusUpdate: older,
                            checkResults: {}
                        }
                    }
                }],
                auditLastNonObservationActivityAt: newer
            };
            expect(get_audit_last_updated_display_timestamp(state_samples_only)).toBe(newer);

            const state_obs_newer = {
                samples: [{
                    id: 's1',
                    requirementResults: {
                        r1: {
                            lastStatusUpdate: newer,
                            checkResults: {}
                        }
                    }
                }],
                auditLastNonObservationActivityAt: older
            };
            expect(get_audit_last_updated_display_timestamp(state_obs_newer)).toBe(newer);
        });

        test('låst eller arkiverat med fryst värde ignorerar nyare observationstidsstämplar', () => {
            const frozen = '2020-01-01T12:00:00.000Z';
            const newer = '2025-06-15T08:00:00.000Z';
            const base_samples = {
                samples: [{
                    id: 's1',
                    requirementResults: {
                        r1: {
                            lastStatusUpdate: newer,
                            checkResults: {}
                        }
                    }
                }],
                auditLastUpdatedAtFrozen: frozen
            };
            expect(get_audit_last_updated_display_timestamp({ ...base_samples, auditStatus: 'locked' })).toBe(frozen);
            expect(get_audit_last_updated_display_timestamp({ ...base_samples, auditStatus: 'archived' })).toBe(frozen);
        });

        test('compute_audit_last_updated_live_timestamp används för max av observation och metadata', () => {
            expect(compute_audit_last_updated_live_timestamp({
                samples: [],
                auditLastNonObservationActivityAt: '2024-01-01T00:00:00.000Z'
            })).toBe('2024-01-01T00:00:00.000Z');
        });
    });

});

import { jest } from '@jest/globals';
import { requirement_results_equal_for_last_updated } from '../../js/logic/audit_logic_recalc.js';
import { RequirementAuditComponent } from '../../js/components/RequirementAuditComponent.js';

describe('Kravvy visning utan oavsiktlig mutering och tvingad sparning', () => {
    describe('requirement_results_equal_for_last_updated', () => {
        test('returnerar true när databasdata med utelämnade standardfält jämförs med minnesexpanderade standardfält', () => {
            const fromStore = {
                status: 'passed',
                checkResults: {
                    '1': {
                        overallStatus: 'passed',
                        status: 'passed',
                        passCriteria: {
                            '1.1': {
                                status: 'passed'
                            }
                        }
                    }
                }
            };

            const inMemoryExpanded = {
                status: 'passed',
                commentToAuditor: '',
                commentToActor: '',
                stuckProblemDescription: '',
                lastStatusUpdate: '2026-08-19T10:00:00.000Z',
                lastStatusUpdateBy: 'Användare A',
                checkResults: {
                    '1': {
                        overallStatus: 'passed',
                        status: 'passed',
                        timestamp: null,
                        updatedBy: null,
                        passCriteria: {
                            '1.1': {
                                status: 'passed',
                                observationDetail: '',
                                timestamp: null,
                                updatedBy: null,
                                attachedMediaFilenames: []
                            },
                            '1.2': {
                                status: 'not_audited',
                                observationDetail: '',
                                timestamp: null,
                                updatedBy: null,
                                attachedMediaFilenames: []
                            }
                        }
                    }
                }
            };

            expect(requirement_results_equal_for_last_updated(fromStore, inMemoryExpanded)).toBe(true);
        });

        test('returnerar true när passCriteria var lagrat som ren status-sträng', () => {
            const fromStore = {
                status: 'not_audited',
                checkResults: {
                    '1': {
                        overallStatus: 'not_audited',
                        status: 'not_audited',
                        passCriteria: {
                            '1.1': 'not_audited'
                        }
                    }
                }
            };

            const inMemory = {
                status: 'not_audited',
                checkResults: {
                    '1': {
                        overallStatus: 'not_audited',
                        status: 'not_audited',
                        passCriteria: {
                            '1.1': {
                                status: 'not_audited',
                                observationDetail: '',
                                timestamp: null,
                                attachedMediaFilenames: []
                            }
                        }
                    }
                }
            };

            expect(requirement_results_equal_for_last_updated(fromStore, inMemory)).toBe(true);
        });

        test('returnerar false när användaren faktiskt skrivit en observation', () => {
            const fromStore = {
                status: 'failed',
                checkResults: {
                    '1': {
                        overallStatus: 'passed',
                        status: 'failed',
                        passCriteria: {
                            '1.1': {
                                status: 'failed',
                                observationDetail: ''
                            }
                        }
                    }
                }
            };

            const edited = {
                status: 'failed',
                checkResults: {
                    '1': {
                        overallStatus: 'passed',
                        status: 'failed',
                        passCriteria: {
                            '1.1': {
                                status: 'failed',
                                observationDetail: 'Knappen saknar tillgängligt namn'
                            }
                        }
                    }
                }
            };

            expect(requirement_results_equal_for_last_updated(fromStore, edited)).toBe(false);
        });

        test('returnerar false när användaren ändrat en status', () => {
            const fromStore = {
                status: 'not_audited',
                checkResults: {}
            };

            const edited = {
                status: 'passed',
                checkResults: {
                    '1': {
                        overallStatus: 'passed',
                        status: 'passed',
                        passCriteria: {
                            '1.1': {
                                status: 'passed'
                            }
                        }
                    }
                }
            };

            expect(requirement_results_equal_for_last_updated(fromStore, edited)).toBe(false);
        });
    });

    describe('RequirementAuditComponent flush_before_leave', () => {
        test('hoppar över sparning och ändrar inte lastStatusUpdate vid ren visning utan ändringar', () => {
            const initialTs = '2026-08-17T12:00:00.000Z';
            const initialUser = 'Ursprunglig Granskare';

            const comp = new RequirementAuditComponent();
            comp.params = { sampleId: '1', requirementId: 'req_alt_text' };
            comp.requirement_map_key = 'req_alt_text';
            comp.plate_element_ref = document.createElement('div');

            const storedReqResult = {
                status: 'passed',
                lastStatusUpdate: initialTs,
                lastStatusUpdateBy: initialUser,
                checkResults: {
                    '1': {
                        overallStatus: 'passed',
                        status: 'passed',
                        passCriteria: {
                            '1.1': { status: 'passed' }
                        }
                    }
                }
            };

            comp.getState = () => ({
                samples: [{
                    id: '1',
                    requirementResults: {
                        req_alt_text: storedReqResult
                    }
                }]
            });

            comp.current_requirement = {
                checks: [{
                    id: '1',
                    passCriteria: [{ id: '1.1' }]
                }]
            };

            comp.current_result = {
                status: 'passed',
                commentToAuditor: '',
                commentToActor: '',
                stuckProblemDescription: '',
                lastStatusUpdate: initialTs,
                lastStatusUpdateBy: initialUser,
                checkResults: {
                    '1': {
                        overallStatus: 'passed',
                        status: 'passed',
                        passCriteria: {
                            '1.1': {
                                status: 'passed',
                                observationDetail: '',
                                timestamp: null,
                                attachedMediaFilenames: []
                            }
                        }
                    }
                }
            };

            comp.AuditLogic = {
                calculate_check_status: () => 'passed',
                calculate_requirement_status: () => 'passed',
                requirement_results_equal_for_last_updated
            };
            comp.Helpers = {
                get_current_iso_datetime_utc: () => '2026-08-19T14:00:00.000Z'
            };
            comp.StoreActionTypes = { UPDATE_REQUIREMENT_RESULT: 'UPDATE_REQUIREMENT_RESULT' };
            comp.dispatch = jest.fn(() => Promise.resolve());

            const saved = comp.flush_before_leave();

            expect(saved).toBe(false);
            expect(comp.dispatch).not.toHaveBeenCalled();
            expect(comp.current_result.lastStatusUpdate).toBe(initialTs);
            expect(comp.current_result.lastStatusUpdateBy).toBe(initialUser);
        });

        test('sparar och uppdaterar lastStatusUpdate om användaren faktiskt skrivit text', () => {
            const initialTs = '2026-08-17T12:00:00.000Z';
            const newTs = '2026-08-19T14:00:00.000Z';

            const comp = new RequirementAuditComponent();
            comp.params = { sampleId: '1', requirementId: 'req_alt_text' };
            comp.requirement_map_key = 'req_alt_text';
            comp.plate_element_ref = document.createElement('div');

            const storedReqResult = {
                status: 'failed',
                lastStatusUpdate: initialTs,
                lastStatusUpdateBy: 'Ursprunglig Granskare',
                checkResults: {
                    '1': {
                        overallStatus: 'passed',
                        status: 'failed',
                        passCriteria: {
                            '1.1': { status: 'failed', observationDetail: '' }
                        }
                    }
                }
            };

            comp.getState = () => ({
                samples: [{
                    id: '1',
                    requirementResults: {
                        req_alt_text: storedReqResult
                    }
                }]
            });

            comp.current_requirement = {
                checks: [{
                    id: '1',
                    passCriteria: [{ id: '1.1' }]
                }]
            };

            // Användaren har skrivit en kommentar i DOM
            comp.current_result = {
                status: 'failed',
                commentToAuditor: '',
                commentToActor: '',
                stuckProblemDescription: '',
                lastStatusUpdate: initialTs,
                lastStatusUpdateBy: 'Ursprunglig Granskare',
                checkResults: {
                    '1': {
                        overallStatus: 'passed',
                        status: 'failed',
                        passCriteria: {
                            '1.1': {
                                status: 'failed',
                                observationDetail: 'Ny upptäckt brist i formuläret',
                                timestamp: null,
                                attachedMediaFilenames: []
                            }
                        }
                    }
                }
            };

            comp.AuditLogic = {
                calculate_check_status: () => 'failed',
                calculate_requirement_status: () => 'failed',
                requirement_results_equal_for_last_updated
            };
            comp.Helpers = {
                get_current_iso_datetime_utc: () => newTs
            };
            comp.StoreActionTypes = { UPDATE_REQUIREMENT_RESULT: 'UPDATE_REQUIREMENT_RESULT' };
            comp.dispatch = jest.fn(() => Promise.resolve(true));

            const saved = comp.flush_before_leave();

            expect(saved).toBe(true);
            expect(comp.current_result.lastStatusUpdate).toBe(newTs);
        });
    });
});

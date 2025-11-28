
import { jest } from '@jest/globals';
import {
    calculate_check_status,
    calculate_requirement_status
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

            test('returns "not_audited" if all are not_audited', () => {
                const pcStatuses = {
                    'pc1': { status: 'not_audited' },
                    'pc2': { status: 'not_audited' }
                };
                expect(calculate_check_status(checkDef, pcStatuses, 'passed')).toBe('not_audited');
            });
        });
    });

    // Test calculate_requirement_status
    describe('calculate_requirement_status', () => {
        test('returns "not_audited" for invalid inputs', () => {
            expect(calculate_requirement_status(null, {})).toBe('not_audited');
            expect(calculate_requirement_status({}, null)).toBe('not_audited');
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
    });

});

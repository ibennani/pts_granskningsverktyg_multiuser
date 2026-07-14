/**
 * Tester för atomisk apply av Word-import.
 */
import { describe, test, expect } from '@jest/globals';
import { ActionTypes } from '../../js/state/actionTypes.ts';
import { auditReducer } from '../../js/state/auditReducer.ts';

function create_locked_audit() {
    return {
        auditStatus: 'locked',
        ruleFileContent: {
            requirements: {
                req1: {
                    id: 'req1',
                    title: 'Krav 1',
                    checks: [{
                        id: 'check1',
                        logic: 'AND',
                        passCriteria: [
                            { id: 'pc1', requirement: 'Kravtext' },
                            { id: 'pc2', requirement: 'Kravtext 2' },
                        ],
                    }],
                },
            },
        },
        samples: [{
            id: 's1',
            requirementResults: {
                req1: {
                    status: 'failed',
                    checkResults: {
                        check1: {
                            overallStatus: 'passed',
                            passCriteria: {
                                pc1: {
                                    status: 'failed',
                                    deficiencyId: 'B3',
                                    observationDetail: 'Gammal',
                                },
                                pc2: {
                                    status: 'failed',
                                    deficiencyId: 'B7',
                                    observationDetail: 'Ska bort',
                                },
                            },
                        },
                    },
                },
            },
        }],
    };
}

describe('APPLY_OBSERVATION_WORD_IMPORT', () => {
    test('uppdaterar text och rensar brist som saknas i Word', () => {
        const state = create_locked_audit();
        const next = auditReducer(state, {
            type: ActionTypes.APPLY_OBSERVATION_WORD_IMPORT,
            payload: {
                changes: [
                    {
                        sample_id: 's1',
                        requirement_id: 'req1',
                        check_id: 'check1',
                        pc_id: 'pc1',
                        action: 'update_text',
                        observation_detail: 'Ny text',
                    },
                    {
                        sample_id: 's1',
                        requirement_id: 'req1',
                        check_id: 'check1',
                        pc_id: 'pc2',
                        action: 'clear_deficiency',
                    },
                ],
            },
        });

        const pc1 = next.samples[0].requirementResults.req1.checkResults.check1.passCriteria.pc1;
        const pc2 = next.samples[0].requirementResults.req1.checkResults.check1.passCriteria.pc2;
        expect(pc1.observationDetail).toBe('Ny text');
        expect(pc1.status).toBe('failed');
        expect(pc1.deficiencyId).toBe('B3');
        expect(pc2.status).toBe('passed');
        expect(pc2.observationDetail).toBe('');
        expect(pc2.deficiencyId).toBeUndefined();
    });

    test('gör inget när granskningen är arkiverad', () => {
        const state = { ...create_locked_audit(), auditStatus: 'archived' };
        const next = auditReducer(state, {
            type: ActionTypes.APPLY_OBSERVATION_WORD_IMPORT,
            payload: { changes: [] },
        });
        expect(next).toBe(state);
    });
});

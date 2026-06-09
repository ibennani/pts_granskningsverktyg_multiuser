import { map_samples_bulk_pass_fully_unreviewed_only } from '../../js/state/audit_reducer_bulk_pass.js';

describe('audit_reducer_bulk_pass', () => {
    const timestamp = '2000-01-01T00:00:00.000Z';

    test('uppdaterar not_audited och fyller luckor i partially_audited', () => {
        const req_a = {
            key: 'A',
            id: 'A',
            title: 'Krav A',
            checks: [
                {
                    id: 'c1',
                    logic: 'AND',
                    passCriteria: [{ id: 'pc1' }]
                }
            ]
        };
        const req_b = {
            key: 'B',
            id: 'B',
            title: 'Krav B',
            checks: [
                {
                    id: 'c2',
                    logic: 'AND',
                    passCriteria: [{ id: 'pc2' }]
                }
            ]
        };
        const requirements = { A: req_a, B: req_b };
        const state = {
            ruleFileContent: { requirements },
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        A: {
                            status: 'not_audited',
                            commentToAuditor: '',
                            commentToActor: '',
                            lastStatusUpdate: null,
                            stuckProblemDescription: '',
                            checkResults: {}
                        },
                        B: {
                            status: 'partially_audited',
                            commentToAuditor: '',
                            commentToActor: '',
                            lastStatusUpdate: null,
                            stuckProblemDescription: 'x',
                            checkResults: {
                                c2: {
                                    status: 'partially_audited',
                                    overallStatus: 'passed',
                                    passCriteria: {
                                        pc2: {
                                            status: 'not_audited',
                                            observationDetail: '',
                                            timestamp: null,
                                            attachedMediaFilenames: []
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        };

        const out = map_samples_bulk_pass_fully_unreviewed_only(
            state,
            { target_sample_id: 's1', requirement_id: null },
            timestamp,
            'testare'
        );

        expect(out[0].requirementResults.A.status).toBe('passed');
        expect(out[0].requirementResults.B.status).toBe('passed');
        expect(out[0].requirementResults.B.stuckProblemDescription).toBe('');
        expect(out[0].requirementResults.B.checkResults.c2.passCriteria.pc2.status).toBe('passed');
    });

    test('requirement_id begränsar till ett krav över alla stickprov', () => {
        const req = {
            key: 'R1',
            id: 'R1',
            title: 'Ett',
            checks: [{ id: 'ch', logic: 'AND', passCriteria: [{ id: 'pc' }] }]
        };
        const requirements = { R1: req };
        const state = {
            ruleFileContent: { requirements },
            samples: [
                {
                    id: 'a',
                    requirementResults: {
                        R1: { status: 'not_audited', checkResults: {}, commentToAuditor: '', commentToActor: '', lastStatusUpdate: null, stuckProblemDescription: '' }
                    }
                },
                {
                    id: 'b',
                    requirementResults: {
                        R1: { status: 'not_audited', checkResults: {}, commentToAuditor: '', commentToActor: '', lastStatusUpdate: null, stuckProblemDescription: '' }
                    }
                }
            ]
        };
        const out = map_samples_bulk_pass_fully_unreviewed_only(
            state,
            { target_sample_id: null, requirement_id: 'R1' },
            timestamp,
            ''
        );
        expect(out[0].requirementResults.R1.status).toBe('passed');
        expect(out[1].requirementResults.R1.status).toBe('passed');
    });

    test('sätter ohanterad kontrollpunkt till inte aktuellt i partially_audited krav', () => {
        const req = {
            key: 'R1',
            id: 'R1',
            title: 'Delvis',
            checks: [
                { id: 'c_done', logic: 'AND', passCriteria: [{ id: 'pc1' }] },
                { id: 'c_open', logic: 'AND', passCriteria: [{ id: 'pc2' }] }
            ]
        };
        const state = {
            ruleFileContent: { requirements: { R1: req } },
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        R1: {
                            status: 'partially_audited',
                            checkResults: {
                                c_done: {
                                    overallStatus: 'passed',
                                    passCriteria: {
                                        pc1: { status: 'passed', observationDetail: '', timestamp: null, attachedMediaFilenames: [] }
                                    }
                                }
                            },
                            commentToAuditor: '',
                            commentToActor: '',
                            lastStatusUpdate: null,
                            stuckProblemDescription: ''
                        }
                    }
                }
            ]
        };
        const out = map_samples_bulk_pass_fully_unreviewed_only(
            state,
            { target_sample_id: 's1', requirement_id: null },
            timestamp,
            'testare'
        );
        expect(out[0].requirementResults.R1.checkResults.c_open.overallStatus).toBe('not_applicable');
        expect(out[0].requirementResults.R1.status).toBe('passed');
    });
});

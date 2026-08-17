/**
 * @fileoverview Tester för exkludering av krav med alla kontrollpunkter «Inte aktuellt» i bristindex.
 */

import { describe, test, expect } from '@jest/globals';
import { calculateQualityScore } from '../../js/logic/ScoreCalculator.js';
import { is_requirement_excluded_from_deficiency_index } from '../../js/logic/score_calculator_requirement_inclusion.js';

const mock_taxonomy = {
    id: 'wcag22-pour',
    concepts: [{ id: 'perceivable', label: 'Perceivable' }],
};

const mock_requirement = {
    id: 'req_1',
    key: 'req_1',
    checks: [{ id: 'check_1', passCriteria: [{ id: 'pc_1' }] }],
    metadata: {
        impact: { isCritical: true, primaryScore: 10, secondaryScore: 0 },
    },
    classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'perceivable' }],
    contentType: ['web'],
};

const mock_rule_file = {
    metadata: { taxonomies: [mock_taxonomy] },
    requirements: { req_1: mock_requirement },
};

describe('is_requirement_excluded_from_deficiency_index', () => {
    test('returnerar true när alla kontrollpunkter är inte aktuella', () => {
        const req_result = {
            checkResults: {
                check_1: { overallStatus: 'not_applicable', passCriteria: {} },
            },
        };
        expect(is_requirement_excluded_from_deficiency_index(mock_requirement, req_result)).toBe(true);
    });

    test('returnerar false vid blandad bedömning', () => {
        const req_def = {
            ...mock_requirement,
            checks: [
                { id: 'check_1', passCriteria: [] },
                { id: 'check_2', passCriteria: [] },
            ],
        };
        const req_result = {
            checkResults: {
                check_1: { overallStatus: 'not_applicable', passCriteria: {} },
                check_2: { overallStatus: 'passed', passCriteria: {} },
            },
        };
        expect(is_requirement_excluded_from_deficiency_index(req_def, req_result)).toBe(false);
    });

    test('returnerar false utan kontrollpunkter i regelfilen', () => {
        const req_def = { ...mock_requirement, checks: [] };
        const req_result = {
            checkResults: {
                check_1: { overallStatus: 'not_applicable', passCriteria: {} },
            },
        };
        expect(is_requirement_excluded_from_deficiency_index(req_def, req_result)).toBe(false);
    });
});

describe('calculateQualityScore not_applicable i maxvikt', () => {
    test('räknar krav helt inte aktuella med i maxvikt utan avdrag', () => {
        const state_with_na = {
            ruleFileContent: mock_rule_file,
            samples: [
                {
                    id: 's1',
                    selectedContentTypes: ['web'],
                    requirementResults: {
                        req_1: {
                            checkResults: {
                                check_1: { overallStatus: 'not_applicable', passCriteria: {} },
                            },
                        },
                    },
                },
            ],
        };

        const result = calculateQualityScore(state_with_na);
        expect(result.totalScore).toBe(0);
    });

    test('späder ut bristindex när inte aktuella krav väger tungt i maxvikt', () => {
        const req_na = { ...mock_requirement, id: 'req_na', key: 'req_na' };
        const req_fail = {
            ...mock_requirement,
            id: 'req_fail',
            key: 'req_fail',
            checks: [{ id: 'check_1', passCriteria: [{ id: 'pc_1' }] }],
        };
        const state = {
            ruleFileContent: {
                metadata: { taxonomies: [mock_taxonomy] },
                requirements: { req_na, req_fail },
            },
            samples: [
                {
                    id: 's1',
                    selectedContentTypes: ['web'],
                    requirementResults: {
                        req_na: {
                            checkResults: {
                                check_1: { overallStatus: 'not_applicable', passCriteria: {} },
                            },
                        },
                        req_fail: {
                            checkResults: {
                                check_1: {
                                    overallStatus: 'passed',
                                    passCriteria: { pc_1: { status: 'failed' } },
                                },
                            },
                        },
                    },
                },
            ],
        };

        const result = calculateQualityScore(state);
        expect(result.totalScore).toBe(50);
    });

    test('räknar fortfarande med krav som har minst en stämmer-kontrollpunkt', () => {
        const req_with_two_checks = {
            ...mock_requirement,
            checks: [
                { id: 'check_1', passCriteria: [{ id: 'pc_1' }] },
                { id: 'check_2', passCriteria: [{ id: 'pc_2' }] },
            ],
        };
        const state = {
            ruleFileContent: {
                ...mock_rule_file,
                requirements: { req_1: req_with_two_checks },
            },
            samples: [
                {
                    id: 's1',
                    selectedContentTypes: ['web'],
                    requirementResults: {
                        req_1: {
                            checkResults: {
                                check_1: { overallStatus: 'not_applicable', passCriteria: {} },
                                check_2: {
                                    overallStatus: 'passed',
                                    passCriteria: { pc_2: { status: 'failed' } },
                                },
                            },
                        },
                    },
                },
            ],
        };

        const result = calculateQualityScore(state);
        expect(result.totalScore).toBe(100);
    });
});


import { jest } from '@jest/globals';
import { calculateQualityScore } from '../../js/logic/ScoreCalculator.js';

describe('ScoreCalculator', () => {
    // Mock data setup
    const mockTaxonomy = {
        id: 'wcag22-pour',
        concepts: [
            { id: 'perceivable', label: 'Perceivable' },
            { id: 'operable', label: 'Operable' },
            { id: 'understandable', label: 'Understandable' },
            { id: 'robust', label: 'Robust' }
        ]
    };

    const mockRequirement = {
        id: 'req_1',
        key: 'req_1',
        metadata: {
            impact: { isCritical: true, primaryScore: 10, secondaryScore: 5 }
        },
        classifications: [
            { taxonomyId: 'wcag22-pour', conceptId: 'perceivable' }
        ],
        contentType: ['web']
    };

    const mockRuleFileContent = {
        metadata: {
            taxonomies: [mockTaxonomy]
        },
        requirements: {
            'req_1': mockRequirement
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Silence console warnings for negative tests
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    test('returns fallback analysis if auditState is invalid', () => {
        const result1 = calculateQualityScore(null);
        expect(result1).not.toBeNull();
        expect(result1.totalScore).toBe(0);
        expect(result1.sampleCount).toBe(0);
        expect(result1.principles?.perceivable?.score).toBe(0);

        const result2 = calculateQualityScore({});
        expect(result2).not.toBeNull();
        expect(result2.totalScore).toBe(0);
        expect(result2.sampleCount).toBe(0);
        expect(result2.principles?.perceivable?.score).toBe(0);
    });

    test('returns fallback analysis if requirements or taxonomies are missing', () => {
        const result1 = calculateQualityScore({ ruleFileContent: {} });
        expect(result1).not.toBeNull();
        expect(result1.totalScore).toBe(0);
        expect(result1.principles?.perceivable?.score).toBe(0);

        const result2 = calculateQualityScore({ ruleFileContent: { requirements: {} } });
        expect(result2).not.toBeNull();
        expect(result2.totalScore).toBe(0);
        expect(result2.principles?.perceivable?.score).toBe(0);
    });

    test('returns score 0 if no samples exist', () => {
        const state = {
            ruleFileContent: mockRuleFileContent,
            samples: []
        };
        const result = calculateQualityScore(state);
        expect(result).not.toBeNull();
        expect(result.totalScore).toBe(0);
        expect(result.sampleCount).toBe(0);
        expect(result.principles?.perceivable?.score).toBe(0);
    });

    test('calculates score 0 for perfect audit (no failures)', () => {
        const state = {
            ruleFileContent: mockRuleFileContent,
            samples: [
                {
                    id: 's1',
                    selectedContentTypes: ['web'],
                    requirementResults: {
                        'req_1': {
                            checkResults: {
                                'check_1': { overallStatus: 'passed', passCriteria: {} }
                            }
                        }
                    }
                }
            ]
        };

        const result = calculateQualityScore(state);
        expect(result).not.toBeNull();
        expect(result.totalScore).toBe(0);
        expect(result.principles['perceivable'].score).toBe(0);
    });

    test('calculates deficiency score correctly for failures', () => {
        const state = {
            ruleFileContent: mockRuleFileContent,
            samples: [
                {
                    id: 's1',
                    selectedContentTypes: ['web'],
                    requirementResults: {
                        'req_1': {
                            checkResults: {
                                'check_1': { 
                                    overallStatus: 'passed', // Needs to be 'passed' at check level for logic to look deeper, based on code logic?
                                    // Looking at ScoreCalculator.js:86: if (checkResult.overallStatus === 'passed' && checkResult.passCriteria)
                                    // Wait, if overallStatus is passed, how can there be failed criteria contributing to score?
                                    // Ah, "passed" usually means "evaluated". But let's check AuditLogic or ScoreLogic intent.
                                    // ScoreCalculator.js:86 says: if (checkResult.overallStatus === 'passed' ...
                                    // This implies we only count deficiencies if the check itself was considered "passed" (or maybe "completed/evaluated")?
                                    // If a check is failed, usually it means the whole requirement is failed.
                                    // Let's re-read ScoreCalculator.js line 86 carefully.
                                    // "if (checkResult.overallStatus === 'passed' && checkResult.passCriteria)"
                                    // Then it counts failures in passCriteria.
                                    // This seems to imply we count specific criteria failures even if the check is technically "passed"? 
                                    // Or maybe "passed" here is a placeholder for "assessed".
                                    // In many audit tools, "passed" means "Compliant". If "Compliant", there should be no failures.
                                    // If logic says "failed", then we count failures?
                                    
                                    // Let's verify the logic in ScoreCalculator.js again.
                                    // line 86: if (checkResult.overallStatus === 'passed' ...
                                    // This looks potentially like a bug or specific logic I should follow. 
                                    // If check is 'failed', does it count?
                                    // In `calculateQualityScore` (lines 81-95), it ONLY looks inside `checkResult.overallStatus === 'passed'`.
                                    // This is very suspicious if we want to count deficiencies.
                                    // Usually deficiencies cause a 'failed' status.
                                    
                                    // HOWEVER, I must write tests that reflect CURRENT implementation first.
                                    passCriteria: {
                                        'pc_1': { status: 'failed' }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        };

        const result = calculateQualityScore(state);
        // Based on current logic (which might be quirky):
        // If I set overallStatus to 'passed', it should count the failure.
        expect(result).not.toBeNull();
        expect(result.totalScore).toBe(100.0);
    });

    test('räknar bristindex för alla kopplade begrepp, inte bara första', () => {
        const multi_concept_requirement = {
            ...mockRequirement,
            classifications: [
                { taxonomyId: 'wcag22-pour', conceptId: 'perceivable' },
                { taxonomyId: 'wcag22-pour', conceptId: 'operable' }
            ]
        };
        const state = {
            ruleFileContent: {
                metadata: { taxonomies: [mockTaxonomy] },
                requirements: { req_1: multi_concept_requirement }
            },
            samples: [
                {
                    id: 's1',
                    selectedContentTypes: ['web'],
                    requirementResults: {
                        req_1: {
                            checkResults: {
                                check_1: {
                                    overallStatus: 'passed',
                                    passCriteria: { pc_1: { status: 'failed' } }
                                }
                            }
                        }
                    }
                }
            ]
        };

        const result = calculateQualityScore(state);
        expect(result.principles.perceivable.score).toBe(100);
        expect(result.principles.operable.score).toBe(100);
        expect(result.principles.understandable.score).toBe(0);
    });

    test('använder primaryGroupingTaxonomyId när den finns', () => {
        const custom_taxonomy = {
            id: 'custom-group',
            concepts: [
                { id: 'group_a', label: 'Grupp A' },
                { id: 'group_b', label: 'Grupp B' }
            ]
        };
        const custom_requirement = {
            ...mockRequirement,
            classifications: [{ taxonomyId: 'custom-group', conceptId: 'group_a' }]
        };
        const state = {
            ruleFileContent: {
                metadata: {
                    primaryGroupingTaxonomyId: 'custom-group',
                    taxonomies: [custom_taxonomy]
                },
                requirements: { req_1: custom_requirement }
            },
            samples: [
                {
                    id: 's1',
                    selectedContentTypes: ['web'],
                    requirementResults: {
                        req_1: {
                            checkResults: {
                                check_1: { overallStatus: 'passed', passCriteria: {} }
                            }
                        }
                    }
                }
            ]
        };

        const result = calculateQualityScore(state);
        expect(result.principles.group_a).toBeDefined();
        expect(result.principles.group_b).toBeDefined();
        expect(result.principles.perceivable).toBeUndefined();
    });
});


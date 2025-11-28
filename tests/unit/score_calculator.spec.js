
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

    test('returns null if auditState is invalid', () => {
        expect(calculateQualityScore(null)).toBeNull();
        expect(calculateQualityScore({})).toBeNull();
    });

    test('returns null if requirements or taxonomies are missing', () => {
        expect(calculateQualityScore({ ruleFileContent: {} })).toBeNull();
        expect(calculateQualityScore({ ruleFileContent: { requirements: {} } })).toBeNull();
    });

    test('returns null if no samples exist', () => {
        const state = {
            ruleFileContent: mockRuleFileContent,
            samples: []
        };
        expect(calculateQualityScore(state)).toBeNull();
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
        // Setup a failure
        // Weight calculation: isCritical=true (1.0) * sqrt(10 + 0.5*5) = sqrt(12.5) ≈ 3.535
        // Failure count = 1.
        // Deduction = min(1 * 3.535, 3.535) = 3.535.
        // Total Max Weight = 3.535.
        // Index = (3.535 / 3.535) * 100 = 100.
        
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
});


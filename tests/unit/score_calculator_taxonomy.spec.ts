/**
 * @fileoverview Tester för taxonomi-override i ScoreCalculator.
 */
import { describe, test, expect } from '@jest/globals';
import { calculateQualityScore } from '../../js/logic/ScoreCalculator.js';

describe('calculateQualityScore groupingTaxonomyId', () => {
    test('använder override i stället för primär taxonomi', () => {
        const rule = {
            metadata: {
                primaryGroupingTaxonomyId: 'wcag22-pour',
                taxonomies: [
                    {
                        id: 'wcag22-pour',
                        label: 'WCAG',
                        concepts: [
                            { id: 'perceivable', label: 'Märkbart' },
                            { id: 'operable', label: 'Hanterbart' }
                        ]
                    },
                    {
                        id: 'fptt',
                        label: 'FPTT',
                        concepts: [{ id: 'info', label: 'Information' }]
                    }
                ]
            },
            requirements: {
                r1: {
                    key: 'k1',
                    title: 'Krav',
                    metadata: {
                        impact: { isCritical: true, primaryScore: 4, secondaryScore: 0 }
                    },
                    classifications: [{ taxonomyId: 'fptt', conceptId: 'info' }],
                    checks: []
                }
            }
        };
        const sample = {
            id: 's1',
            selectedContentTypes: [],
            requirementResults: {
                k1: {
                    checkResults: {
                        c1: {
                            overallStatus: 'passed',
                            passCriteria: { pc1: { status: 'failed' } }
                        }
                    }
                }
            }
        };

        const primary = calculateQualityScore({ ruleFileContent: rule, samples: [sample] });
        const overridden = calculateQualityScore({
            ruleFileContent: rule,
            samples: [sample],
            groupingTaxonomyId: 'fptt'
        });

        expect(Object.keys(primary.principles)).toContain('perceivable');
        expect(Object.keys(overridden.principles)).toEqual(['info']);
        expect(overridden.principles.info.score).toBeGreaterThan(0);
    });
});

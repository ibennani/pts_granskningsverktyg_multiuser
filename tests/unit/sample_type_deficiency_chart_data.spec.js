import { jest } from '@jest/globals';
import {
    MONITORING_LABEL_FALLBACK_SENTINEL,
    build_sampletype_chart_sections_from_audit_state,
    get_monitoring_type_label_for_audit
} from '../../js/logic/sample_type_deficiency_chart_data.ts';

describe('sample_type_deficiency_chart_data', () => {
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
        classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'perceivable' }],
        contentType: ['web']
    };

    const mockRuleFileContent = {
        metadata: {
            taxonomies: [mockTaxonomy],
            monitoringType: { text: 'Webbsida', type: 'web' }
        },
        requirements: {
            req_1: mockRequirement
        }
    };

    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    test('tom state ger tom lista', () => {
        expect(build_sampletype_chart_sections_from_audit_state(null)).toEqual([]);
    });

    test('get_monitoring_type_label_for_audit utan metadata ger sentinel', () => {
        expect(get_monitoring_type_label_for_audit({})).toBe(MONITORING_LABEL_FALLBACK_SENTINEL);
    });

    test('en stickprovstyp med ett stickprov ger en rad med samma bristindex som ScoreCalculator', () => {
        const state = {
            ruleFileContent: mockRuleFileContent,
            samples: [
                {
                    id: 's1',
                    sampleType: 'typ_a',
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
        const sections = build_sampletype_chart_sections_from_audit_state(state);
        expect(sections.length).toBe(1);
        expect(sections[0].monitoring_type_label).toBe('Webbsida');
        expect(sections[0].sample_types.length).toBe(1);
        expect(sections[0].sample_types[0].sample_type_id).toBe('typ_a');
        expect(sections[0].sample_types[0].median_deficiency).toBe(0);
    });
});

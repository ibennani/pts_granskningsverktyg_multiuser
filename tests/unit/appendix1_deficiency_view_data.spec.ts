/**
 * Enhetstester för Bilaga 1 visningsdata (taxonomi + bristtyper).
 */
import { describe, test, expect } from '@jest/globals';
import { get_default_appendix1_sections_list } from '../../js/logic/appendix1_sections.ts';
import {
    resolve_appendix1_deficiency_view_data_for_audit,
    resolve_appendix1_deficiency_view_data_for_rulefile,
} from '../../js/logic/appendix1_deficiency_view_data.ts';

const t = (key: string) => key;

function create_audit_with_deficiencies() {
    return {
        auditMetadata: {
            auditTypeId: 'tillsyn-fptt',
            appendix1PrincipleIntroOverrides: { perceivable: 'Granskningsspecifik inledning' },
        },
        ruleFileContent: {
            appendix1: {
                groupingTaxonomyId: 'wcag22-pour',
                sections: get_default_appendix1_sections_list(),
            },
            metadata: {
                auditTypes: [{ id: 'tillsyn-fptt', taxonomyId: 'wcag22-pour' }],
                taxonomies: [
                    {
                        id: 'wcag22-pour',
                        concepts: [
                            { id: 'perceivable', label: 'Möjligt att uppfatta' },
                            { id: 'operable', label: 'Möjligt att använda' },
                        ],
                    },
                ],
            },
            requirements: {
                req1: {
                    key: 'req1',
                    classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'perceivable' }],
                    checks: [{ id: 'chk1', passCriteria: [{ id: 'pc1', requirement: 'Krav' }] }],
                },
            },
        },
        samples: [
            {
                id: 's1',
                requirementResults: {
                    req1: {
                        checkResults: {
                            chk1: {
                                passCriteria: {
                                    pc1: {
                                        status: 'failed',
                                        deficiencyId: 'B001',
                                        DeficiencyType: {
                                            PrimaryText: 'Semantiska element används inte.',
                                            SecondaryText: 'Till exempel rubriker.',
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        ],
    };
}

describe('appendix1_deficiency_view_data', () => {
    test('resolve_appendix1_deficiency_view_data_for_audit samlar bristtyper per concept', () => {
        const audit = create_audit_with_deficiencies();
        const data = resolve_appendix1_deficiency_view_data_for_audit(audit, t);
        expect(data.deficiency_sections.length).toBeGreaterThan(0);
        expect(data.deficiency_sections[0]?.content).toBe('Granskningsspecifik inledning');
        const types = data.deficiency_types_by_concept.get('perceivable') ?? [];
        expect(types).toHaveLength(1);
        expect(types[0]?.primary).toBe('Semantiska element används inte.');
        expect(types[0]?.secondary).toBe('Till exempel rubriker.');
        expect(data.deficiency_types_by_concept.get('operable') ?? []).toHaveLength(0);
    });

    test('samlar bristtyper även utan tilldelat brist-id under pågående granskning', () => {
        const audit = create_audit_with_deficiencies();
        const samples = audit.samples as Array<Record<string, unknown>>;
        const pc1 = (
            ((samples[0]?.requirementResults as Record<string, unknown>)?.req1 as Record<string, unknown>)
                ?.checkResults as Record<string, unknown>
        )?.chk1 as Record<string, unknown>;
        const pass_criteria = pc1?.passCriteria as Record<string, unknown>;
        const pc_result = pass_criteria?.pc1 as Record<string, unknown>;
        delete pc_result.deficiencyId;

        const data = resolve_appendix1_deficiency_view_data_for_audit(audit, t);
        const types = data.deficiency_types_by_concept.get('perceivable') ?? [];
        expect(types).toHaveLength(1);
        expect(types[0]?.primary).toBe('Semantiska element används inte.');
    });

    test('resolve_appendix1_deficiency_view_data_for_rulefile har inga bristtyper', () => {
        const audit = create_audit_with_deficiencies();
        const data = resolve_appendix1_deficiency_view_data_for_rulefile(
            audit.ruleFileContent as Record<string, unknown>,
            t
        );
        expect(data.deficiency_sections.length).toBeGreaterThan(0);
        expect(data.deficiency_types_by_concept.size).toBe(0);
    });
});

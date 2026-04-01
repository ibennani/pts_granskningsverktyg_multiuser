/**
 * Tester för rulefile_updater_logic.js (inga api-imports — ingen client-mock behövs).
 */
import { describe, test, expect } from '@jest/globals';
import {
    analyze_rule_file_changes,
    apply_rule_file_update
} from '../../js/logic/rulefile_updater_logic.js';

describe('rulefile_updater_logic', () => {
    describe('analyze_rule_file_changes', () => {
        test('kastar om requirements saknas i gammal regelfil', () => {
            expect(() =>
                analyze_rule_file_changes({}, { requirements: {} })
            ).toThrow(/requirements.*saknas/);
        });

        test('kastar om requirements saknas i ny regelfil', () => {
            expect(() =>
                analyze_rule_file_changes({ ruleFileContent: { requirements: { x: {} } } }, {})
            ).toThrow(/requirements.*saknas/);
        });

        test('tomma kravlistor ger tom rapport', () => {
            const report = analyze_rule_file_changes(
                { ruleFileContent: { requirements: {} } },
                { requirements: {} }
            );
            expect(report.updated_requirements).toEqual([]);
            expect(report.removed_requirements).toEqual([]);
            expect(report.added_requirements).toEqual([]);
        });

        test('identiska krav ger inga uppdateringar', () => {
            const req = {
                key: 'k1',
                title: 'Titel',
                standardReference: { text: 'ref' },
                instructions: 'samma',
                checks: []
            };
            const report = analyze_rule_file_changes(
                { ruleFileContent: { requirements: { k1: { ...req } } } },
                { requirements: { k1: { ...req } } }
            );
            expect(report.updated_requirements).toHaveLength(0);
            expect(report.removed_requirements).toHaveLength(0);
            expect(report.added_requirements).toHaveLength(0);
        });

        test('ändrad titel ger updated_requirements', () => {
            const base = {
                key: 'k1',
                title: 'A',
                standardReference: { text: 'r' },
                instructions: '',
                checks: []
            };
            const report = analyze_rule_file_changes(
                { ruleFileContent: { requirements: { k1: { ...base, title: 'A' } } } },
                { requirements: { k1: { ...base, title: 'B' } } }
            );
            expect(report.updated_requirements.length).toBeGreaterThanOrEqual(1);
            expect(report.updated_requirements[0].id).toBe('k1');
        });

        test('borttaget krav hamnar i removed_requirements', () => {
            const report = analyze_rule_file_changes(
                {
                    ruleFileContent: {
                        requirements: {
                            old: { key: 'old', title: 'Borta', standardReference: { text: '' }, checks: [] }
                        }
                    }
                },
                { requirements: {} }
            );
            expect(report.removed_requirements.map((r) => r.id)).toContain('old');
        });

        test('nytt krav hamnar i added_requirements', () => {
            const report = analyze_rule_file_changes(
                {
                    ruleFileContent: { requirements: {} }
                },
                {
                    requirements: {
                        n1: { key: 'n1', title: 'Nytt', standardReference: { text: '' }, checks: [] }
                    }
                }
            );
            expect(report.added_requirements.map((a) => a.id)).toContain('n1');
        });
    });

    describe('apply_rule_file_update', () => {
        test('ersätter ruleFileContent och sätter lastRulefileUpdateLog', () => {
            const state = {
                ruleFileContent: { metadata: { version: '1.0' }, requirements: {} },
                uiSettings: { x: 1 },
                samples: []
            };
            const new_content = {
                metadata: { version: '2.0' },
                requirements: { a: { key: 'a', title: 'A' } }
            };
            const report = { updated_requirements: [], removed_requirements: [], added_requirements: [] };
            const out = apply_rule_file_update(state, new_content, report);
            expect(out.ruleFileContent.metadata.version).toBe('2.0');
            expect(out.ruleFileContent.requirements.a.title).toBe('A');
            expect(out.uiSettings).toEqual({ x: 1 });
            expect(out.lastRulefileUpdateLog.previousRuleVersion).toBe('1.0');
            expect(out.lastRulefileUpdateLog.newRuleVersion).toBe('2.0');
            expect(out.lastRulefileUpdateLog.report).toBe(report);
        });

        test('arkiverar resultat för borttaget krav', () => {
            const state = {
                ruleFileContent: {
                    metadata: { version: 'v' },
                    requirements: { r1: { key: 'r1', title: 'T', standardReference: { text: '' } } }
                },
                uiSettings: {},
                samples: [
                    {
                        id: 's1',
                        description: 'Prov',
                        requirementResults: {
                            r1: { status: 'pass', checkResults: {} }
                        }
                    }
                ]
            };
            const new_content = { metadata: { version: 'v2' }, requirements: {} };
            const report = {
                updated_requirements: [],
                removed_requirements: [{ id: 'r1', title: 'T' }],
                added_requirements: []
            };
            const out = apply_rule_file_update(state, new_content, report);
            expect(out.samples[0].requirementResults.r1).toBeUndefined();
            expect(Array.isArray(out.archivedRequirementResults)).toBe(true);
            const arch = out.archivedRequirementResults.find((a) => a.requirementId === 'r1');
            expect(arch).toBeDefined();
            expect(arch.samples).toHaveLength(1);
            expect(arch.samples[0].sampleId).toBe('s1');
        });

        test('sätter needsReview för uppdaterat krav när status inte är not_audited', () => {
            const req_old = {
                key: 'k1',
                title: 'T',
                standardReference: { text: '' },
                instructions: '',
                checks: []
            };
            const req_new = { ...req_old, title: 'T2' };
            const state = {
                ruleFileContent: { metadata: { version: '1' }, requirements: { k1: req_old } },
                uiSettings: {},
                samples: [
                    {
                        id: 's1',
                        requirementResults: {
                            k1: { status: 'pass', checkResults: {} }
                        }
                    }
                ]
            };
            const report = analyze_rule_file_changes(state, { requirements: { k1: req_new } });
            const new_content = { metadata: { version: '2' }, requirements: { k1: req_new } };
            const out = apply_rule_file_update(state, new_content, report);
            expect(out.samples[0].requirementResults.k1.needsReview).toBe(true);
        });
    });
});

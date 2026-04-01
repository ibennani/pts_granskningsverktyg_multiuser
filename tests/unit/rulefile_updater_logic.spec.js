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

        test('ändring i passCriteria ger passCriteriaChanges', () => {
            const base = {
                key: 'k1',
                title: 'T',
                standardReference: { text: '' },
                instructions: '',
                checks: [
                    {
                        id: 'chk1',
                        condition: 'Vid kontroll',
                        passCriteria: [{ id: 'pc1', requirement: 'Gammal text' }]
                    }
                ]
            };
            const new_req = {
                ...base,
                checks: [
                    {
                        id: 'chk1',
                        condition: 'Vid kontroll',
                        passCriteria: [
                            { id: 'pc1', requirement: 'Gammal text' },
                            { id: 'pc2', requirement: 'Ny punkt' }
                        ]
                    }
                ]
            };
            const report = analyze_rule_file_changes(
                { ruleFileContent: { requirements: { k1: base } } },
                { requirements: { k1: new_req } }
            );
            expect(report.updated_requirements).toHaveLength(1);
            expect(report.updated_requirements[0].passCriteriaChanges.added.length).toBeGreaterThan(0);
        });

        test('passCriteriaChanges: tillagd pass-punkt listas i added', () => {
            const old_req = {
                key: 'k1',
                title: 'T',
                standardReference: { text: 'R' },
                instructions: '',
                checks: [
                    {
                        id: 'chk1',
                        condition: 'Vid kontroll',
                        passCriteria: [{ id: 'pc1', requirement: 'Kvar' }]
                    }
                ]
            };
            const new_req = {
                ...old_req,
                checks: [
                    {
                        id: 'chk1',
                        condition: 'Vid kontroll',
                        passCriteria: [
                            { id: 'pc1', requirement: 'Kvar' },
                            { id: 'pc3', requirement: 'Helt ny rad' }
                        ]
                    }
                ]
            };
            const report = analyze_rule_file_changes(
                { ruleFileContent: { requirements: { k1: old_req } } },
                { requirements: { k1: new_req } }
            );
            const pc = report.updated_requirements[0].passCriteriaChanges;
            expect(pc.added.some((a) => a.passCriterionId === 'pc3')).toBe(true);
        });

        test('passCriteriaChanges: borttagen pass-punkt ger uppdaterat krav (checks-array ändrad)', () => {
            const old_req = {
                key: 'k1',
                title: 'T',
                standardReference: { text: '' },
                instructions: '',
                checks: [
                    {
                        id: 'chk1',
                        condition: 'Vid kontroll',
                        passCriteria: [
                            { id: 'pc1', requirement: 'Finns kvar' },
                            { id: 'pc2', requirement: 'Försvinner' }
                        ]
                    }
                ]
            };
            const new_req = {
                ...old_req,
                checks: [
                    {
                        id: 'chk1',
                        condition: 'Vid kontroll',
                        passCriteria: [{ id: 'pc1', requirement: 'Finns kvar' }]
                    }
                ]
            };
            const report = analyze_rule_file_changes(
                { ruleFileContent: { requirements: { k1: old_req } } },
                { requirements: { k1: new_req } }
            );
            expect(report.updated_requirements).toHaveLength(1);
            expect(report.updated_requirements[0].id).toBe('k1');
        });

        test('passCriteriaChanges: ändrad text för samma pass-id hamnar i updated', () => {
            const old_req = {
                key: 'k1',
                title: 'T',
                standardReference: { text: '' },
                instructions: '',
                checks: [
                    {
                        id: 'chk1',
                        condition: 'Vid kontroll',
                        passCriteria: [{ id: 'pc1', requirement: 'Gammal' }]
                    }
                ]
            };
            const new_req = {
                ...old_req,
                checks: [
                    {
                        id: 'chk1',
                        condition: 'Vid kontroll',
                        passCriteria: [{ id: 'pc1', requirement: 'Ny formulering' }]
                    }
                ]
            };
            const report = analyze_rule_file_changes(
                { ruleFileContent: { requirements: { k1: old_req } } },
                { requirements: { k1: new_req } }
            );
            const ch = report.updated_requirements[0].passCriteriaChanges;
            expect(ch.updated.some((u) => u.passCriterionId === 'pc1')).toBe(true);
        });

        test('passCriteriaChanges: helt ny kontrollpunkt ger addedChecks', () => {
            const old_req = {
                key: 'k1',
                title: 'T',
                standardReference: { text: '' },
                instructions: '',
                checks: [
                    {
                        id: 'c1',
                        condition: 'Första',
                        passCriteria: [{ id: 'p1', requirement: 'A' }]
                    }
                ]
            };
            const new_req = {
                ...old_req,
                checks: [
                    ...old_req.checks,
                    {
                        id: 'c2',
                        condition: 'Andra kontrollen',
                        passCriteria: [{ id: 'p2', requirement: 'B' }]
                    }
                ]
            };
            const report = analyze_rule_file_changes(
                { ruleFileContent: { requirements: { k1: old_req } } },
                { requirements: { k1: new_req } }
            );
            const ch = report.updated_requirements[0].passCriteriaChanges;
            expect(ch.addedChecks).toContain('c2');
            expect(ch.added.some((a) => a.checkId === 'c2' && a.passCriterionId === 'p2')).toBe(true);
        });

        test('samma titel och referens men ny nyckel matchar innehåll', () => {
            const body = {
                title: 'Gemensam',
                standardReference: { text: 'ISO' },
                instructions: '',
                checks: []
            };
            const report = analyze_rule_file_changes(
                {
                    ruleFileContent: {
                        requirements: { gammal: { key: 'gammal', ...body } }
                    }
                },
                {
                    requirements: { nyck: { key: 'nyck', ...body } }
                }
            );
            expect(report.removed_requirements).toHaveLength(0);
            expect(report.added_requirements).toHaveLength(0);
            expect(report.updated_requirements).toHaveLength(0);
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

        test('requirementUpdateDetails fylls när passCriteriaChanges finns', () => {
            const req = {
                key: 'k1',
                title: 'T',
                standardReference: { text: '' },
                instructions: '',
                checks: []
            };
            const state = {
                ruleFileContent: { metadata: { version: '1' }, requirements: { k1: req } },
                uiSettings: {},
                samples: []
            };
            const new_content = { metadata: { version: '2' }, requirements: { k1: req } };
            const pass_changes = {
                added: [],
                updated: [{ checkId: 'c1', passCriterionId: 'p1', text: 'x' }],
                addedChecks: []
            };
            const report = {
                updated_requirements: [{ id: 'k1', title: 'T', passCriteriaChanges: pass_changes }],
                removed_requirements: [],
                added_requirements: []
            };
            const out = apply_rule_file_update(state, new_content, report);
            expect(out.requirementUpdateDetails.k1).toEqual(pass_changes);
        });

        test('mappar resultat till ny kravnyckel vid titel-matchning', () => {
            const shared = {
                title: 'Krav X',
                standardReference: { text: 'R' },
                instructions: '',
                checks: []
            };
            const state = {
                ruleFileContent: {
                    metadata: { version: '1' },
                    requirements: { old_key: { key: 'old_key', ...shared } }
                },
                uiSettings: {},
                samples: [
                    {
                        id: 's1',
                        requirementResults: {
                            old_key: { status: 'pass', checkResults: {} }
                        }
                    }
                ]
            };
            const new_content = {
                metadata: { version: '2' },
                requirements: { new_key: { key: 'new_key', ...shared } }
            };
            const report = analyze_rule_file_changes(state, new_content);
            const out = apply_rule_file_update(state, new_content, report);
            expect(out.samples[0].requirementResults.new_key).toBeDefined();
            expect(out.samples[0].requirementResults.old_key).toBeUndefined();
        });

        test('bygger om checkResults och passCriteria när id:n ändras men text matchar', () => {
            const cond = 'Samma villkor';
            const req_text = 'Godkänn detta';
            const old_req = {
                key: 'k1',
                title: 'Krav',
                standardReference: { text: 'S' },
                instructions: '',
                checks: [
                    {
                        id: 'old_chk',
                        condition: cond,
                        passCriteria: [{ id: 'old_pc', requirement: req_text }]
                    }
                ]
            };
            const new_req = {
                ...old_req,
                checks: [
                    {
                        id: 'new_chk',
                        condition: cond,
                        passCriteria: [{ id: 'new_pc', requirement: req_text }]
                    }
                ]
            };
            const state = {
                ruleFileContent: { metadata: { version: '1' }, requirements: { k1: old_req } },
                uiSettings: {},
                samples: [
                    {
                        id: 's1',
                        description: 'P',
                        requirementResults: {
                            k1: {
                                status: 'pass',
                                checkResults: {
                                    old_chk: {
                                        passCriteria: {
                                            old_pc: { status: 'pass', note: 'behålls' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]
            };
            const new_content = { metadata: { version: '2' }, requirements: { k1: new_req } };
            const report = analyze_rule_file_changes(state, new_content);
            const out = apply_rule_file_update(state, new_content, report);
            const rr = out.samples[0].requirementResults.k1;
            expect(rr.checkResults.new_chk).toBeDefined();
            expect(rr.checkResults.new_chk.passCriteria.new_pc.note).toBe('behålls');
            expect(rr.checkResults.old_chk).toBeUndefined();
        });

        test('remap_requirement_result: partiell pc-mappning behåller bara kända nya id', () => {
            const old_req = {
                key: 'k1',
                title: 'K',
                standardReference: { text: '' },
                instructions: '',
                checks: [
                    {
                        id: 'c1',
                        condition: 'A',
                        passCriteria: [
                            { id: 'p1', requirement: 'X' },
                            { id: 'p2', requirement: 'Y' }
                        ]
                    }
                ]
            };
            const new_req = {
                ...old_req,
                checks: [
                    {
                        id: 'c1',
                        condition: 'A',
                        passCriteria: [{ id: 'p1n', requirement: 'X' }]
                    }
                ]
            };
            const state = {
                ruleFileContent: { metadata: { version: '1' }, requirements: { k1: old_req } },
                uiSettings: {},
                samples: [
                    {
                        id: 's1',
                        requirementResults: {
                            k1: {
                                status: 'pass',
                                checkResults: {
                                    c1: {
                                        passCriteria: {
                                            p1: { a: 1 },
                                            p2: { b: 2 }
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]
            };
            const new_content = { metadata: { version: '2' }, requirements: { k1: new_req } };
            const report = analyze_rule_file_changes(state, new_content);
            const out = apply_rule_file_update(state, new_content, report);
            const pcs = out.samples[0].requirementResults.k1.checkResults.c1.passCriteria;
            expect(pcs.p1n).toEqual({ a: 1 });
            expect(pcs.p2).toBeUndefined();
        });

        test('apply_rule_file_update: flera ändringstyper samtidigt (nyckelbyte, borttaget krav, needsReview)', () => {
            const shared = {
                title: 'Gemensam titel',
                standardReference: { text: 'ISO' },
                instructions: '',
                checks: []
            };
            const state = {
                ruleFileContent: {
                    metadata: { version: 'v0' },
                    requirements: {
                        old_id: { key: 'old_id', ...shared },
                        stay: {
                            key: 'stay',
                            title: 'Stannar',
                            standardReference: { text: '' },
                            instructions: '',
                            checks: []
                        },
                        remove_me: {
                            key: 'remove_me',
                            title: 'Raderas',
                            standardReference: { text: '' },
                            instructions: '',
                            checks: []
                        }
                    }
                },
                uiSettings: { theme: 'light' },
                samples: [
                    {
                        id: 's1',
                        description: 'Prov',
                        requirementResults: {
                            old_id: { status: 'pass', checkResults: {} },
                            stay: { status: 'fail', checkResults: {} },
                            remove_me: { status: 'pass', checkResults: {} }
                        }
                    }
                ],
                archivedRequirementResults: []
            };
            const new_req_stay = {
                key: 'stay',
                title: 'Stannar uppdaterad',
                standardReference: { text: '' },
                instructions: '',
                checks: []
            };
            const new_content = {
                metadata: { version: 'v1' },
                requirements: {
                    new_id: { key: 'new_id', ...shared },
                    stay: new_req_stay
                }
            };
            const report = analyze_rule_file_changes(state, new_content);
            const out = apply_rule_file_update(state, new_content, report);
            expect(out.samples[0].requirementResults.new_id).toBeDefined();
            expect(out.samples[0].requirementResults.old_id).toBeUndefined();
            expect(out.samples[0].requirementResults.stay.needsReview).toBe(true);
            const arch = out.archivedRequirementResults.find((a) => a.requirementId === 'remove_me');
            expect(arch).toBeDefined();
            expect(out.uiSettings.theme).toBe('light');
            expect(out.lastRulefileUpdateLog.newRuleVersion).toBe('v1');
        });
    });
});

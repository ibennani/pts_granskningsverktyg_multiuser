/**
 * @fileoverview Tester för remoteStateHandlers (SET_REMOTE_AUDIT_ID m.m.).
 */

import { app_session_storage } from '../helpers/scoped_session_storage.ts';
import { describe, expect, test } from '@jest/globals';
import {
    reduce_discard_prepared_audit,
    reduce_initialize_new_audit,
    reduce_replace_state_from_remote,
    reduce_set_remote_audit_id,
    reduce_update_new_audit_rulefile
} from '../../js/state/remoteStateHandlers.ts';
import { get_default_appendix1_sections } from '../../js/logic/appendix1_sections.ts';

describe('reduce_initialize_new_audit', () => {
    test('nollställer metadata utom inloggad granskare', () => {
        app_session_storage.setItem('gv_current_user_name', 'Anna Granskare');
        const current = {
            auditStatus: 'in_progress',
            auditMetadata: {
                caseNumber: '2024-1',
                actorName: 'Gammal aktör',
                actorLink: 'https://example.com',
                auditorName: 'Gammal granskare',
                caseHandler: 'Handläggare',
                internalComment: 'Kommentar'
            }
        };
        const next = reduce_initialize_new_audit(current, {
            payload: { ruleFileContent: { requirements: [] } }
        });
        expect(next.auditStatus).toBe('not_started');
        expect(next.freshNewAuditMetadata).toBe(true);
        expect(next.auditMetadata).toMatchObject({
            caseNumber: '',
            actorName: '',
            actorLink: '',
            auditorName: 'Anna Granskare',
            caseHandler: '',
            internalComment: '',
            auditTypeId: '',
            auditTypeLabel: '',
            appendix1SectionOverrides: {},
            appendix1PrincipleIntroOverrides: {},
        });
        expect(typeof next.auditMetadata.appendix1SummaryText).toBe('string');
        expect(next.auditMetadata.appendix1SummaryText.length).toBeGreaterThan(0);
        app_session_storage.removeItem('gv_current_user_name');
    });

    test('kopierar Bilaga 1-standardtext från regelfil vid ny granskning', () => {
        const sections = get_default_appendix1_sections();
        sections.introduction.content = 'Regelfilens inledning {{actorName}}';
        const next = reduce_initialize_new_audit({}, {
            payload: {
                ruleFileContent: { appendix1: { sections } },
            },
        });
        expect(next.auditMetadata.appendix1SummaryText).toBe('Regelfilens inledning {{actorName}}');
        expect(next.auditMetadata.appendix1SectionOverrides).toEqual({});
        expect(next.auditMetadata.appendix1PrincipleIntroOverrides).toEqual({});
    });
});

describe('reduce_discard_prepared_audit', () => {
    test('återställer förberedd granskning utan att behålla regelfil eller metadata', () => {
        const current = {
            auditStatus: 'not_started',
            ruleFileContent: { requirements: [] },
            auditMetadata: { actorName: 'TestaMig AB', auditorName: 'Ilias' },
            manageUsersText: 'adminlista'
        };
        const next = reduce_discard_prepared_audit(current, { payload: {} });
        expect(next.auditStatus).toBe('not_started');
        expect(next.ruleFileContent).toBeNull();
        expect(next.auditMetadata?.actorName).toBe('');
        expect(next.auditMetadata?.auditorName).toBe('');
        expect(next.freshNewAuditMetadata).toBe(true);
        expect(next.manageUsersText).toBe('adminlista');
    });
});

describe('reduce_update_new_audit_rulefile', () => {
    test('sätter inte granskningstyp automatiskt även om regelfilen bara har en typ', () => {
        const rule = {
            metadata: {
                auditTypes: [{ id: 'tillsyn', label: 'Tillsyn' }],
            },
        };
        const next = reduce_update_new_audit_rulefile(
            {
                auditStatus: 'not_started',
                freshNewAuditMetadata: false,
                auditMetadata: { auditorName: 'Anna', auditTypeId: '', auditTypeLabel: '' },
                ruleFileContent: null,
                ruleSetId: null,
            },
            { payload: { ruleFileContent: rule, ruleSetId: 'rs-1' } }
        );
        expect(next.auditMetadata.auditTypeId).toBe('');
        expect(next.auditMetadata.auditTypeLabel).toBe('');
        expect(next.ruleSetId).toBe('rs-1');
    });
});

describe('reduce_replace_state_from_remote', () => {
    test('behåller lokala kört-fast-texter som servern saknar vid fjärrersättning', () => {
        const current = {
            auditId: 'audit-1',
            version: 2,
            uiSettings: { foo: 'local' },
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        R1: {
                            stuckProblemDescription: 'Lokal A',
                            lastStatusUpdate: '2026-08-14T12:00:00.000Z'
                        },
                        R2: {
                            stuckProblemDescription: 'Lokal B',
                            lastStatusUpdate: '2026-08-14T12:01:00.000Z'
                        }
                    }
                }
            ]
        };
        const next = reduce_replace_state_from_remote(current, {
            payload: {
                auditId: 'audit-1',
                version: 5,
                auditStatus: 'in_progress',
                samples: [
                    {
                        id: 's1',
                        requirementResults: {
                            R1: {
                                stuckProblemDescription: 'Server A',
                                lastStatusUpdate: '2026-08-14T11:00:00.000Z'
                            }
                        }
                    }
                ]
            }
        });
        expect(next.samples[0].requirementResults.R1.stuckProblemDescription).toBe('Lokal A');
        expect(next.samples[0].requirementResults.R2.stuckProblemDescription).toBe('Lokal B');
        expect(next.uiSettings).toEqual({ foo: 'local' });
        expect(next.version).toBe(5);
    });

    test('låter serverns kört-fast vinna när den är nyare än lokal', () => {
        const current = {
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        R1: {
                            stuckProblemDescription: 'Gammal lokal',
                            lastStatusUpdate: '2026-08-14T10:00:00.000Z'
                        }
                    }
                }
            ]
        };
        const next = reduce_replace_state_from_remote(current, {
            payload: {
                samples: [
                    {
                        id: 's1',
                        requirementResults: {
                            R1: {
                                stuckProblemDescription: 'Nyare server',
                                lastStatusUpdate: '2026-08-14T14:00:00.000Z'
                            }
                        }
                    }
                ]
            }
        });
        expect(next.samples[0].requirementResults.R1.stuckProblemDescription).toBe('Nyare server');
    });

    test('rättar korrupta brist-id vid fjärrersättning av låst granskning', () => {
        const current = {
            auditStatus: 'locked',
            ruleFileContent: {
                requirements: {
                    R1: {
                        key: 'R1',
                        title: 'Krav 1',
                        checks: [
                            {
                                id: 'c1',
                                passCriteria: [{ id: 'pc1', requirement: 'Kravtext' }]
                            }
                        ]
                    }
                }
            },
            samples: []
        };
        const next = reduce_replace_state_from_remote(current, {
            payload: {
                auditStatus: 'locked',
                ruleFileContent: current.ruleFileContent,
                samples: [
                    {
                        id: 's1',
                        requirementResults: {
                            R1: {
                                status: 'failed',
                                checkResults: {
                                    c1: {
                                        overallStatus: 'passed',
                                        passCriteria: {
                                            pc1: {
                                                status: 'failed',
                                                deficiencyId: '**deficiency_prefix**07'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]
            }
        });
        const fixed_id = next.samples[0].requirementResults.R1.checkResults.c1.passCriteria.pc1.deficiencyId;
        expect(fixed_id).toBe('B1');
    });
});

describe('reduce_set_remote_audit_id', () => {
    test('uppdaterar updated_at när server skickar ny tidsstämpel', () => {
        const current = {
            auditId: 'a1',
            ruleSetId: 'rs1',
            version: 3,
            updated_at: '2026-04-16T22:20:00.000Z'
        };
        const next = reduce_set_remote_audit_id(current, {
            payload: {
                auditId: 'a1',
                ruleSetId: 'rs1',
                version: 4,
                updated_at: '2026-05-21T13:05:56.000Z'
            }
        });
        expect(next.version).toBe(4);
        expect(next.updated_at).toBe('2026-05-21T13:05:56.000Z');
    });

    test('behåller befintlig updated_at om payload saknar fältet', () => {
        const current = {
            auditId: 'a1',
            version: 2,
            updated_at: '2026-04-16T22:20:00.000Z'
        };
        const next = reduce_set_remote_audit_id(current, {
            payload: { auditId: 'a1', version: 3 }
        });
        expect(next.updated_at).toBe('2026-04-16T22:20:00.000Z');
    });
});

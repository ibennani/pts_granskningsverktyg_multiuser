/**
 * @fileoverview Tester för remoteStateHandlers (SET_REMOTE_AUDIT_ID m.m.).
 */

import { describe, expect, test } from '@jest/globals';
import {
    reduce_discard_prepared_audit,
    reduce_initialize_new_audit,
    reduce_set_remote_audit_id
} from '../../js/state/remoteStateHandlers.ts';

describe('reduce_initialize_new_audit', () => {
    test('nollställer metadata utom inloggad granskare', () => {
        sessionStorage.setItem('gv_current_user_name', 'Anna Granskare');
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
        expect(next.auditMetadata).toEqual({
            caseNumber: '',
            actorName: '',
            actorLink: '',
            auditorName: 'Anna Granskare',
            caseHandler: '',
            internalComment: ''
        });
        sessionStorage.removeItem('gv_current_user_name');
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
        expect(next.manageUsersText).toBe('adminlista');
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

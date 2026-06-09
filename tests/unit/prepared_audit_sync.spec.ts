/**
 * Tester för prepared_audit_sync.ts
 */
import { describe, test, expect } from '@jest/globals';
import {
    has_required_audit_metadata,
    should_sync_prepared_audit_to_list
} from '../../js/logic/prepared_audit_sync.js';

describe('prepared_audit_sync', () => {
    test('has_required_audit_metadata kräver aktör och granskare', () => {
        expect(has_required_audit_metadata({ actorName: 'A', auditorName: 'G' })).toBe(true);
        expect(has_required_audit_metadata({ actorName: 'A', auditorName: '' })).toBe(false);
        expect(has_required_audit_metadata({ actorName: '', auditorName: 'G' })).toBe(false);
    });

    test('should_sync_prepared_audit_to_list för not_started utan auditId mot start', () => {
        const state = {
            auditStatus: 'not_started',
            auditId: null,
            ruleFileContent: { requirements: [] },
            auditMetadata: { actorName: 'Aktör', auditorName: 'Granskare' }
        };
        expect(should_sync_prepared_audit_to_list(state, 'start')).toBe(true);
        expect(should_sync_prepared_audit_to_list(state, 'audit')).toBe(true);
        expect(should_sync_prepared_audit_to_list(state, 'metadata')).toBe(false);
        expect(should_sync_prepared_audit_to_list({ ...state, auditId: 'a1' }, 'start')).toBe(false);
        expect(should_sync_prepared_audit_to_list({ ...state, auditStatus: 'in_progress' }, 'start')).toBe(false);
        expect(
            should_sync_prepared_audit_to_list(
                { ...state, auditMetadata: { actorName: '', auditorName: 'Granskare' } },
                'start'
            )
        ).toBe(false);
    });
});

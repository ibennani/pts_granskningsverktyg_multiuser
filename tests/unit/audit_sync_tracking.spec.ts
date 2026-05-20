/**
 * Tester för audit_sync_tracking.ts
 */
import { describe, test, expect } from '@jest/globals';
import {
    get_latest_requirement_status_update_iso,
    is_local_audit_content_newer_than,
    has_unsynced_local_audit_changes,
    build_last_local_change_metadata_patch,
    build_last_server_sync_metadata_patch
} from '../../js/logic/audit_sync_tracking.js';

describe('audit_sync_tracking', () => {
    test('get_latest_requirement_status_update_iso hittar senaste tidsstämpel', () => {
        const state = {
            samples: [
                {
                    requirementResults: {
                        r1: { lastStatusUpdate: '2026-05-19T10:00:00.000Z' },
                        r2: { lastStatusUpdate: '2026-05-20T12:00:00.000Z' }
                    }
                }
            ]
        };
        expect(get_latest_requirement_status_update_iso(state)).toBe('2026-05-20T12:00:00.000Z');
    });

    test('is_local_audit_content_newer_than vid samma version', () => {
        const local = {
            auditMetadata: { last_local_change_at: '2026-05-20T12:00:00.000Z' },
            samples: []
        };
        const remote = {
            auditMetadata: { last_server_sync_at: '2026-05-19T10:00:00.000Z' },
            samples: []
        };
        expect(is_local_audit_content_newer_than(local, remote)).toBe(true);
        expect(is_local_audit_content_newer_than(remote, local)).toBe(false);
    });

    test('has_unsynced_local_audit_changes när server saknar sync-tid', () => {
        const state = {
            auditMetadata: { last_local_change_at: '2026-05-20T12:00:00.000Z' },
            samples: []
        };
        expect(has_unsynced_local_audit_changes(state)).toBe(true);
    });

    test('has_unsynced_local_audit_changes false efter synk', () => {
        const state = {
            auditMetadata: {
                last_local_change_at: '2026-05-20T10:00:00.000Z',
                last_server_sync_at: '2026-05-20T12:00:00.000Z'
            },
            samples: []
        };
        expect(has_unsynced_local_audit_changes(state)).toBe(false);
    });

    test('metadata-patch builders', () => {
        expect(build_last_local_change_metadata_patch({ lastStatusUpdate: '2026-05-20T08:00:00.000Z' }, 'now'))
            .toEqual({ last_local_change_at: '2026-05-20T08:00:00.000Z' });
        expect(build_last_server_sync_metadata_patch('2026-05-20T09:00:00.000Z'))
            .toEqual({ last_server_sync_at: '2026-05-20T09:00:00.000Z' });
    });
});

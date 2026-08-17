/**
 * @fileoverview Tester för requirement_audit_nav_sync.ts
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
    prune_synced_leaving_requirement_from_pending_plan,
    requirement_nav_needs_server_sync,
    schedule_background_sync_on_requirement_nav,
    REQUIREMENT_NAV_SYNC_OPTIONS
} from '../../js/logic/requirement_audit_nav_sync.js';
import {
    clear_rule_file_sync_baseline_for_testing,
    note_requirement_result_changed,
    has_pending_audit_sync_plan
} from '../../js/sync/audit_sync_planning.js';

describe('requirement_audit_nav_sync', () => {
    beforeEach(() => {
        clear_rule_file_sync_baseline_for_testing();
    });

    test('requirement_nav_needs_server_sync är false utan ändringar', () => {
        const state = {
            auditMetadata: {
                last_local_change_at: '2026-05-19T10:00:00.000Z',
                last_server_sync_at: '2026-05-19T10:00:00.000Z'
            },
            samples: []
        };
        expect(requirement_nav_needs_server_sync(state)).toBe(false);
    });

    test('requirement_nav_needs_server_sync är true med osparade ändringar', () => {
        const state = {
            auditMetadata: {
                last_local_change_at: '2026-05-20T12:00:00.000Z',
                last_server_sync_at: '2026-05-19T10:00:00.000Z'
            },
            samples: []
        };
        expect(requirement_nav_needs_server_sync(state)).toBe(true);
    });

    test('prune_synced_leaving_requirement_from_pending_plan tar bort synkat krav', () => {
        note_requirement_result_changed('s1', 'r1');
        const state = {
            auditMetadata: {
                last_server_sync_at: '2026-05-20T12:00:00.000Z',
                last_local_change_at: '2026-05-20T12:00:00.000Z'
            },
            samples: [
                {
                    sampleId: 's1',
                    requirementResults: {
                        r1: { lastStatusUpdate: '2026-05-19T10:00:00.000Z' }
                    }
                }
            ]
        };
        prune_synced_leaving_requirement_from_pending_plan(state, 's1', 'r1');
        expect(has_pending_audit_sync_plan()).toBe(false);
    });

    test('schedule_background_sync_on_requirement_nav anropar flush med skip_version_probe', () => {
        const flush = jest.fn(async () => {});
        const getState = jest.fn(() => ({
            auditMetadata: { last_local_change_at: '2026-05-20T12:00:00.000Z' },
            samples: []
        }));
        const dispatch = jest.fn();
        const console_manager = { warn: jest.fn() };

        schedule_background_sync_on_requirement_nav(flush, getState, dispatch, console_manager);

        expect(flush).toHaveBeenCalledWith(getState, dispatch, REQUIREMENT_NAV_SYNC_OPTIONS);
    });
});

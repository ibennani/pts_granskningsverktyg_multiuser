/**
 * @fileoverview Enhetstester för audit_sync_prepare.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client_path = path.join(__dirname, '../../js/api/client.js');
const connectivity_path = path.join(__dirname, '../../js/logic/connectivity_service.js');

const get_audit_version = jest.fn();
const load_audit_with_rule_file = jest.fn();
const clear_audit_sync_pending = jest.fn();

jest.unstable_mockModule(client_path, () => ({
    get_audit_version,
    load_audit_with_rule_file
}));

jest.unstable_mockModule(connectivity_path, () => ({
    clear_audit_sync_pending
}));

describe('audit_sync_prepare', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        get_audit_version.mockResolvedValue({ version: null });
    });

    test('skip när inget osparat och ingen planerad synk', async () => {
        const { clear_rule_file_sync_baseline_for_testing } = await import('../../js/sync/audit_sync_planning.js');
        const { prepare_audit_sync_state } = await import('../../js/sync/audit_sync_prepare.js');
        clear_rule_file_sync_baseline_for_testing();
        const result = await prepare_audit_sync_state(
            {
                auditId: 'a1',
                version: 3,
                auditMetadata: { last_server_sync_at: '2026-06-01T10:00:00.000Z' },
                samples: [],
                ruleFileContent: { x: 1 }
            },
            jest.fn()
        );
        expect(result.action).toBe('skip');
        expect(get_audit_version).toHaveBeenCalledWith('a1');
    });

    test('laddar om från server när version ligger före och lokalt inte är nyare', async () => {
        const { clear_rule_file_sync_baseline_for_testing } = await import('../../js/sync/audit_sync_planning.js');
        const { prepare_audit_sync_state } = await import('../../js/sync/audit_sync_prepare.js');
        clear_rule_file_sync_baseline_for_testing();
        get_audit_version.mockResolvedValueOnce({ version: 8 });
        load_audit_with_rule_file.mockResolvedValueOnce({
            auditId: 'a1',
            version: 8,
            auditMetadata: { last_server_sync_at: '2026-06-02T12:00:00.000Z' },
            samples: [
                {
                    requirementResults: {
                        r1: { lastStatusUpdate: '2026-06-02T12:00:00.000Z' }
                    }
                }
            ],
            ruleFileContent: { ok: true }
        });
        const dispatch = jest.fn();
        const result = await prepare_audit_sync_state(
            {
                auditId: 'a1',
                version: 5,
                auditMetadata: { last_local_change_at: '2026-06-01T08:00:00.000Z' },
                samples: [
                    {
                        requirementResults: {
                            r1: { lastStatusUpdate: '2026-06-01T08:00:00.000Z' }
                        }
                    }
                ],
                ruleFileContent: { ok: true }
            },
            dispatch
        );
        expect(result.action).toBe('reload');
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'REPLACE_STATE_FROM_REMOTE' })
        );
        expect(clear_audit_sync_pending).toHaveBeenCalled();
    });

    test('justerar lokalt versionsnummer när server ligger före och lokalt innehåll är nyare', async () => {
        const { note_requirement_result_changed, clear_rule_file_sync_baseline_for_testing } =
            await import('../../js/sync/audit_sync_planning.js');
        const { prepare_audit_sync_state } = await import('../../js/sync/audit_sync_prepare.js');
        clear_rule_file_sync_baseline_for_testing();
        note_requirement_result_changed('s1', 'r1');
        get_audit_version.mockResolvedValueOnce({ version: 7 });
        load_audit_with_rule_file.mockResolvedValueOnce({
            version: 7,
            auditMetadata: { last_server_sync_at: '2026-06-01T08:00:00.000Z' },
            samples: [
                {
                    requirementResults: {
                        r1: { lastStatusUpdate: '2026-06-01T08:00:00.000Z' }
                    }
                }
            ]
        });
        const dispatch = jest.fn();
        const result = await prepare_audit_sync_state(
            {
                auditId: 'a1',
                version: 5,
                auditMetadata: { last_local_change_at: '2026-06-02T14:00:00.000Z' },
                samples: [
                    {
                        id: 's1',
                        requirementResults: {
                            r1: { lastStatusUpdate: '2026-06-02T14:00:00.000Z' }
                        }
                    }
                ],
                ruleFileContent: { ok: true }
            },
            dispatch
        );
        expect(result.action).toBe('proceed');
        if (result.action === 'proceed') {
            expect(result.state.version).toBe(7);
        }
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_REMOTE_AUDIT_ID',
            payload: expect.objectContaining({
                auditId: 'a1',
                version: 7,
                skip_render: true
            })
        });
    });

    test('pushar lokalt vid väntande hel-PATCH även när should_push är false', async () => {
        const { note_audit_full_sync_required, clear_rule_file_sync_baseline_for_testing } =
            await import('../../js/sync/audit_sync_planning.js');
        const { prepare_audit_sync_state } = await import('../../js/sync/audit_sync_prepare.js');
        clear_rule_file_sync_baseline_for_testing();
        note_audit_full_sync_required();
        get_audit_version.mockResolvedValueOnce({ version: 9 });
        load_audit_with_rule_file.mockResolvedValueOnce({
            version: 9,
            auditMetadata: { last_server_sync_at: '2026-06-09T12:00:00.000Z', last_local_change_at: '2026-06-09T12:00:00.000Z' },
            samples: [{ id: 'old-sample', description: 'Finns kvar på servern' }],
            ruleFileContent: { ok: true }
        });
        const dispatch = jest.fn();
        const result = await prepare_audit_sync_state(
            {
                auditId: 'a1',
                version: 5,
                auditStatus: 'in_progress',
                auditMetadata: {
                    last_local_change_at: '2026-06-01T08:00:00.000Z',
                    last_server_sync_at: '2026-06-09T12:00:00.000Z'
                },
                samples: [],
                ruleFileContent: { ok: true }
            },
            dispatch
        );
        expect(result.action).toBe('proceed');
        expect(dispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'REPLACE_STATE_FROM_REMOTE' })
        );
    });

    test('pushar lokalt vid väntande hel-PATCH trots att has_unsynced är false', async () => {
        const { note_audit_full_sync_required, clear_rule_file_sync_baseline_for_testing } =
            await import('../../js/sync/audit_sync_planning.js');
        const { prepare_audit_sync_state } = await import('../../js/sync/audit_sync_prepare.js');
        clear_rule_file_sync_baseline_for_testing();
        note_audit_full_sync_required();
        get_audit_version.mockResolvedValueOnce({ version: 9 });
        load_audit_with_rule_file.mockResolvedValueOnce({
            version: 9,
            auditMetadata: { last_server_sync_at: '2026-06-08T12:00:00.000Z' },
            samples: [{ id: 'old-sample', description: 'Finns kvar på servern' }],
            ruleFileContent: { ok: true }
        });
        const dispatch = jest.fn();
        const result = await prepare_audit_sync_state(
            {
                auditId: 'a1',
                version: 5,
                auditStatus: 'not_started',
                auditMetadata: {
                    last_local_change_at: '2026-06-09T08:00:00.000Z',
                    last_server_sync_at: '2026-06-09T08:00:00.000Z'
                },
                samples: [],
                ruleFileContent: { ok: true }
            },
            dispatch
        );
        expect(result.action).toBe('proceed');
        expect(dispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'REPLACE_STATE_FROM_REMOTE' })
        );
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_REMOTE_AUDIT_ID',
            payload: expect.objectContaining({
                auditId: 'a1',
                version: 9,
                skip_render: true
            })
        });
    });

    test('alignerar tyst versionsnummer när inget ska synkas men server ligger före', async () => {
        const { clear_rule_file_sync_baseline_for_testing } = await import('../../js/sync/audit_sync_planning.js');
        const { prepare_audit_sync_state } = await import('../../js/sync/audit_sync_prepare.js');
        clear_rule_file_sync_baseline_for_testing();
        get_audit_version.mockResolvedValueOnce({ version: 8 });
        load_audit_with_rule_file.mockResolvedValueOnce({
            version: 8,
            saveFileVersion: '2.1.0',
            auditMetadata: { last_server_sync_at: '2026-06-08T12:00:00.000Z' },
            samples: [],
            ruleFileContent: { ok: true }
        });
        const dispatch = jest.fn();
        const result = await prepare_audit_sync_state(
            {
                auditId: 'a1',
                version: 5,
                auditMetadata: { last_server_sync_at: '2026-06-08T12:00:00.000Z' },
                samples: [],
                ruleFileContent: { ok: true }
            },
            dispatch
        );
        expect(result.action).toBe('reload');
        expect(get_audit_version).toHaveBeenCalledWith('a1');
    });
});

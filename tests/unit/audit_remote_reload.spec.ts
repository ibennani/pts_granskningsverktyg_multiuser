/**
 * @fileoverview Enhetstester för omladdning av granskning när serverversion är nyare.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const client_path = path.join(spec_dir, '../../js/api/client.js');
const collaboration_path = path.join(spec_dir, '../../js/logic/audit_collaboration_notice.js');
const reload_path = path.join(spec_dir, '../../js/logic/audit_remote_reload.ts');

const get_audit_version = jest.fn();
const load_audit_with_rule_file = jest.fn();

jest.unstable_mockModule(client_path, () => ({
    get_audit_version,
    load_audit_with_rule_file
}));

jest.unstable_mockModule(collaboration_path, () => ({
    should_show_audit_collaboration_notice: jest.fn(() => false),
    update_baseline_from_server_full_state: jest.fn()
}));

const { reload_open_audit_if_server_ahead } = await import(reload_path);

describe('reload_open_audit_if_server_ahead', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('omladdar när WebSocket-hint har högre version', async () => {
        const dispatch = jest.fn();
        const getState = () => ({
            auditId: 'a1',
            auditStatus: 'in_progress',
            version: 2
        });
        load_audit_with_rule_file.mockResolvedValue({
            auditId: 'a1',
            auditStatus: 'locked',
            version: 3,
            samples: [{ id: 's1' }],
            saveFileVersion: '2.1.0'
        });

        const reloaded = await reload_open_audit_if_server_ahead({
            getState,
            dispatch,
            StoreActionTypes: { REPLACE_STATE_FROM_REMOTE: 'REPLACE_STATE_FROM_REMOTE' },
            remote_version_hint: 3,
            show_collaboration_notice: false
        });

        expect(reloaded).toBe(true);
        expect(get_audit_version).not.toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'REPLACE_STATE_FROM_REMOTE',
                payload: expect.objectContaining({ auditStatus: 'locked', version: 3 })
            })
        );
    });

    test('omladdar vid samma version men annan status', async () => {
        const dispatch = jest.fn();
        const getState = () => ({
            auditId: 'a1',
            auditStatus: 'in_progress',
            version: 8
        });
        load_audit_with_rule_file.mockResolvedValue({
            auditId: 'a1',
            auditStatus: 'locked',
            version: 8,
            samples: [{ id: 's1' }],
            saveFileVersion: '2.1.0'
        });

        const reloaded = await reload_open_audit_if_server_ahead({
            getState,
            dispatch,
            StoreActionTypes: { REPLACE_STATE_FROM_REMOTE: 'REPLACE_STATE_FROM_REMOTE' },
            remote_version_hint: 8,
            show_collaboration_notice: false
        });

        expect(reloaded).toBe(true);
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'REPLACE_STATE_FROM_REMOTE',
                payload: expect.objectContaining({ auditStatus: 'locked' })
            })
        );
    });

    test('hoppar över när lokal version redan är aktuell och status matchar', async () => {
        const dispatch = jest.fn();
        const getState = () => ({
            auditId: 'a1',
            auditStatus: 'locked',
            version: 5
        });
        load_audit_with_rule_file.mockResolvedValue({
            auditId: 'a1',
            auditStatus: 'locked',
            version: 5,
            samples: [{ id: 's1' }],
            saveFileVersion: '2.1.0'
        });

        const reloaded = await reload_open_audit_if_server_ahead({
            getState,
            dispatch,
            StoreActionTypes: { REPLACE_STATE_FROM_REMOTE: 'REPLACE_STATE_FROM_REMOTE' },
            remote_version_hint: 5
        });

        expect(reloaded).toBe(false);
        expect(dispatch).not.toHaveBeenCalled();
    });
});

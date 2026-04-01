/**
 * Tester för session_boot_merge.js
 */
import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client_path = path.join(__dirname, '../../js/api/client.js');
const server_sync_path = path.join(__dirname, '../../js/logic/server_sync.js');
const audit_open_path = path.join(__dirname, '../../js/logic/audit_open_logic.js');

const load_audit_with_rule_file = jest.fn();
const sync_to_server_now = jest.fn(async () => {});
const navigate_to_default_audit_view = jest.fn();

jest.unstable_mockModule(client_path, () => ({
    load_audit_with_rule_file
}));

jest.unstable_mockModule(server_sync_path, () => ({
    sync_to_server_now
}));

jest.unstable_mockModule(audit_open_path, () => ({
    navigate_to_default_audit_view
}));

let apply_session_boot_merge_from_backup;

beforeAll(async () => {
    const mod = await import('../../js/logic/session_boot_merge.js');
    apply_session_boot_merge_from_backup = mod.apply_session_boot_merge_from_backup;
});

describe('session_boot_merge', () => {
    const StoreActionTypes = {
        LOAD_AUDIT_FROM_FILE: 'LOAD_AUDIT_FROM_FILE',
        REPLACE_STATE_FROM_REMOTE: 'REPLACE_STATE_FROM_REMOTE'
    };

    let dispatch;
    let getState;
    let router;

    beforeEach(() => {
        dispatch = jest.fn(async () => {});
        getState = jest.fn(() => ({}));
        router = jest.fn();
        load_audit_with_rule_file.mockReset();
        sync_to_server_now.mockClear();
        navigate_to_default_audit_view.mockClear();
    });

    test('returnerar applied false när obligatoriska argument saknas', async () => {
        expect(await apply_session_boot_merge_from_backup(null)).toEqual({ applied: false });
        expect(
            await apply_session_boot_merge_from_backup({
                backup_entry: { state: {} },
                dispatch,
                getState: null,
                StoreActionTypes,
                router
            })
        ).toEqual({ applied: false });
    });

    test('utan auditId: laddar lokal state och navigerar', async () => {
        const local = { foo: 1, samples: [] };
        const out = await apply_session_boot_merge_from_backup({
            backup_entry: { state: local },
            dispatch,
            getState,
            StoreActionTypes,
            router
        });
        expect(out.applied).toBe(true);
        expect(dispatch).toHaveBeenCalledWith({
            type: StoreActionTypes.LOAD_AUDIT_FROM_FILE,
            payload: local
        });
        expect(navigate_to_default_audit_view).toHaveBeenCalled();
        expect(load_audit_with_rule_file).not.toHaveBeenCalled();
    });

    test('remote nyare eller lika: REPLACE_STATE_FROM_REMOTE', async () => {
        load_audit_with_rule_file.mockResolvedValue({
            version: 5,
            saveFileVersion: '2.1.0',
            ruleFileContent: {}
        });
        const ValidationLogic = {
            validate_saved_audit_file: jest.fn(() => ({ isValid: true }))
        };
        const local = { auditId: 'a1', version: 3 };
        const out = await apply_session_boot_merge_from_backup({
            backup_entry: { state: local },
            dispatch,
            getState,
            StoreActionTypes,
            ValidationLogic,
            router
        });
        expect(out.applied).toBe(true);
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: StoreActionTypes.REPLACE_STATE_FROM_REMOTE,
                payload: expect.objectContaining({ version: 5 })
            })
        );
        expect(sync_to_server_now).not.toHaveBeenCalled();
    });

    test('lokal nyare än remote: LOAD_AUDIT_FROM_FILE och sync_to_server_now', async () => {
        load_audit_with_rule_file.mockResolvedValue({
            version: 1,
            ruleFileContent: {}
        });
        const ValidationLogic = {
            validate_saved_audit_file: jest.fn(() => ({ isValid: true }))
        };
        const local = { auditId: 'a1', version: 10 };
        const out = await apply_session_boot_merge_from_backup({
            backup_entry: { state: local },
            dispatch,
            getState,
            StoreActionTypes,
            ValidationLogic,
            router
        });
        expect(out.applied).toBe(true);
        expect(dispatch).toHaveBeenCalledWith({
            type: StoreActionTypes.LOAD_AUDIT_FROM_FILE,
            payload: local
        });
        expect(sync_to_server_now).toHaveBeenCalledWith(getState, dispatch);
    });

    test('ogiltig remote: varning och lokal state', async () => {
        load_audit_with_rule_file.mockResolvedValue({ version: 1 });
        const show_global_message = jest.fn();
        const ValidationLogic = {
            validate_saved_audit_file: jest.fn(() => ({ isValid: false, message: 'bad' }))
        };
        const local = { auditId: 'x', version: 1 };
        await apply_session_boot_merge_from_backup({
            backup_entry: { state: local },
            dispatch,
            getState,
            StoreActionTypes,
            ValidationLogic,
            router,
            NotificationComponent: { show_global_message },
            t: (k) => k
        });
        expect(show_global_message).toHaveBeenCalledWith('bad', 'warning');
        expect(dispatch).toHaveBeenCalledWith({
            type: StoreActionTypes.LOAD_AUDIT_FROM_FILE,
            payload: local
        });
    });

    test('nätverksfel: varning och fallback till lokal state', async () => {
        load_audit_with_rule_file.mockRejectedValue(new Error('nät'));
        const show_global_message = jest.fn();
        const local = { auditId: 'y', version: 2 };
        await apply_session_boot_merge_from_backup({
            backup_entry: { state: local },
            dispatch,
            getState,
            StoreActionTypes,
            router,
            NotificationComponent: { show_global_message },
            t: (k, v) => `${k}:${v?.message || ''}`
        });
        expect(show_global_message).toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith({
            type: StoreActionTypes.LOAD_AUDIT_FROM_FILE,
            payload: local
        });
    });
});

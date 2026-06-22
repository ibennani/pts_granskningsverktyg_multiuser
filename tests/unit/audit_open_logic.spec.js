/**
 * Tester för audit_open_logic.js
 */
import { jest, describe, test, expect, beforeAll } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client_module_path = path.join(__dirname, '../../js/api/client.js');
const connectivity_module_path = path.join(__dirname, '../../js/logic/connectivity_service.js');

const load_audit_with_rule_file = jest.fn();
const is_fetch_network_error = jest.fn(() => false);

jest.unstable_mockModule(client_module_path, () => ({
    load_audit_with_rule_file
}));

jest.unstable_mockModule(connectivity_module_path, () => ({
    is_fetch_network_error
}));

let navigate_to_default_audit_view;
let open_audit_by_id;
let download_audit_by_id;

beforeAll(async () => {
    const mod = await import('../../js/logic/audit_open_logic.js');
    navigate_to_default_audit_view = mod.navigate_to_default_audit_view;
    open_audit_by_id = mod.open_audit_by_id;
    download_audit_by_id = mod.download_audit_by_id;
});

describe('audit_open_logic', () => {
    const StoreActionTypes = { LOAD_AUDIT_FROM_FILE: 'LOAD_AUDIT_FROM_FILE' };
    const t = (k) => k;

    test('navigate_to_default_audit_view: not_started utan stickprov → sample_management', () => {
        const router = jest.fn();
        navigate_to_default_audit_view(
            { auditStatus: 'not_started', samples: [] },
            router
        );
        expect(router).toHaveBeenCalledWith('sample_management', {});
    });

    test('navigate_to_default_audit_view: not_started med stickprov → metadata', () => {
        const router = jest.fn();
        navigate_to_default_audit_view(
            { auditStatus: 'not_started', samples: [{}] },
            router
        );
        expect(router).toHaveBeenCalledWith('metadata', {});
    });

    test('navigate_to_default_audit_view: annan status → audit_overview', () => {
        const router = jest.fn();
        navigate_to_default_audit_view({ auditStatus: 'in_progress', samples: [] }, router);
        expect(router).toHaveBeenCalledWith('audit_overview', {});
    });

    test('navigate_to_default_audit_view: ingen åtgärd vid ogiltig indata', () => {
        const router = jest.fn();
        navigate_to_default_audit_view(null, router);
        expect(router).not.toHaveBeenCalled();
    });

    test('open_audit_by_id: false när obligatoriska parametrar saknas', async () => {
        expect(await open_audit_by_id({})).toBe(false);
        expect(await open_audit_by_id({ audit_id: '1', dispatch: jest.fn() })).toBe(false);
    });

    test('open_audit_by_id: lyckad laddning och validering', async () => {
        const full = {
            auditStatus: 'in_progress',
            samples: [],
            ruleFileContent: { metadata: { version: '1' } }
        };
        load_audit_with_rule_file.mockResolvedValue(full);
        const dispatch = jest.fn();
        const router = jest.fn();
        const NotificationComponent = { show_global_message: jest.fn() };
        const ValidationLogic = {
            validate_saved_audit_file: jest.fn(() => ({ isValid: true }))
        };

        const ok = await open_audit_by_id({
            audit_id: '99',
            dispatch,
            StoreActionTypes,
            ValidationLogic,
            router,
            NotificationComponent,
            t
        });

        expect(ok).toBe(true);
        expect(dispatch).toHaveBeenCalledWith({
            type: StoreActionTypes.LOAD_AUDIT_FROM_FILE,
            payload: full
        });
        expect(router).toHaveBeenCalled();
        expect(NotificationComponent.show_global_message).toHaveBeenCalled();
    });

    test('open_audit_by_id: ogiltig fil visar felmeddelande', async () => {
        load_audit_with_rule_file.mockResolvedValue({ x: 1 });
        const NotificationComponent = { show_global_message: jest.fn() };
        const ValidationLogic = {
            validate_saved_audit_file: jest.fn(() => ({ isValid: false, message: 'Fel' }))
        };

        const ok = await open_audit_by_id({
            audit_id: '1',
            dispatch: jest.fn(),
            StoreActionTypes,
            ValidationLogic,
            router: jest.fn(),
            NotificationComponent,
            t
        });

        expect(ok).toBe(false);
        expect(NotificationComponent.show_global_message).toHaveBeenCalledWith('Fel', 'error');
    });

    test('open_audit_by_id: nätverksfel → varningsmeddelande', async () => {
        load_audit_with_rule_file.mockRejectedValue(new Error('offline'));
        is_fetch_network_error.mockReturnValue(true);
        const NotificationComponent = { show_global_message: jest.fn() };

        const ok = await open_audit_by_id({
            audit_id: '1',
            dispatch: jest.fn(),
            StoreActionTypes,
            ValidationLogic: { validate_saved_audit_file: jest.fn() },
            router: jest.fn(),
            NotificationComponent,
            t: (k) => k
        });

        expect(ok).toBe(false);
        expect(is_fetch_network_error).toHaveBeenCalled();
        expect(NotificationComponent.show_global_message).toHaveBeenCalledWith(
            'connectivity_offline_cannot_open_audit',
            'warning'
        );
        is_fetch_network_error.mockReturnValue(false);
    });

    test('download_audit_by_id: false utan obligatoriska deps', async () => {
        expect(await download_audit_by_id({ audit_id: '1' })).toBe(false);
    });

    test('download_audit_by_id: anropar save vid giltig data', async () => {
        const full = { ruleFileContent: { metadata: {} } };
        load_audit_with_rule_file.mockResolvedValue(full);
        const save_audit_to_json_file = jest.fn().mockResolvedValue(undefined);
        const ValidationLogic = {
            validate_saved_audit_file: jest.fn(() => ({ isValid: true }))
        };
        const SaveAuditLogic = { save_audit_to_json_file };
        const show_global_message = jest.fn();
        const NotificationComponent = { show_global_message };

        const ok = await download_audit_by_id({
            audit_id: '5',
            ValidationLogic,
            SaveAuditLogic,
            NotificationComponent,
            t
        });

        expect(ok).toBe(true);
        expect(save_audit_to_json_file).toHaveBeenCalledWith(
            full,
            t,
            expect.any(Function)
        );
    });

    test('download_audit_by_id: ogiltig data visar fel', async () => {
        load_audit_with_rule_file.mockResolvedValue({});
        const show = jest.fn();
        const ValidationLogic = {
            validate_saved_audit_file: jest.fn(() => ({ isValid: false }))
        };

        const ok = await download_audit_by_id({
            audit_id: '1',
            ValidationLogic,
            SaveAuditLogic: { save_audit_to_json_file: jest.fn() },
            NotificationComponent: { show_global_message: show },
            t
        });

        expect(ok).toBe(false);
        expect(show).toHaveBeenCalledWith('error_invalid_saved_audit_file', 'error');
    });
});

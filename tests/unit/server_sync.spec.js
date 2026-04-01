/**
 * Tester för server_sync.js
 */
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client_path = path.join(__dirname, '../../js/api/client.js');
const connectivity_path = path.join(__dirname, '../../js/logic/connectivity_service.js');

const update_audit = jest.fn();
const import_audit = jest.fn();
const update_rule = jest.fn();
const load_audit_with_rule_file = jest.fn();
const clear_audit_sync_pending = jest.fn();
const clear_rulefile_sync_pending = jest.fn();
const is_fetch_network_error = jest.fn(() => false);
const mark_audit_sync_pending = jest.fn();
const mark_rulefile_sync_pending = jest.fn();
const notify_network_unreachable_for_sync = jest.fn();

jest.unstable_mockModule(client_path, () => ({
    update_audit,
    import_audit,
    update_rule,
    load_audit_with_rule_file
}));

jest.unstable_mockModule(connectivity_path, () => ({
    clear_audit_sync_pending,
    clear_rulefile_sync_pending,
    is_fetch_network_error,
    mark_audit_sync_pending,
    mark_rulefile_sync_pending,
    notify_network_unreachable_for_sync
}));

let schedule_sync_rulefile_to_server;
let flush_sync_rulefile_to_server;
let schedule_sync_to_server;
let sync_to_server_now;
let flush_sync_to_server;

beforeAll(async () => {
    const mod = await import('../../js/logic/server_sync.js');
    schedule_sync_rulefile_to_server = mod.schedule_sync_rulefile_to_server;
    flush_sync_rulefile_to_server = mod.flush_sync_rulefile_to_server;
    schedule_sync_to_server = mod.schedule_sync_to_server;
    sync_to_server_now = mod.sync_to_server_now;
    flush_sync_to_server = mod.flush_sync_to_server;
});

function base_audit_state(overrides = {}) {
    return {
        auditStatus: 'in_progress',
        auditMetadata: {},
        samples: [],
        ruleFileContent: { metadata: { version: '1' } },
        ...overrides
    };
}

describe('server_sync', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
        update_audit.mockResolvedValue({ version: 9, ruleSetId: 'rs1' });
        import_audit.mockResolvedValue({ auditId: 'new-a', version: 1, ruleSetId: null });
        update_rule.mockResolvedValue({ content: { ok: true }, version: 2 });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('sync_to_server_now gör inget när getState returnerar null', async () => {
        await sync_to_server_now(() => null, jest.fn());
        expect(update_audit).not.toHaveBeenCalled();
        expect(import_audit).not.toHaveBeenCalled();
    });

    test('sync_to_server_now med auditId anropar update_audit', async () => {
        const dispatch = jest.fn();
        const state = base_audit_state({ auditId: 'a1', version: 3 });
        await sync_to_server_now(() => state, dispatch);
        expect(update_audit).toHaveBeenCalledWith(
            'a1',
            expect.objectContaining({
                metadata: expect.any(Object),
                status: 'in_progress',
                expectedVersion: 3,
                ruleFileContent: state.ruleFileContent
            })
        );
        expect(clear_audit_sync_pending).toHaveBeenCalled();
    });

    test('sync_to_server_now utan auditId anropar import_audit', async () => {
        const dispatch = jest.fn();
        const state = base_audit_state({ auditId: null });
        delete state.auditId;
        await sync_to_server_now(() => state, dispatch);
        expect(import_audit).toHaveBeenCalled();
        expect(update_audit).not.toHaveBeenCalled();
    });

    test('flush_sync_to_server hoppar över när not_started utan auditId', async () => {
        const dispatch = jest.fn();
        const state = base_audit_state({ auditStatus: 'not_started' });
        await flush_sync_to_server(() => state, dispatch);
        expect(update_audit).not.toHaveBeenCalled();
        expect(import_audit).not.toHaveBeenCalled();
    });

    test('schedule_sync_to_server debouncar och kör update_audit', async () => {
        jest.useFakeTimers();
        const dispatch = jest.fn();
        const state = base_audit_state({ auditId: 'z', version: 1 });
        schedule_sync_to_server(state, dispatch);
        expect(update_audit).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(500);
        expect(update_audit).toHaveBeenCalledWith('z', expect.any(Object));
    });

    test('flush_sync_rulefile_to_server synkar regel när rulefile_editing', async () => {
        const dispatch = jest.fn();
        const state = base_audit_state({
            auditStatus: 'rulefile_editing',
            ruleSetId: 'rs',
            ruleFileIsPublished: false
        });
        await flush_sync_rulefile_to_server(() => state, dispatch);
        expect(update_rule).toHaveBeenCalledWith('rs', { content: state.ruleFileContent });
        expect(clear_rulefile_sync_pending).toHaveBeenCalled();
    });

    test('schedule_sync_rulefile_to_server debouncar regelfilsync', async () => {
        jest.useFakeTimers();
        const dispatch = jest.fn();
        const state = base_audit_state({
            auditStatus: 'rulefile_editing',
            ruleSetId: 'rs2',
            ruleFileIsPublished: false
        });
        schedule_sync_rulefile_to_server(() => state, dispatch);
        await jest.advanceTimersByTimeAsync(500);
        expect(update_rule).toHaveBeenCalled();
    });
});

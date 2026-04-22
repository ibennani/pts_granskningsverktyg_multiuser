/**
 * Tester för server_sync.js
 */
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import { app_runtime_refs } from '../../js/utils/app_runtime_refs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client_path = path.join(__dirname, '../../js/api/client.js');
const connectivity_path = path.join(__dirname, '../../js/logic/connectivity_service.js');

const update_audit = jest.fn();
const import_audit = jest.fn();
const update_rule = jest.fn();
const patch_rule_content_part = jest.fn();
const load_audit_with_rule_file = jest.fn();
const get_auth_token = jest.fn(() => 'mock-jwt');
const get_websocket_url = jest.fn(() => 'ws://localhost');
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
    patch_rule_content_part,
    load_audit_with_rule_file,
    get_auth_token,
    get_websocket_url
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
    let broadcast_instances;

    beforeEach(() => {
        jest.clearAllMocks();
        get_auth_token.mockImplementation(() => 'mock-jwt');
        broadcast_instances = [];
        if (typeof global.BroadcastChannel !== 'undefined') {
            delete global.BroadcastChannel;
        }
        global.BroadcastChannel = jest.fn().mockImplementation(() => {
            const inst = { postMessage: jest.fn(), close: jest.fn() };
            broadcast_instances.push(inst);
            return inst;
        });
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
        update_audit.mockResolvedValue({ version: 9, ruleSetId: 'rs1' });
        import_audit.mockResolvedValue({ auditId: 'new-a', version: 1, ruleSetId: null });
        update_rule.mockResolvedValue({ content: { ok: true }, version: 2 });
        is_fetch_network_error.mockImplementation(() => false);
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

    test('flush_sync_to_server hoppar över när ingen auth-token finns', async () => {
        get_auth_token.mockImplementation(() => null);
        const dispatch = jest.fn();
        const state = base_audit_state({ auditId: 'a1', version: 1 });
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

    test('flush_sync_to_server rensar debounce och synkar direkt', async () => {
        jest.useFakeTimers();
        const dispatch = jest.fn();
        const state = base_audit_state({ auditId: 'deb', version: 1 });
        schedule_sync_to_server(state, dispatch);
        expect(update_audit).not.toHaveBeenCalled();
        await flush_sync_to_server(() => state, dispatch);
        expect(update_audit).toHaveBeenCalledWith('deb', expect.any(Object));
    });

    test('run_sync: 409 med existingAuditId sätter dispatch SET_REMOTE_AUDIT_ID', async () => {
        const err = Object.assign(new Error('konflikt'), {
            status: 409,
            existingAuditId: 'existing-1'
        });
        update_audit.mockRejectedValueOnce(err);
        const dispatch = jest.fn();
        const state = base_audit_state({ auditId: 'a1', version: 1 });
        await sync_to_server_now(() => state, dispatch);
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_REMOTE_AUDIT_ID',
            payload: {
                auditId: 'existing-1',
                ruleSetId: null,
                version: null,
                skip_render: true
            }
        });
        expect(clear_audit_sync_pending).toHaveBeenCalled();
    });

    test('run_sync: 409 utan existingAuditId försöker retry med serverns version', async () => {
        const err = Object.assign(new Error('version'), { status: 409 });
        update_audit
            .mockRejectedValueOnce(err)
            .mockResolvedValueOnce({
                auditId: 'a1',
                ruleSetId: 'rs1',
                version: 9,
                saveFileVersion: '2.1.0',
                samples: [],
                ruleFileContent: {}
            });
        load_audit_with_rule_file.mockResolvedValueOnce({
            version: 7,
            saveFileVersion: '2.1.0',
            samples: [],
            ruleFileContent: {}
        });
        const dispatch = jest.fn();
        const state = base_audit_state({ auditId: 'a1', version: 1 });
        await sync_to_server_now(() => state, dispatch);
        expect(load_audit_with_rule_file).toHaveBeenCalledWith('a1');
        expect(update_audit).toHaveBeenCalledTimes(2);
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_REMOTE_AUDIT_ID',
            payload: expect.objectContaining({ auditId: 'a1', version: 9, skip_render: true })
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'UPDATE_METADATA',
            payload: expect.objectContaining({ skip_server_sync: true })
        });
    });

    test('run_sync: 404 granskning borttagen visar modalspår', async () => {
        const err = Object.assign(new Error('Granskning hittades inte'), { status: 404 });
        update_audit.mockRejectedValueOnce(err);
        window.__gv_current_view_name = 'metadata';
        window.__GV_AUDIT_DELETED_MODAL_SHOWN__ = false;
        const show_global = jest.fn();
        app_runtime_refs.notification_component = { show_global_message: show_global };
        window.Translation = { t: (k) => k };
        const dispatch = jest.fn();
        const state = base_audit_state({ auditId: 'gone', version: 1 });
        await sync_to_server_now(() => state, dispatch);
        expect(show_global).toHaveBeenCalled();
        delete window.__gv_current_view_name;
        app_runtime_refs.notification_component = null;
        delete window.Translation;
        delete window.__GV_AUDIT_DELETED_MODAL_SHOWN__;
    });

    test('run_sync: nätverksfel (fetch kastar) markerar väntande synk', async () => {
        is_fetch_network_error.mockImplementation((e) => e instanceof TypeError);
        update_audit.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        const dispatch = jest.fn();
        const state = base_audit_state({ auditId: 'a1', version: 1 });
        await sync_to_server_now(() => state, dispatch);
        expect(mark_audit_sync_pending).toHaveBeenCalled();
        expect(notify_network_unreachable_for_sync).toHaveBeenCalled();
    });

    test('run_sync_rulefile: 409 sätter väntande och visar felmeddelande', async () => {
        const err = Object.assign(new Error('Konflikt'), { status: 409 });
        update_rule.mockRejectedValueOnce(err);
        const show_global = jest.fn();
        app_runtime_refs.notification_component = { show_global_message: show_global };
        window.Translation = { t: (k) => `t:${k}` };
        const dispatch = jest.fn();
        const state = base_audit_state({
            auditStatus: 'rulefile_editing',
            ruleSetId: 'rs',
            ruleFileIsPublished: false
        });
        await flush_sync_rulefile_to_server(() => state, dispatch);
        expect(mark_rulefile_sync_pending).toHaveBeenCalled();
        expect(show_global).toHaveBeenCalled();
        app_runtime_refs.notification_component = null;
        delete window.Translation;
    });

    test('run_sync_rulefile: 404 sätter väntande och visar felmeddelande', async () => {
        const err = Object.assign(new Error('Saknas'), { status: 404 });
        update_rule.mockRejectedValueOnce(err);
        const show_global = jest.fn();
        app_runtime_refs.notification_component = { show_global_message: show_global };
        window.Translation = { t: (k) => `t:${k}` };
        const dispatch = jest.fn();
        const state = base_audit_state({
            auditStatus: 'rulefile_editing',
            ruleSetId: 'rs',
            ruleFileIsPublished: false
        });
        await flush_sync_rulefile_to_server(() => state, dispatch);
        expect(mark_rulefile_sync_pending).toHaveBeenCalled();
        expect(show_global).toHaveBeenCalled();
        app_runtime_refs.notification_component = null;
        delete window.Translation;
    });

    test('BroadcastChannel skickar audit-updated efter lyckad PATCH-synk', async () => {
        const dispatch = jest.fn();
        const state = base_audit_state({ auditId: 'patch-id', version: 2 });
        await sync_to_server_now(() => state, dispatch);
        expect(global.BroadcastChannel).toHaveBeenCalledWith('granskningsverktyget-audit-updates');
        expect(broadcast_instances.length).toBeGreaterThan(0);
        const ch = broadcast_instances[broadcast_instances.length - 1];
        expect(ch.postMessage).toHaveBeenCalledWith({
            type: 'audit-updated',
            auditId: 'patch-id'
        });
        expect(ch.close).toHaveBeenCalled();
    });

    test('BroadcastChannel skickas efter lyckad import-synk utan auditId', async () => {
        const dispatch = jest.fn();
        const state = base_audit_state({ auditId: null });
        delete state.auditId;
        await sync_to_server_now(() => state, dispatch);
        expect(import_audit).toHaveBeenCalled();
        expect(global.BroadcastChannel).toHaveBeenCalledWith('granskningsverktyget-audit-updates');
        const ch = broadcast_instances[broadcast_instances.length - 1];
        expect(ch.postMessage).toHaveBeenCalledWith({
            type: 'audit-updated',
            auditId: 'new-a'
        });
    });

    test('404 granskning: ModalComponent.show och navigering till audit_audits', async () => {
        const err = Object.assign(new Error('Granskning hittades inte'), { status: 404 });
        update_audit.mockRejectedValueOnce(err);
        window.__gv_current_view_name = 'metadata';
        window.__GV_AUDIT_DELETED_MODAL_SHOWN__ = false;

        const modal_show = jest.fn((cfg, render_cb) => {
            expect(cfg.h1_text).toBe('audit_deleted_modal_title');
            const container = document.createElement('div');
            const modal_instance = { close: jest.fn() };
            render_cb(container, modal_instance);
            const btn = container.querySelector('button');
            expect(btn).toBeTruthy();
            btn.click();
            expect(modal_instance.close).toHaveBeenCalled();
        });

        app_runtime_refs.modal_component = { show: modal_show };
        window.Helpers = {
            create_element(tag, opts = {}) {
                const el = document.createElement(tag);
                if (opts.class_name) {
                    el.className = Array.isArray(opts.class_name)
                        ? opts.class_name.join(' ')
                        : opts.class_name;
                }
                if (opts.text_content) {
                    el.textContent = opts.text_content;
                }
                return el;
            }
        };
        window.Translation = { t: (k) => k };

        const dispatch = jest.fn();
        const state = base_audit_state({ auditId: 'gone', version: 1 });
        await sync_to_server_now(() => state, dispatch);

        expect(modal_show).toHaveBeenCalled();

        app_runtime_refs.modal_component = null;
        delete window.Helpers;
        delete window.Translation;
        delete window.__gv_current_view_name;
        delete window.__GV_AUDIT_DELETED_MODAL_SHOWN__;
    });
});

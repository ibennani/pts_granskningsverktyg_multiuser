/**
 * Tester för connectivity_service.js
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server_sync_path = path.join(__dirname, '../../js/logic/server_sync.js');

describe('connectivity_service', () => {
    let is_fetch_network_error;
    let mark_audit_sync_pending;
    let mark_rulefile_sync_pending;
    let clear_audit_sync_pending;
    let clear_rulefile_sync_pending;
    let has_pending_server_sync;
    let notify_network_unreachable_for_sync;
    let init_connectivity_service;

    beforeEach(async () => {
        jest.resetModules();
        const mod = await import('../../js/logic/connectivity_service.js');
        is_fetch_network_error = mod.is_fetch_network_error;
        mark_audit_sync_pending = mod.mark_audit_sync_pending;
        mark_rulefile_sync_pending = mod.mark_rulefile_sync_pending;
        clear_audit_sync_pending = mod.clear_audit_sync_pending;
        clear_rulefile_sync_pending = mod.clear_rulefile_sync_pending;
        has_pending_server_sync = mod.has_pending_server_sync;
        notify_network_unreachable_for_sync = mod.notify_network_unreachable_for_sync;
        init_connectivity_service = mod.init_connectivity_service;
    });

    describe('is_fetch_network_error', () => {
        test('false för null och primitiver', () => {
            expect(is_fetch_network_error(null)).toBe(false);
            expect(is_fetch_network_error(undefined)).toBe(false);
            expect(is_fetch_network_error('x')).toBe(false);
        });

        test('false när HTTP-status är satt', () => {
            expect(is_fetch_network_error({ status: 404, message: 'n/a' })).toBe(false);
        });

        test('true för TypeError', () => {
            expect(is_fetch_network_error({ name: 'TypeError', message: 'x' })).toBe(true);
        });

        test('true för typiska nätverksmeddelanden', () => {
            expect(is_fetch_network_error({ message: 'Failed to fetch' })).toBe(true);
            expect(is_fetch_network_error({ message: 'NetworkError when attempting' })).toBe(true);
        });
    });

    describe('pending-flaggor', () => {
        test('mark och clear audit', () => {
            clear_audit_sync_pending();
            clear_rulefile_sync_pending();
            expect(has_pending_server_sync()).toBe(false);
            mark_audit_sync_pending();
            expect(has_pending_server_sync()).toBe(true);
            clear_audit_sync_pending();
            expect(has_pending_server_sync()).toBe(false);
        });

        test('mark och clear regelfil', () => {
            clear_audit_sync_pending();
            clear_rulefile_sync_pending();
            mark_rulefile_sync_pending();
            expect(has_pending_server_sync()).toBe(true);
            clear_rulefile_sync_pending();
            expect(has_pending_server_sync()).toBe(false);
        });
    });

    describe('notify_network_unreachable_for_sync', () => {
        test('visar varning när NotificationComponent och Translation finns', async () => {
            const show = jest.fn();
            window.NotificationComponent = { show_global_message: show };
            window.Translation = { t: (k) => k };
            notify_network_unreachable_for_sync();
            expect(show).toHaveBeenCalledWith('connectivity_offline_message', 'warning');
            delete window.NotificationComponent;
            delete window.Translation;
        });
    });

    describe('init_connectivity_service', () => {
        test('registrerar online och offline på window', async () => {
            jest.spyOn(window, 'addEventListener').mockImplementation(() => {});
            const orig_get = document.getElementById;
            document.getElementById = jest.fn(() => null);
            Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

            init_connectivity_service({
                getState: () => ({}),
                dispatch: jest.fn()
            });

            expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
            expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));

            window.addEventListener.mockRestore();
            document.getElementById = orig_get;
        });

        test('online-händelse anropar flush från server_sync', async () => {
            jest.resetModules();
            const flush_sync_to_server = jest.fn(async () => {});
            const flush_sync_rulefile_to_server = jest.fn(async () => {});
            jest.unstable_mockModule(server_sync_path, () => ({
                flush_sync_to_server,
                flush_sync_rulefile_to_server
            }));
            const mod = await import('../../js/logic/connectivity_service.js');
            const {
                init_connectivity_service,
                mark_audit_sync_pending,
                clear_audit_sync_pending
            } = mod;
            clear_audit_sync_pending();
            mark_audit_sync_pending();

            const listeners = [];
            jest.spyOn(window, 'addEventListener').mockImplementation((ev, fn) => {
                listeners.push([ev, fn]);
            });
            const orig_get = document.getElementById;
            document.getElementById = jest.fn(() => null);
            Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

            init_connectivity_service({
                getState: () => ({ auditId: 'a1' }),
                dispatch: jest.fn()
            });

            const online_handler = listeners.find(([e]) => e === 'online')[1];
            online_handler();
            await new Promise((r) => setTimeout(r, 0));
            await new Promise((r) => setTimeout(r, 0));

            expect(flush_sync_to_server).toHaveBeenCalled();
            expect(flush_sync_rulefile_to_server).toHaveBeenCalled();

            window.addEventListener.mockRestore();
            document.getElementById = orig_get;
        });

        test('init med top_bar anropar NotificationComponent', async () => {
            jest.resetModules();
            const mod = await import('../../js/logic/connectivity_service.js');
            const { init_connectivity_service } = mod;
            const top = document.createElement('div');
            top.id = 'global-action-bar-top';
            const orig_get = document.getElementById;
            document.getElementById = jest.fn((id) => (id === 'global-action-bar-top' ? top : null));
            const init_p = jest.fn().mockResolvedValue(undefined);
            const append = jest.fn();
            window.NotificationComponent = {
                init: init_p,
                append_global_message_areas_to: append
            };
            Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

            await init_connectivity_service({
                getState: () => ({}),
                dispatch: jest.fn()
            });

            await new Promise((r) => setTimeout(r, 0));
            await new Promise((r) => setTimeout(r, 0));
            expect(init_p).toHaveBeenCalled();
            expect(append).toHaveBeenCalledWith(top);

            document.getElementById = orig_get;
            delete window.NotificationComponent;
        });
    });
});

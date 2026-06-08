/**
 * Tester för connectivity_service.js
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import { app_runtime_refs } from '../../js/utils/app_runtime_refs.js';

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
            app_runtime_refs.notification_component = { show_global_message: show };
            window.Translation = { t: (k) => k };
            Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
            notify_network_unreachable_for_sync();
            expect(show).toHaveBeenCalledWith('connectivity_offline_message', 'warning');
            app_runtime_refs.notification_component = null;
            delete window.Translation;
        });
    });

    describe('refresh_connectivity_banner', () => {
        test('visar osynkad-varning när lokalt är nyare än server', async () => {
            const mod = await import('../../js/logic/connectivity_service.js');
            const { refresh_connectivity_banner, clear_audit_sync_pending } = mod;
            clear_audit_sync_pending();
            const show = jest.fn();
            app_runtime_refs.notification_component = { show_global_message: show, clear_global_message: jest.fn() };
            window.Translation = { t: (k) => k };
            Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

            refresh_connectivity_banner();
            expect(show).not.toHaveBeenCalled();

            mod.init_connectivity_service({
                getState: () => ({
                    auditMetadata: {
                        last_local_change_at: '2026-05-20T14:00:00.000Z',
                        last_server_sync_at: '2026-05-19T08:00:00.000Z'
                    },
                    samples: []
                }),
                dispatch: jest.fn()
            });
            refresh_connectivity_banner();
            expect(show).toHaveBeenCalledWith('connectivity_unsynced_local_message', 'warning');

            app_runtime_refs.notification_component = null;
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

        test('init med app-main-view-root anropar NotificationComponent', async () => {
            jest.resetModules();
            const { app_runtime_refs: runtime } = await import('../../js/utils/app_runtime_refs.js');
            const mod = await import('../../js/logic/connectivity_service.js');
            const { init_connectivity_service } = mod;
            const main_el = document.createElement('main');
            main_el.id = 'app-main-view-root';
            const host = document.createElement('div');
            host.id = 'app-main-view-content';
            main_el.appendChild(host);
            const orig_get = document.getElementById;
            document.getElementById = jest.fn((id) => (id === 'app-main-view-root' ? main_el : null));
            const init_p = jest.fn().mockResolvedValue(undefined);
            const append = jest.fn();
            runtime.notification_component = {
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
            expect(append).toHaveBeenCalledWith(main_el);

            document.getElementById = orig_get;
        });

        test('periodiskt omförsök var 30:e sekund när synk väntar', async () => {
            jest.useFakeTimers();
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
                reset_connectivity_service_for_testing,
                PENDING_SYNC_RETRY_INTERVAL_MS
            } = mod;
            reset_connectivity_service_for_testing();
            mark_audit_sync_pending();

            const listeners = [];
            jest.spyOn(window, 'addEventListener').mockImplementation((ev, fn) => {
                listeners.push([ev, fn]);
            });
            const orig_get = document.getElementById;
            document.getElementById = jest.fn(() => null);
            Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
            Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });

            init_connectivity_service({
                getState: () => ({ auditId: 'a1', auditMetadata: {} }),
                dispatch: jest.fn()
            });

            expect(flush_sync_to_server).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(PENDING_SYNC_RETRY_INTERVAL_MS);
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            expect(flush_sync_to_server).toHaveBeenCalledTimes(1);
            expect(flush_sync_rulefile_to_server).toHaveBeenCalledTimes(1);

            await jest.advanceTimersByTimeAsync(PENDING_SYNC_RETRY_INTERVAL_MS);
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            expect(flush_sync_to_server).toHaveBeenCalledTimes(2);

            reset_connectivity_service_for_testing();
            window.addEventListener.mockRestore();
            document.getElementById = orig_get;
            jest.useRealTimers();
        });

        test('periodiskt omförsök körs inte när fliken är dold', async () => {
            jest.useFakeTimers();
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
                reset_connectivity_service_for_testing,
                PENDING_SYNC_RETRY_INTERVAL_MS
            } = mod;
            reset_connectivity_service_for_testing();
            mark_audit_sync_pending();

            jest.spyOn(window, 'addEventListener').mockImplementation(() => {});
            const orig_get = document.getElementById;
            document.getElementById = jest.fn(() => null);
            Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
            Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });

            init_connectivity_service({
                getState: () => ({ auditId: 'a1' }),
                dispatch: jest.fn()
            });

            jest.advanceTimersByTime(PENDING_SYNC_RETRY_INTERVAL_MS);
            await Promise.resolve();

            expect(flush_sync_to_server).not.toHaveBeenCalled();

            reset_connectivity_service_for_testing();
            window.addEventListener.mockRestore();
            document.getElementById = orig_get;
            jest.useRealTimers();
        });
    });
});

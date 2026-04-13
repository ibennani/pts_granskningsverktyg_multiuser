import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { clear_same_origin_sw_and_caches } from '../../js/utils/clear_same_origin_sw_and_caches.js';

describe('clear_same_origin_sw_and_caches', () => {
    const originalNavigator = globalThis.navigator;
    const originalCaches = globalThis.caches;

    afterEach(() => {
        Object.defineProperty(globalThis, 'navigator', {
            value: originalNavigator,
            configurable: true,
            writable: true
        });
        Object.defineProperty(globalThis, 'caches', {
            value: originalCaches,
            configurable: true,
            writable: true
        });
    });

    test('avregistrerar alla service workers', async () => {
        const unregister = jest.fn().mockResolvedValue(true);
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                serviceWorker: {
                    getRegistrations: jest.fn().mockResolvedValue([
                        { unregister },
                        { unregister }
                    ])
                }
            },
            configurable: true,
            writable: true
        });
        Object.defineProperty(globalThis, 'caches', {
            value: { keys: jest.fn().mockResolvedValue([]) },
            configurable: true,
            writable: true
        });
        await clear_same_origin_sw_and_caches();
        expect(unregister).toHaveBeenCalledTimes(2);
    });

    test('tar bort alla cache-namn', async () => {
        Object.defineProperty(globalThis, 'navigator', {
            value: { serviceWorker: undefined },
            configurable: true,
            writable: true
        });
        const delete_fn = jest.fn().mockResolvedValue(true);
        Object.defineProperty(globalThis, 'caches', {
            value: {
                keys: jest.fn().mockResolvedValue(['a', 'b']),
                delete: delete_fn
            },
            configurable: true,
            writable: true
        });
        await clear_same_origin_sw_and_caches();
        expect(delete_fn).toHaveBeenCalledWith('a');
        expect(delete_fn).toHaveBeenCalledWith('b');
    });

    test('kastar inte om caches saknas', async () => {
        Object.defineProperty(globalThis, 'navigator', {
            value: { serviceWorker: undefined },
            configurable: true,
            writable: true
        });
        Object.defineProperty(globalThis, 'caches', {
            value: undefined,
            configurable: true,
            writable: true
        });
        await expect(clear_same_origin_sw_and_caches()).resolves.toBeUndefined();
    });
});

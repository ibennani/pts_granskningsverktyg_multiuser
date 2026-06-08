import { jest, describe, test, expect } from '@jest/globals';
import { hard_reload_page } from '../../js/utils/hard_reload_page.js';

describe('hard_reload_page', () => {
    test('prefetchar dokument utan cache och navigerar med __reload', async () => {
        const original_fetch = globalThis.fetch;
        const original_navigator = globalThis.navigator;
        globalThis.fetch = jest.fn().mockResolvedValue({ ok: true });
        Object.defineProperty(globalThis, 'navigator', {
            value: { onLine: true, serviceWorker: undefined },
            configurable: true
        });
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete window.location;
        window.location = {
            href: 'http://localhost/v2/start#home',
            origin: 'http://localhost',
            pathname: '/v2/start',
            hash: '#home',
            replace: jest.fn()
        };

        await hard_reload_page();

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('__reload='),
            expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' })
        );

        globalThis.fetch = original_fetch;
        Object.defineProperty(globalThis, 'navigator', {
            value: original_navigator,
            configurable: true
        });
    });

    test('avbryter offline när abort_when_offline är true', async () => {
        const replace_fn = jest.fn();
        const original_fetch = globalThis.fetch;
        const original_navigator = globalThis.navigator;
        globalThis.fetch = jest.fn();
        Object.defineProperty(globalThis, 'navigator', {
            value: { onLine: false },
            configurable: true
        });
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete window.location;
        window.location = {
            href: 'http://localhost/v2/start',
            origin: 'http://localhost',
            pathname: '/v2/start',
            hash: '',
            replace: replace_fn
        };

        await hard_reload_page({ abort_when_offline: true });
        expect(globalThis.fetch).not.toHaveBeenCalled();
        expect(replace_fn).not.toHaveBeenCalled();

        globalThis.fetch = original_fetch;
        Object.defineProperty(globalThis, 'navigator', {
            value: original_navigator,
            configurable: true
        });
    });
});

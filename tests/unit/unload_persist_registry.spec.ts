/**
 * Tester för unload_persist_registry.ts
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
    clear_unload_persist_hooks_for_testing,
    register_unload_persist_hook,
    run_unload_persist_hooks,
    unregister_unload_persist_hook
} from '../../js/logic/unload_persist_registry.js';

describe('unload_persist_registry', () => {
    beforeEach(() => {
        clear_unload_persist_hooks_for_testing();
    });

    test('kör registrerade hooks i registreringsordning', () => {
        const order = [];
        register_unload_persist_hook('a', () => { order.push('a'); });
        register_unload_persist_hook('b', () => { order.push('b'); });
        run_unload_persist_hooks('pagehide');
        expect(order).toEqual(['a', 'b']);
    });

    test('unregister tar bort hook', () => {
        const fn = jest.fn();
        register_unload_persist_hook('x', fn);
        unregister_unload_persist_hook('x');
        run_unload_persist_hooks('pagehide');
        expect(fn).not.toHaveBeenCalled();
    });
});

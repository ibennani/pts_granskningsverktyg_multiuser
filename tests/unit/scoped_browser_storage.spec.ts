import { describe, expect, test } from '@jest/globals';
import {
    get_app_storage_namespace,
    scope_broadcast_channel_name,
    scope_storage_key
} from '../../js/utils/scoped_browser_storage.ts';

describe('scoped_browser_storage', () => {
    test('scope_storage_key inkluderar deploy-prefix från Vite', () => {
        const ns = get_app_storage_namespace();
        expect(scope_storage_key('digitalTillsynAppStateBackup')).toBe(
            `gv:${ns}:digitalTillsynAppStateBackup`
        );
    });

    test('scope_storage_key idempotent för redan namespacade nycklar', () => {
        const scoped = scope_storage_key('foo');
        expect(scope_storage_key(scoped)).toBe(scoped);
    });

    test('scope_broadcast_channel_name lägger till miljö-suffix', () => {
        const ns = get_app_storage_namespace();
        expect(scope_broadcast_channel_name('granskningsverktyget-audit-updates')).toBe(
            `granskningsverktyget-audit-updates:${ns}`
        );
    });
});

import { describe, expect, test, jest } from '@jest/globals';
import {
    confirm_audit_missing_on_server,
    is_audit_not_found_api_error
} from '../../js/logic/confirm_audit_missing_on_server.ts';

describe('confirm_audit_missing_on_server', () => {
    test('is_audit_not_found_api_error kräver 404 och standardtext', () => {
        expect(is_audit_not_found_api_error(new Error('Granskning hittades inte'))).toBe(false);
        expect(
            is_audit_not_found_api_error(
                Object.assign(new Error('Granskning hittades inte'), { status: 404 })
            )
        ).toBe(true);
        expect(
            is_audit_not_found_api_error(Object.assign(new Error('Annat'), { status: 404 }))
        ).toBe(false);
    });

    test('confirm_audit_missing_on_server bekräftar vid GET 404', async () => {
        const get_audit = jest.fn(async () => {
            throw Object.assign(new Error('Granskning hittades inte'), { status: 404 });
        });
        await expect(
            confirm_audit_missing_on_server('audit-1', { get_audit })
        ).resolves.toEqual({ confirmed: true });
    });

    test('confirm_audit_missing_on_server avbryter när GET lyckas', async () => {
        const get_audit = jest.fn(async () => ({ auditId: 'audit-1' }));
        await expect(
            confirm_audit_missing_on_server('audit-1', { get_audit })
        ).resolves.toEqual({ confirmed: false, reason: 'audit_exists' });
    });

    test('confirm_audit_missing_on_server avbryter vid tomt auditId', async () => {
        await expect(confirm_audit_missing_on_server('')).resolves.toEqual({
            confirmed: false,
            reason: 'no_audit_id'
        });
    });
});

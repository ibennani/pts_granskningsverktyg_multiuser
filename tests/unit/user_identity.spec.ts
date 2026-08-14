/**
 * @file Enhetstester för gemensam användaridentitet.
 */
import {
    build_account_select_options,
    is_user_uuid,
    resolve_account_display_name,
} from '../../shared/user/user_identity.js';

describe('user_identity', () => {
    test('resolve_account_display_name använder username när name saknas', () => {
        expect(resolve_account_display_name({ name: '', username: 'ada01' })).toBe('ada01');
        expect(resolve_account_display_name({ name: '  ', username: 'bob02' })).toBe('bob02');
    });

    test('build_account_select_options inkluderar användare med endast username', () => {
        expect(
            build_account_select_options([
                { id: 'u-1', name: '', username: 'zara' },
                { id: 'u-2', name: 'Anna', username: 'anna' },
            ])
        ).toEqual([
            { value: 'u-2', label: 'Anna' },
            { value: 'u-1', label: 'zara' },
        ]);
    });

    test('is_user_uuid känner igen uuid', () => {
        expect(is_user_uuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(is_user_uuid('Anna')).toBe(false);
    });
});

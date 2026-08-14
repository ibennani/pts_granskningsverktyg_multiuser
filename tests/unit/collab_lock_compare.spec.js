import { is_remote_lock_held_by_other_user } from '../../js/logic/collab_lock_compare.js';

describe('is_remote_lock_held_by_other_user', () => {
    test('tom rad eller saknat namn ger false', () => {
        expect(is_remote_lock_held_by_other_user(null, 'Ada')).toBe(false);
        expect(is_remote_lock_held_by_other_user({ user_name: '' }, 'Ada')).toBe(false);
        expect(is_remote_lock_held_by_other_user({ user_name: '   ' }, 'Ada')).toBe(false);
    });

    test('samma användare men utan client_lock_id faller tillbaka på namn (ger false)', () => {
        expect(is_remote_lock_held_by_other_user({ user_name: '  Ada  ' }, 'ada')).toBe(false);
    });

    test('samma användare OCH samma client_lock_id ger false', () => {
        expect(is_remote_lock_held_by_other_user({ user_name: 'Ada', client_lock_id: 'my-tab' }, 'Ada', 'my-tab')).toBe(false);
    });

    test('samma användare men ANNAN client_lock_id ger true (annan tab)', () => {
        expect(is_remote_lock_held_by_other_user({ user_name: 'Ada', client_lock_id: 'other-tab' }, 'Ada', 'my-tab')).toBe(true);
    });

    test('annan användare ger true', () => {
        expect(is_remote_lock_held_by_other_user({ user_name: 'Bob' }, 'Ada')).toBe(true);
    });

    test('samma user_id ger false även vid olika namn', () => {
        const user_id = '550e8400-e29b-41d4-a716-446655440000';
        expect(
            is_remote_lock_held_by_other_user(
                { user_id, user_name: 'Bob' },
                'Ada',
                undefined,
                user_id
            )
        ).toBe(false);
    });

    test('olika user_id ger true', () => {
        expect(
            is_remote_lock_held_by_other_user(
                { user_id: '550e8400-e29b-41d4-a716-446655440000', user_name: 'Bob' },
                'Bob',
                undefined,
                '660e8400-e29b-41d4-a716-446655440001'
            )
        ).toBe(true);
    });

    test('tomt lokalt namn men server har namn räknas som annan', () => {
        expect(is_remote_lock_held_by_other_user({ user_name: 'Bob' }, '')).toBe(true);
    });
});

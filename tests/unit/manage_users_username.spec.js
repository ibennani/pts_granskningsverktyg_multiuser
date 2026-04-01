import { describe, it, expect } from '@jest/globals';
import {
    normalize_username_to_a_z,
    bump_last_character,
    generate_username_from_names,
    generate_username_from_full_name,
    get_existing_usernames_set,
    find_available_username
} from '../../js/logic/manage_users_username.js';

describe('manage_users_username', () => {
    describe('normalize_username_to_a_z', () => {
        it('tar bort diakriter och icke-bokstäver', () => {
            expect(normalize_username_to_a_z('Åke')).toBe('ake');
            expect(normalize_username_to_a_z('José')).toBe('jose');
        });
    });

    describe('bump_last_character', () => {
        it('ökar sista tecknet inom a-z', () => {
            expect(bump_last_character('abc')).toBe('abd');
            expect(bump_last_character('abz')).toBe('aba');
        });
    });

    describe('generate_username_from_names', () => {
        it('kombinerar första och sista namnet', () => {
            expect(generate_username_from_names('Anna', 'Berg')).toBe('annber');
        });
    });

    describe('generate_username_from_full_name', () => {
        it('ger sex tecken från för- och efternamn', () => {
            expect(generate_username_from_full_name('Anna Maria Berg')).toBe('annber');
        });
        it('hanterar enstaka namn med utfyllnad', () => {
            const one = generate_username_from_full_name('Xyz');
            expect(one).toHaveLength(6);
        });
    });

    describe('get_existing_usernames_set', () => {
        it('samlar användarnamn i gemener', () => {
            const s = get_existing_usernames_set([{ username: 'AbCdEf' }, { username: '  xyzzy  ' }]);
            expect(s.has('abcdef')).toBe(true);
            expect(s.has('xyzzy')).toBe(true);
        });
    });

    describe('find_available_username', () => {
        it('returnerar kandidat om ledig', () => {
            expect(find_available_username('abcdef', new Set(['zzzzzz']))).toBe('abcdef');
        });
        it('bumpar vid kollision', () => {
            const taken = new Set(['abcdeg']);
            expect(find_available_username('abcdeg', taken)).toBe('abcdeh');
        });
    });
});

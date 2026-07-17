/**
 * Enhetstester för taxonomy_principles_count.
 */
import { describe, test, expect } from '@jest/globals';
import { count_taxonomy_principles } from '../../js/logic/taxonomy_principles_count.ts';

describe('count_taxonomy_principles', () => {
    test('returnerar antal begrepp i concepts-arrayen', () => {
        expect(
            count_taxonomy_principles({
                concepts: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
            })
        ).toBe(3);
    });

    test('returnerar 0 när concepts saknas eller inte är en array', () => {
        expect(count_taxonomy_principles({})).toBe(0);
        expect(count_taxonomy_principles({ concepts: null })).toBe(0);
        expect(count_taxonomy_principles({ concepts: 'invalid' })).toBe(0);
        expect(count_taxonomy_principles({ concepts: [] })).toBe(0);
    });
});

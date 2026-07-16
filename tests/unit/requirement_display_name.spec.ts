/**
 * Enhetstester för requirement_display_name.
 */
import { describe, test, expect } from '@jest/globals';
import { get_requirement_display_label } from '../../js/logic/requirement_display_name.ts';

describe('requirement_display_name', () => {
    test('kombinerar referensnummer och titel', () => {
        const label = get_requirement_display_label({
            title: 'Non-text Content',
            standardReference: { text: '1.1.1' },
        });
        expect(label).toBe('1.1.1 Non-text Content');
    });

    test('plockar namn ur standardReference när titel saknas', () => {
        const label = get_requirement_display_label({
            standardReference: { text: '1.1.1 Non-text Content' },
        });
        expect(label).toBe('1.1.1 Non-text Content');
    });

    test('undviker dubbel referens om titeln redan innehåller numret', () => {
        const label = get_requirement_display_label({
            title: '1.1.1 Non-text Content',
            standardReference: { text: '1.1.1' },
        });
        expect(label).toBe('1.1.1 Non-text Content');
    });
});

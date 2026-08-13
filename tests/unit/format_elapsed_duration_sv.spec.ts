/**
 * @fileoverview Enhetstester för format_elapsed_duration_sv.
 */
import { describe, test, expect } from '@jest/globals';
import { format_elapsed_duration_sv } from '../../js/utils/format_elapsed_duration_sv.ts';

describe('format_elapsed_duration_sv', () => {
    test('formaterar sekunder', () => {
        expect(format_elapsed_duration_sv(5000)).toBe('5 sekunder');
    });

    test('formaterar minuter och sekunder', () => {
        expect(format_elapsed_duration_sv(95000)).toBe('1 minut och 35 sekunder');
    });
});

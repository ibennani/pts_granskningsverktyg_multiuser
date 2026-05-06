import { describe, test, expect } from '@jest/globals';
import { compute_next_rulefile_metadata_version } from '../../shared/rulefile/rulefile_metadata_version.js';

describe('rulefile_metadata_version', () => {
    test('ökar r med 1 när år och månad matchar', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        expect(compute_next_rulefile_metadata_version('2026.5.r3', d)).toBe('2026.5.r4');
        expect(compute_next_rulefile_metadata_version('2026.05.r3', d)).toBe('2026.5.r4');
        expect(compute_next_rulefile_metadata_version('2026.5.r0', d)).toBe('2026.5.r1');
    });

    test('startar om på r1 när månad skiljer', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        expect(compute_next_rulefile_metadata_version('2026.4.r99', d)).toBe('2026.5.r1');
    });

    test('startar om på r1 när år skiljer', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        expect(compute_next_rulefile_metadata_version('2025.5.r7', d)).toBe('2026.5.r1');
    });

    test('startar om på r1 vid ogiltig eller saknad version', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        expect(compute_next_rulefile_metadata_version(null, d)).toBe('2026.5.r1');
        expect(compute_next_rulefile_metadata_version('', d)).toBe('2026.5.r1');
        expect(compute_next_rulefile_metadata_version('2026.5', d)).toBe('2026.5.r1');
        expect(compute_next_rulefile_metadata_version('abc', d)).toBe('2026.5.r1');
    });
});


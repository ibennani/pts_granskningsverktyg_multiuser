import { describe, it, expect } from '@jest/globals';
import { generate_slug, ensure_unique_slug } from '../../js/logic/rulefile_metadata_slug.js';

describe('rulefile_metadata_slug', () => {
    describe('generate_slug', () => {
        it('returnerar tom sträng för falsy värde', () => {
            expect(generate_slug('')).toBe('');
            expect(generate_slug(null)).toBe('');
        });
        it('normaliserar enkel text till slug', () => {
            expect(generate_slug('  Hello World  ')).toBe('hello-world');
        });
    });

    describe('ensure_unique_slug', () => {
        it('lägger till första kandidaten och returnerar den', () => {
            const set = new Set();
            expect(ensure_unique_slug(set, 'foo', 'bar')).toBe('foo');
            expect(set.has('foo')).toBe(true);
        });
        it('ökar suffix tills unikt id', () => {
            const set = new Set(['a']);
            expect(ensure_unique_slug(set, 'a', 'x')).toBe('a-1');
        });
    });
});

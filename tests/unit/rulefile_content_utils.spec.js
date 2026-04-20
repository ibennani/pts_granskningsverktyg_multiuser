import { normalize_rulefile_content_object } from '../../server/utils/rulefile_content_utils.js';

describe('normalize_rulefile_content_object', () => {
    test('returnerar objekt oförändrat', () => {
        const obj = { metadata: { version: '2026.4.r3' } };
        expect(normalize_rulefile_content_object(obj)).toBe(obj);
    });

    test('parsar JSON-sträng till objekt', () => {
        const s = JSON.stringify({ metadata: { version: '2026.4.r3' } });
        expect(normalize_rulefile_content_object(s)).toEqual({ metadata: { version: '2026.4.r3' } });
    });

    test('returnerar null för ogiltig JSON-sträng', () => {
        expect(normalize_rulefile_content_object('{')).toBe(null);
    });

    test('returnerar null för icke-objekt JSON', () => {
        expect(normalize_rulefile_content_object('"x"')).toBe(null);
        expect(normalize_rulefile_content_object('123')).toBe(null);
        expect(normalize_rulefile_content_object('true')).toBe(null);
        expect(normalize_rulefile_content_object('null')).toBe(null);
    });
});


/**
 * Tester för html_escape: full escaping vs interpolation (citat kvar i textnoder).
 */
import { describe, expect, it } from '@jest/globals';
import { escape_html, escape_html_for_text_interpolation } from '../../js/utils/html_escape.js';

describe('escape_html', () => {
    it('escaper citattecken till entiteter', () => {
        expect(escape_html('Sökning på "USB-C"')).toBe('Sökning på &quot;USB-C&quot;');
    });
});

describe('escape_html_for_text_interpolation', () => {
    it('lämnar dubbelcitat orörda', () => {
        expect(escape_html_for_text_interpolation('Sökning på "USB-C"')).toBe('Sökning på "USB-C"');
    });

    it('escaper vinkelparenteser och ampersand', () => {
        expect(escape_html_for_text_interpolation('a<b>&c')).toBe('a&lt;b&gt;&amp;c');
    });
});

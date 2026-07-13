/**
 * @fileoverview Regressionstester för markdown till HTML i export.
 */
import { describe, test, expect } from '@jest/globals';
import { render_markdown_to_html } from '../../js/export/export_html_build_primitives.ts';

describe('render_markdown_to_html', () => {
    test('renderar inline-kod utan INLINECODE-fragment', () => {
        const input = 'Taggar: `<b>`, `<i>`, `<br>` och <b>Maximal lagringstid</b>.';
        const html = render_markdown_to_html(input);

        expect(html).toContain('<code>');
        expect(html).toContain('&lt;b&gt;');
        expect(html).toContain('&lt;i&gt;');
        expect(html).toContain('&lt;br&gt;');
        expect(html).toContain('Maximal lagringstid');
        expect(html).not.toMatch(/INLINECODE/i);
    });

    test('renderar kursiv markdown utan ITALIC-fragment', () => {
        const input =
            'flyttar pekaren,*väljer*att dölja det, eller tills den visade informationen inte längre är relevant.';
        const html = render_markdown_to_html(input);

        expect(html).toContain('väljer');
        expect(html).toMatch(/<em>väljer<\/em>/);
        expect(html).not.toMatch(/ITALIC/i);
    });
});

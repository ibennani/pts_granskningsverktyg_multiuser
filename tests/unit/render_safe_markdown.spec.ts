/**
 * @jest-environment jsdom
 */
import { describe, test, expect } from '@jest/globals';
import { render_safe_markdown_html } from '../../js/utils/render_safe_markdown.ts';

function test_helpers() {
    return {
        escape_html: (value: string) =>
            String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
    };
}

describe('render_safe_markdown_html', () => {
    test('renderar fetstil och inline-kod som i infoblock', () => {
        const html = render_safe_markdown_html('Detta är **viktigt** och `<table>`.', test_helpers());
        expect(html).toContain('<strong>viktigt</strong>');
        expect(html).toContain('<code>');
        expect(html).toContain('&lt;table&gt;');
    });

    test('escapar rå HTML-taggar i källtexten', () => {
        const html = render_safe_markdown_html('Text med <script>alert(1)</script> tagg.', test_helpers());
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });
});

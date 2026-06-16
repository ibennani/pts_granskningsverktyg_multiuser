/**
 * @jest-environment jsdom
 */
import { describe, test, expect } from '@jest/globals';
import { render_safe_markdown_html } from '../../js/utils/render_safe_markdown.ts';

describe('render_safe_markdown_html (chatt och infoblock)', () => {
    test('renderar fetstil och inline-kod', () => {
        const helpers = {
            escape_html: (value: string) =>
                String(value)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
        };
        const html = render_safe_markdown_html('Detta är **viktigt** och `<table>`.', helpers);
        expect(html).toContain('<strong>viktigt</strong>');
        expect(html).toContain('<code>');
        expect(html).toContain('&lt;table&gt;');
    });
});

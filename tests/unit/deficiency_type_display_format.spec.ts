/**
 * @file Enhetstester för visningsformat av bristtyper i tabellen.
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_deficiency_type_display_markdown,
    render_deficiency_type_paragraph_html,
} from '../../js/logic/deficiency_type_display_format.ts';

describe('deficiency_type_display_format', () => {
    test('build_deficiency_type_display_markdown sätter markdown-fetstil på del 1', () => {
        expect(
            build_deficiency_type_display_markdown('Del 1', 'Del 2')
        ).toBe('**Del 1** Del 2');
    });

    test('render_deficiency_type_paragraph_html ger strong för del 1 och vanlig text för del 2', () => {
        const html = render_deficiency_type_paragraph_html(
            'Icke-textuellt bildinnehåll hanteras felaktigt.',
            'Bilder och grafiska element saknar maskinläsbara beskrivningar.'
        );
        expect(html).toMatch(/<strong>Icke-textuellt bildinnehåll hanteras felaktigt\.<\/strong>/);
        expect(html).toContain('Bilder och grafiska element saknar maskinläsbara beskrivningar.');
    });
});

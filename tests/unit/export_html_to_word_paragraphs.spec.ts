import { html_to_word_paragraphs } from '../../js/export/export_html_to_word_paragraphs.ts';
import { Paragraph } from 'docx';

describe('export_html_to_word_paragraphs', () => {
    test('konverterar rubrik och stycke till docx Paragraph', () => {
        const paragraphs = html_to_word_paragraphs('<h2>Rubrik</h2><p>Text med <strong>fetstil</strong>.</p>');
        expect(paragraphs.length).toBeGreaterThanOrEqual(2);
        expect(paragraphs.every((p) => p instanceof Paragraph)).toBe(true);
    });
});

import { html_to_word_paragraphs } from '../../js/export/export_html_to_word_paragraphs.ts';
import { Paragraph } from 'docx';

describe('export_html_to_word_paragraphs', () => {
    test('konverterar rubrik och stycke till docx Paragraph', () => {
        const paragraphs = html_to_word_paragraphs('<h2>Rubrik</h2><p>Text med <strong>fetstil</strong>.</p>');
        expect(paragraphs.length).toBeGreaterThanOrEqual(2);
        expect(paragraphs.every((p) => p instanceof Paragraph)).toBe(true);
    });

    test('bevarar numrering i ordnade listor', () => {
        const paragraphs = html_to_word_paragraphs('<ol><li>Första</li><li>Andra</li></ol>');
        const serialized = JSON.stringify(paragraphs);
        expect(serialized).toContain('1.\\t');
        expect(serialized).toContain('2.\\t');
        expect(serialized).toContain('Första');
        expect(serialized).toContain('Andra');
    });

    test('bevarar bokstavsnumrering i ordnade listor med type=a', () => {
        const paragraphs = html_to_word_paragraphs('<ol type="a"><li>Första</li><li>Andra</li></ol>');
        const serialized = JSON.stringify(paragraphs);
        expect(serialized).toContain('a.\\t');
        expect(serialized).toContain('b.\\t');
    });

    test('använder punkttecken i punktlistor', () => {
        const paragraphs = html_to_word_paragraphs('<ul><li>Punkt ett</li></ul>');
        const serialized = JSON.stringify(paragraphs);
        expect(serialized).toContain('•\\t');
        expect(serialized).toContain('Punkt ett');
    });
});

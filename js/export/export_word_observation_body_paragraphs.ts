/**
 * @fileoverview Brödtextstycken för observationer utan brist-id-prefix (handläggar-Word).
 */
import { Paragraph, TabStopType, TextRun } from 'docx';
import { parse_markdown_to_text_runs } from './export_word_markdown_docx.js';

type ObservationBodyParagraphOptions = {
    /** Håll styckena på samma sida som föregående (för röd handläggar-ram). */
    keep_together?: boolean;
};

function page_break_guard_for_cell_paragraph(is_last: boolean) {
    if (is_last) {
        return { keepLines: true, widowControl: true };
    }
    return { keepNext: true, keepLines: true, widowControl: true };
}

/**
 * Bygger stycken för observationstext med markdown och punktlistor, utan id-prefix.
 */
export function build_observation_body_paragraphs(
    observation_text: string,
    options?: ObservationBodyParagraphOptions
): Paragraph[] {
    const keep_together = options?.keep_together === true;
    let observationText = String(observation_text || '').trim();
    if (!observationText) {
        return [
            new Paragraph({
                children: [new TextRun({ text: '' })],
                ...(keep_together ? page_break_guard_for_cell_paragraph(true) : {}),
            }),
        ];
    }

    observationText = observationText.replace(/^[\s]*[-*]\s/gm, '• ');
    const lines = observationText.split('\n');

    return lines.map((line, lineIndex) => {
        const is_last = lineIndex === lines.length - 1;
        let runText = line;
        const is_bullet_line = line.trim().startsWith('•');
        if (is_bullet_line) {
            runText = runText.replace('• ', '•\t');
        }

        return new Paragraph({
            children: parse_markdown_to_text_runs(runText),
            spacing: { after: is_last ? 0 : 60 },
            indent: is_bullet_line ? { left: 227, hanging: 227 } : {},
            tabStops: is_bullet_line ? [{ position: 227, type: TabStopType.LEFT }] : [],
            ...(keep_together ? page_break_guard_for_cell_paragraph(is_last) : {}),
        });
    });
}

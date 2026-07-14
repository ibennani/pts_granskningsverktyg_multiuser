/**
 * @fileoverview Kontext- och ramblock per brist i handläggar-Word-export.
 */
import {
    ExternalHyperlink,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
} from 'docx';
import type { ObservationExportEntry } from './export_observation_texts_collect.js';
import {
    create_metadata_paragraphs,
    extract_reference_number,
} from './export_word_requirement_sections.js';
import { build_observation_body_paragraphs } from './export_word_observation_body_paragraphs.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';
import {
    OBSERVATION_BORDER_COLOR,
    red_handling_cell_border,
} from './export_observation_texts_word_constants.js';
import type { ExportWordMainFlowT } from './export_word_main_flow_children.js';

export { OBSERVATION_BORDER_COLOR };

function append_sample_heading_paragraph(
    children: Array<Paragraph | Table>,
    sample: ObservationExportEntry['sample'],
    t: ExportWordMainFlowT
): void {
    const sample_name = sample.description || sample.url || t('export_unspecified_sample');
    const h3_children: Array<TextRun | InstanceType<typeof ExternalHyperlink>> = [
        new TextRun({ text: 'Granskningsdelar: ', color: '000000' }),
    ];

    if (sample.url) {
        h3_children.push(
            new ExternalHyperlink({
                children: [new TextRun({ text: sample_name, style: 'Hyperlink' })],
                link: sample.url,
            })
        );
    } else {
        h3_children.push(new TextRun({ text: sample_name, color: '000000' }));
    }

    children.push(
        new Paragraph({
            children: h3_children,
            heading: 'Heading3',
            spacing: { before: 200, after: 60 },
        })
    );
}

/** Kravkontext utanför röd ram (ignoreras vid framtida import). */
export function append_observation_entry_context_blocks(
    children: unknown[],
    entry: ObservationExportEntry,
    current_audit: Record<string, unknown>,
    t: ExportWordMainFlowT
): void {
    const c = children as Array<Paragraph | Table>;
    const req = entry.req_definition;
    const reference_number = extract_reference_number(req);
    const h2_text = (reference_number ? `${reference_number} ` : '') + (req.title || '');

    c.push(
        new Paragraph({
            children: [new TextRun({ text: h2_text })],
            heading: 'Heading2',
            spacing: { after: 40 },
        })
    );

    c.push(
        ...create_metadata_paragraphs(req, current_audit, [], t, {
            include_deficiency_id_list: false,
        })
    );

    append_sample_heading_paragraph(c, entry.sample, t);
}

/** En röd tabellcell per brist: H4 «Brist-id N» + brödtext (importzon, utan sidbryt). */
export function append_observation_entry_red_frame_block(
    children: unknown[],
    entry: ObservationExportEntry,
    t: ExportWordMainFlowT
): void {
    const c = children as Array<Paragraph | Table>;
    const id_number = extractDeficiencyNumber(entry.deficiencyId);
    const h4_text = t('export_observation_texts_word_deficiency_id_heading', { id: id_number });

    const body_paragraphs = build_observation_body_paragraphs(entry.observationDetail, {
        keep_together: true,
    });
    const cell_children: Paragraph[] = [
        new Paragraph({
            children: [new TextRun({ text: h4_text })],
            heading: 'Heading4',
            keepNext: true,
            keepLines: true,
            widowControl: true,
        }),
        ...body_paragraphs,
    ];

    c.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    cantSplit: true,
                    children: [
                        new TableCell({
                            borders: red_handling_cell_border,
                            margins: { top: 80, bottom: 80, left: 120, right: 120 },
                            children: cell_children,
                        }),
                    ],
                }),
            ],
        })
    );

    c.push(
        new Paragraph({
            children: [new TextRun({ text: '' })],
            spacing: { after: 240 },
        })
    );
}

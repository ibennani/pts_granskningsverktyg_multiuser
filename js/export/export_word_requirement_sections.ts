/**
 * @fileoverview Word-export: metadata-, observations- och kommentarstycken per krav/granskningsdel.
 */
import { Paragraph, TextRun, ExternalHyperlink, TabStopType } from 'docx';
import { extractDeficiencyNumber } from './export_format_helpers.js';
import { get_export_requirement_result } from './export_bootstrap.js';
import { REPORT_EXPORT_COLORS } from './export_report_typography.js';
import { parse_markdown_to_text_runs } from './export_word_markdown_docx.js';
import {
    get_concept_labels_for_requirement,
    get_primary_grouping_taxonomy_id,
} from '../../shared/classification/taxonomy_grouping.js';

// Gemensam hjälpfunktion för att extrahera referensnummer från en krav-referens
export function extract_reference_number(requirement: any) {
    let referenceNumber = "";
    if (requirement.standardReference?.text) {
        const refText = requirement.standardReference.text.trim();
        const startMatch = refText.match(/^([\d\.]+)/);
        const endMatch = refText.match(/([\d\.]+)$/);
        if (startMatch) {
            referenceNumber = startMatch[1];
        } else if (endMatch) {
            referenceNumber = endMatch[1];
        } else if (refText.match(/\d/)) {
            referenceNumber = refText;
        }
    }
    if (referenceNumber.endsWith('.')) {
        referenceNumber = referenceNumber.slice(0, -1);
    }
    return referenceNumber;
}

type MetadataParagraphOptions = {
    include_deficiency_id_list?: boolean;
};

// Gemensam hjälpfunktion för att skapa metadata-paragraf (Referens, Principer, Brist)
export function create_metadata_paragraphs(
    requirement: any,
    current_audit: any,
    deficiencyIds: any,
    _t: any,
    options?: MetadataParagraphOptions
) {
    const include_deficiency_id_list = options?.include_deficiency_id_list !== false;
    const metadata_items = [];

    // Referens
    if (requirement.standardReference?.text) {
        const ref_text = requirement.standardReference.text;
        const ref_url = requirement.standardReference.url;
        if (ref_url) {
            metadata_items.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: "Referens: ", bold: true }),
                        new ExternalHyperlink({
                            children: [new TextRun({ text: ref_text, style: "Hyperlink" })],
                            link: ref_url
                        })
                    ]
                })
            );
        } else {
            metadata_items.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: "Referens: ", bold: true }),
                        new TextRun({ text: ref_text })
                    ]
                })
            );
        }
    }

    // Principer (primär grupperingstaxonomi)
    {
        const rule_content = current_audit?.ruleFileContent as Record<string, unknown> | undefined;
        const metadata = rule_content?.metadata;
        const taxonomy_id = get_primary_grouping_taxonomy_id(rule_content);
        const principle_texts = get_concept_labels_for_requirement(requirement, metadata, taxonomy_id, _t);

        if (principle_texts.length > 0) {
            metadata_items.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: "Principer: ", bold: true }),
                        new TextRun({ text: principle_texts.join(', ') })
                    ]
                })
            );
        }
    }

    // Identifierade brister
    if (include_deficiency_id_list && deficiencyIds.length > 0) {
        metadata_items.push(
            new Paragraph({
                children: [
                    new TextRun({ text: "Identifierade brister: ", bold: true }),
                    new TextRun({ text: deficiencyIds.join(', ') })
                ]
            })
        );
    }

    return metadata_items;
}

// Gemensam hjälpfunktion för att formatera observationer som paragraf
export function create_observation_paragraphs(deficiency: any, _t: any) {
    const paragraphs = [];
    let observationText = (deficiency.observationDetail || '').trim();
    observationText = observationText.replace(/^[\s]*[-*]\s/gm, '• ');

    const isStandardText = deficiency.isStandardText || false;
    const defId = extractDeficiencyNumber(deficiency.deficiencyId);
    const defIdString = defId ? `Brist-id: ${defId} ` : '';

    if (observationText.includes('\n')) {
        const lines = observationText.split('\n');
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const isFirstLine = lineIndex === 0;
            const isLastLine = lineIndex === lines.length - 1;
            const textRuns = [];
            const lineText = lines[lineIndex];
            const isBulletLine = lineText.trim().startsWith('•');
            const indentConfig = isBulletLine ? { left: 227, hanging: 227 } : {};
            const tabStopsConfig = isBulletLine ? [{ position: 227, type: TabStopType.LEFT }] : [];

            let runText = lineText;
            if (isBulletLine) runText = runText.replace('• ', '•\t');

            if (isFirstLine) {
                if (defIdString) {
                    textRuns.push(new TextRun({ text: defIdString, bold: true }));
                    const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
                    // Använd markdown-tolkning för resten av texten
                    const markdownRuns = parse_markdown_to_text_runs(prefix + runText);
                    textRuns.push(...markdownRuns);
                } else {
                    const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
                    const markdownRuns = parse_markdown_to_text_runs(prefix + runText);
                    textRuns.push(...markdownRuns);
                }
            } else if (isLastLine) {
                const markdownRuns = parse_markdown_to_text_runs(runText + ' ');
                textRuns.push(...markdownRuns);
            } else {
                const markdownRuns = parse_markdown_to_text_runs(runText);
                textRuns.push(...markdownRuns);
            }

            paragraphs.push(
                new Paragraph({
                    children: textRuns,
                    spacing: { after: isLastLine ? 240 : 0 },
                    indent: indentConfig,
                    tabStops: tabStopsConfig
                })
            );
        }
    } else {
        const textRuns = [];
        const isBulletLine = observationText.trim().startsWith('•');
        const indentConfig = isBulletLine ? { left: 227, hanging: 227 } : {};
        const tabStopsConfig = isBulletLine ? [{ position: 227, type: TabStopType.LEFT }] : [];
        let runText = observationText;
        if (isBulletLine) runText = runText.replace('• ', '•\t');

        if (defIdString) {
            textRuns.push(new TextRun({ text: defIdString, bold: true }));
            const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
            const markdownRuns = parse_markdown_to_text_runs(prefix + runText + ' ');
            textRuns.push(...markdownRuns);
        } else {
            const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
            const markdownRuns = parse_markdown_to_text_runs(prefix + runText + ' ');
            textRuns.push(...markdownRuns);
        }

        paragraphs.push(
            new Paragraph({
                children: textRuns,
                spacing: { after: 240 },
                indent: indentConfig,
                tabStops: tabStopsConfig
            })
        );
    }

    return paragraphs;
}

// Gemensam hjälpfunktion för att skapa kommentar-paragraf
export function create_comment_paragraphs(requirement: any, sample: any, requirements: any, _t: any) {
    const paragraphs = [];
    const sample_result = get_export_requirement_result(requirements, sample, requirement);
    if (sample_result && sample_result.commentToActor && sample_result.commentToActor.trim()) {
        paragraphs.push(
            new Paragraph({
                children: [new TextRun({ text: "" })],
                spacing: { before: 120 }
            })
        );
        
        const commentText = sample_result.commentToActor.trim();
        const markdownRuns = parse_markdown_to_text_runs(commentText);
        
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Kommentar: ",
                        bold: true,
                        color: REPORT_EXPORT_COLORS.comment_label
                    }),
                    ...markdownRuns
                ],
                spacing: { after: 60 }
            })
        );
    }
    return paragraphs;
}

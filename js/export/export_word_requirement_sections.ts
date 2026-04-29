// @ts-nocheck
/**
 * @fileoverview Word-export: metadata-, observations- och kommentarstycken per krav/stickprov.
 */
import { Paragraph, TextRun, ExternalHyperlink, TabStopType } from 'docx';
import { extractDeficiencyNumber } from './export_format_helpers.js';
import { get_export_requirement_result } from './export_bootstrap.js';
import { parse_markdown_to_text_runs } from './export_word_markdown_docx.js';

// Gemensam hjälpfunktion för att extrahera referensnummer från en krav-referens
export function extract_reference_number(requirement) {
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

// Gemensam hjälpfunktion för att skapa metadata-paragraf (Referens, Principer, Brist)
export function create_metadata_paragraphs(requirement, current_audit, deficiencyIds, _t) {
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

    // Principer
    {
        const classifications = Array.isArray(requirement.classifications) ? requirement.classifications : [];
        const taxonomy = current_audit?.ruleFileContent?.metadata?.taxonomies?.find(t => t.id === 'wcag22-pour');
        const norm = v => String(v ?? '').trim().toLowerCase();
        const principle_texts = taxonomy
            ? classifications
                .filter(c => norm(c.taxonomyId) === 'wcag22-pour')
                .map(c => {
                    const concept = taxonomy.concepts?.find?.(x => norm(x?.id) === norm(c.conceptId));
                    return (typeof concept?.label === 'string' && concept.label.trim())
                        ? concept.label
                        : c.conceptId;
                })
                .filter(Boolean)
            : [];

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
    if (deficiencyIds.length > 0) {
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
export function create_observation_paragraphs(deficiency, _t) {
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
export function create_comment_paragraphs(requirement, sample, requirements, _t) {
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
                        color: "6E3282"
                    }),
                    ...markdownRuns
                ],
                spacing: { after: 60 }
            })
        );
    }
    return paragraphs;
}
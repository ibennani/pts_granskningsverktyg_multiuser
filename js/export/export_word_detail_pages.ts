// @ts-nocheck
/**
 * @fileoverview Word-export: förstasidetabell och kravsidor (legacy, ej kopplade till huvudexport).
 */
import { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, UnderlineType, ExternalHyperlink } from 'docx';
import * as Helpers from '../utils/helpers.js';
import * as ScoreCalculator from '../logic/ScoreCalculator.js';
import { get_current_language_code_from_registry } from '../utils/translation_access.js';
import { create_paragraphs_with_line_breaks, formatDeficiencyForWord } from './export_format_helpers.js';
import {
    get_total_requirements_count,
    get_requirements_percentage,
    get_samples_for_requirement,
    get_deficiencies_for_sample,
    get_expected_observation,
    get_actor_comment
} from './export_word_deficiency_queries.js';

// Hjälpfunktioner för formatering
export function create_heading_text(text, level = 2) {
    const sizes = { 1: 24, 2: 22, 3: 20 };
    return new TextRun({
        text,
        bold: true,
        size: sizes[level] || 22,
        font: "Calibri Light"
    });
}

export function create_body_text(text, size = 22) {
    return create_text_runs_with_line_breaks(text, {
        size,
        font: "Calibri"
    });
}

export function _create_overview_page(current_audit, t) {
    const lang_code = get_current_language_code_from_registry();
    const score_analysis = ScoreCalculator.calculateQualityScore(current_audit);

    // Skapa tabell för förstasida
    const table = new Table({
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [create_heading_text(t('case_number'), 2)],
                                heading: HeadingLevel.HEADING_2
                            }),
                            new Paragraph({
                                children: create_body_text(current_audit.auditMetadata.caseNumber || '', 22)
                            }),
                            new Paragraph({ children: [new TextRun({ text: "" })] }),

                            new Paragraph({
                                children: [create_heading_text(t('actor_name'), 2)],
                                heading: HeadingLevel.HEADING_2
                            }),
                            new Paragraph({
                                children: create_body_text(current_audit.auditMetadata.actorName || '', 22)
                            }),
                            new Paragraph({ children: [new TextRun({ text: "" })] }),

                            new Paragraph({
                                children: [create_heading_text(t('auditor_name'), 2)],
                                heading: HeadingLevel.HEADING_2
                            }),
                            new Paragraph({
                                children: create_body_text(current_audit.auditMetadata.auditorName || '', 22)
                            }),
                            new Paragraph({ children: [new TextRun({ text: "" })] }),

                            new Paragraph({
                                children: [create_heading_text(t('rule_file_title'), 2)],
                                heading: HeadingLevel.HEADING_2
                            }),
                            new Paragraph({
                                children: create_body_text(current_audit.ruleFileContent.metadata.title || '', 22)
                            }),
                            new Paragraph({ children: [new TextRun({ text: "" })] }),

                            new Paragraph({
                                children: [create_heading_text(t('version_rulefile'), 2)],
                                heading: HeadingLevel.HEADING_2
                            }),
                            new Paragraph({
                                children: create_body_text(current_audit.ruleFileContent.metadata.version || '', 22)
                            }),
                            new Paragraph({ children: [new TextRun({ text: "" })] }),

                            new Paragraph({
                                children: [create_heading_text(t('status'), 2)],
                                heading: HeadingLevel.HEADING_2
                            }),
                            new Paragraph({
                                children: create_body_text(t(`audit_status_${current_audit.auditStatus}`), 22)
                            }),
                            new Paragraph({ children: [new TextRun({ text: "" })] }),

                            new Paragraph({
                                children: [create_heading_text(t('start_time'), 2)],
                                heading: HeadingLevel.HEADING_2
                            }),
                            new Paragraph({
                                children: create_body_text(current_audit.startTime ? Helpers.format_iso_to_local_datetime(current_audit.startTime, lang_code) : '', 22)
                            }),
                            new Paragraph({ children: [new TextRun({ text: "" })] }),

                            new Paragraph({
                                children: [create_heading_text(t('internal_comment'), 2)],
                                heading: HeadingLevel.HEADING_2
                            }),
                            ...create_paragraphs_with_line_breaks(current_audit.auditMetadata.internalComment || '', { size: 22, font: "Calibri" })
                        ],
                        width: { size: 50, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [create_heading_text(t('total_requirements_reviewed'), 2)],
                                heading: HeadingLevel.HEADING_2
                            }),
                            new Paragraph({
                                children: create_body_text(`${get_total_requirements_count(current_audit)} (${get_requirements_percentage(current_audit)}%)`, 22)
                            }),
                            new Paragraph({ children: [new TextRun({ text: "" })] }),

                            new Paragraph({
                                children: [create_heading_text(t('deficiency_index_title'), 2)],
                                heading: HeadingLevel.HEADING_2
                            }),
                            new Paragraph({
                                children: create_body_text(score_analysis ? Helpers.format_number_locally(score_analysis.totalScore, lang_code) : '---', 22)
                            }),
                            new Paragraph({ children: [new TextRun({ text: "" })] }),

                            new Paragraph({
                                children: [create_heading_text(t('principle_breakdown'), 2)],
                                heading: HeadingLevel.HEADING_2
                            }),
                            new Paragraph({
                                children: create_body_text(t('perceivable'), 22)
                            }),
                            new Paragraph({
                                children: create_body_text(t('operable'), 22)
                            }),
                            new Paragraph({
                                children: create_body_text(t('understandable'), 22)
                            }),
                            new Paragraph({
                                children: create_body_text(t('robust'), 22)
                            })
                        ],
                        width: { size: 50, type: WidthType.PERCENTAGE }
                    })
                ]
            })
        ],
        width: { size: 100, type: WidthType.PERCENTAGE }
    });

    return table;
}

export function _create_requirement_page(requirement, current_audit, t) {
    const children = [];

    // H1: Kravets titel
    children.push(new Paragraph({
        children: [create_heading_text(requirement.title, 1)],
        heading: HeadingLevel.HEADING_1
    }));

    // Standardreferens hyperlänkad
    if (requirement.standardReference?.text) {
        const referenceText = requirement.standardReference.text;
        const referenceUrl = requirement.standardReference.url;

        if (referenceUrl) {
            children.push(new Paragraph({
                children: [new ExternalHyperlink({
                    children: [new TextRun({ text: referenceText, color: "0563C1", underline: { type: UnderlineType.SINGLE } })],
                    link: Helpers.add_protocol_if_missing(referenceUrl)
                })]
            }));
        } else {
            children.push(new Paragraph({
                children: create_body_text(referenceText, 22)
            }));
        }
    }

    // Stickprov för detta krav
    const samples_for_requirement = get_samples_for_requirement(requirement, current_audit);
    for (const sample of samples_for_requirement) {
        const sample_children = create_sample_section(sample, requirement, current_audit, t);
        children.push(...sample_children);
    }

    return children;
}

export function create_sample_section(sample, requirement, current_audit, t) {
    const children = [];

    // H2: Stickprovets namn
    children.push(new Paragraph({
        children: [create_heading_text(sample.description, 2)],
        heading: HeadingLevel.HEADING_2
    }));

    // Förväntad observation
    const expected_observation = get_expected_observation(requirement, sample);
    if (expected_observation) {
        children.push(new Paragraph({
            children: [create_heading_text(t('expected_observation') + ': ', 3)]
        }));

        // Lägg till expected_observation som separata paragraphs om det innehåller radbrytningar
        const expectedObsParagraphs = create_paragraphs_with_line_breaks(expected_observation, { size: 22, font: "Calibri" });
        children.push(...expectedObsParagraphs);
    }

    // Kommentar till aktören
    const actor_comment = get_actor_comment(requirement, sample);
    if (actor_comment) {
        children.push(new Paragraph({
            children: [create_heading_text(t('comment_to_actor') + ': ', 3)]
        }));

        // Lägg till actor_comment som separata paragraphs om det innehåller radbrytningar
        const actorCommentParagraphs = create_paragraphs_with_line_breaks(actor_comment, { size: 22, font: "Calibri" });
        children.push(...actorCommentParagraphs);
    }

    // Brister
    const deficiencies = get_deficiencies_for_sample(requirement, sample, current_audit, t);
    if (deficiencies.length > 0) {
        children.push(new Paragraph({
            children: [create_heading_text(t('deficiencies'), 3)],
            heading: HeadingLevel.HEADING_3
        }));

        deficiencies.forEach((deficiency, index) => {
            const numberPrefix = `${index + 1}. `;
            const observationText = deficiency.observationDetail;
            const isStandardText = deficiency.isStandardText || false;

            // Om observationText innehåller \n, hantera radbrytningar
            if (observationText.includes('\n')) {
                const lines = observationText.split('\n');
                for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                    const isFirstLine = lineIndex === 0;
                    const isLastLine = lineIndex === lines.length - 1;

                    let textRuns = [];

                    if (isFirstLine) {
                        // Första raden: nummer + eventuell prefix + text
                        const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
                        textRuns = [
                            new TextRun({
                                text: numberPrefix + prefix + lines[lineIndex],
                                size: 22,
                                font: "Calibri",
                                bold: true
                            })
                        ];
                    } else if (isLastLine) {
                        // Sista raden: text + bristindex i kursiv
                        textRuns = [
                            new TextRun({
                                text: '   ' + lines[lineIndex] + ' ',
                                size: 22,
                                font: "Calibri"
                            }),
                            new TextRun({
                                text: `(${formatDeficiencyForWord(deficiency.deficiencyId)})`,
                                size: 22,
                                font: "Calibri",
                                italics: true
                            })
                        ];
                    } else {
                        // Mellanrader: bara text
                        textRuns = [
                            new TextRun({
                                text: '   ' + lines[lineIndex],
                                size: 22,
                                font: "Calibri"
                            })
                        ];
                    }

                    // Om det bara finns en rad, lägg till bristindex på samma rad
                    if (lines.length === 1) {
                        textRuns.push(new TextRun({ text: ' ', size: 22, font: "Calibri" }));
                        textRuns.push(new TextRun({
                            text: `(${deficiency.deficiencyId})`,
                            size: 22,
                            font: "Calibri",
                            italics: true
                        }));
                    }

                    children.push(new Paragraph({
                        children: textRuns
                    }));
                }
            } else {
                // Enkel text utan radbrytningar
                const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
                children.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: numberPrefix + prefix + observationText + ' ',
                            size: 22,
                            font: "Calibri",
                            bold: true
                        }),
                        new TextRun({
                            text: `(${deficiency.deficiencyId})`,
                            size: 22,
                            font: "Calibri",
                            italics: true
                        })
                    ]
                }));
            }
        });
    }

    return children;
}
/**
 * @fileoverview Word-export: förstasidetabell och kravsidor (legacy, ej kopplade till huvudexport).
 */
import { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, UnderlineType, ExternalHyperlink } from 'docx';
import * as Helpers from '../utils/helpers.js';
import * as ScoreCalculator from '../logic/ScoreCalculator.js';
import { get_current_language_code_from_registry } from '../utils/translation_access.js';
import {
    create_paragraphs_with_line_breaks,
    create_text_runs_with_line_breaks,
    formatDeficiencyForWord
} from './export_format_helpers.js';
import { parse_markdown_to_text_runs } from './export_word_markdown_docx.js';
import {
    get_total_requirements_count,
    get_requirements_percentage,
    get_samples_for_requirement,
    get_deficiencies_for_sample,
    get_expected_observation,
    get_actor_comment
} from './export_word_deficiency_queries.js';
import {
    get_primary_grouping_taxonomy_id,
    resolve_taxonomy_concepts,
    sort_concept_ids_for_display,
} from '../../shared/classification/taxonomy_grouping.js';

// Hjälpfunktioner för formatering
export function create_heading_text(text: string, level = 2) {
    const sizes: Record<number, number> = { 1: 24, 2: 22, 3: 20 };
    return new TextRun({
        text,
        bold: true,
        size: sizes[level] ?? 22,
        font: "Calibri Light"
    });
}

export function create_body_text(text: string, size = 22) {
    return create_text_runs_with_line_breaks(text, {
        size,
        font: "Calibri"
    });
}

/** Dynamisk principlista från primär grupperingstaxonomi och bristindex. */
function build_principle_breakdown_paragraphs(
    current_audit: Record<string, unknown>,
    score_analysis: { principles?: Record<string, { labelKey?: string; label?: string; score?: number }> } | null,
    t: (key: string, opts?: Record<string, unknown>) => string
): Paragraph[] {
    const rule_content = current_audit?.ruleFileContent as Record<string, unknown> | undefined;
    const taxonomy_id = get_primary_grouping_taxonomy_id(rule_content);
    const concepts = resolve_taxonomy_concepts(rule_content?.metadata, taxonomy_id, t);
    const principle_ids = sort_concept_ids_for_display(
        Object.keys(score_analysis?.principles || {}),
        rule_content?.metadata,
        taxonomy_id
    );
    const label_by_id = new Map(concepts.map((concept) => [concept.id, concept.label]));

    return principle_ids.map((principle_id) => {
        const principle_data = score_analysis?.principles?.[principle_id];
        const label = principle_data?.labelKey
            ? t(principle_data.labelKey)
            : (principle_data?.label || label_by_id.get(principle_id) || principle_id);
        return new Paragraph({
            children: create_body_text(label, 22)
        });
    });
}

export function _create_overview_page(current_audit: any, t: (key: string, opts?: Record<string, unknown>) => string) {
    const lang_code = get_current_language_code_from_registry();
    const score_analysis = ScoreCalculator.calculateQualityScore(current_audit) as {
        totalScore?: number;
        principles?: Record<string, { labelKey?: string; label?: string; score?: number }>;
    } | null;

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
                            ...build_principle_breakdown_paragraphs(current_audit, score_analysis, t)
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

export function _create_requirement_page(
    requirement: any,
    current_audit: any,
    t: (key: string, opts?: Record<string, unknown>) => string
) {
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

    // Granskningsdel för detta krav
    const samples_for_requirement = get_samples_for_requirement(requirement, current_audit);
    for (const sample of samples_for_requirement) {
        const sample_children = create_sample_section(sample, requirement, current_audit, t);
        children.push(...sample_children);
    }

    return children;
}

export function create_sample_section(
    sample: any,
    requirement: any,
    current_audit: any,
    t: (key: string, opts?: Record<string, unknown>) => string
) {
    const children = [];

    // H2: Granskningsdelens namn
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
            const observationText = String(deficiency.observationDetail || '');
            const isStandardText = deficiency.isStandardText || false;
            const prefix = isStandardText ? 'Kravet är inte uppfyllt: ' : '';
            const detailStyle = { size: 22, font: 'Calibri' as const };

            if (observationText.includes('\n')) {
                const lines = observationText.split('\n');
                for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                    const isFirstLine = lineIndex === 0;
                    const isLastLine = lineIndex === lines.length - 1;
                    const textRuns = [];

                    if (isFirstLine) {
                        textRuns.push(
                            new TextRun({
                                text: numberPrefix + prefix,
                                ...detailStyle,
                                bold: true
                            })
                        );
                        textRuns.push(...parse_markdown_to_text_runs(lines[lineIndex]));
                    } else if (isLastLine) {
                        textRuns.push(
                            new TextRun({
                                text: '   ',
                                ...detailStyle
                            })
                        );
                        textRuns.push(...parse_markdown_to_text_runs(lines[lineIndex]));
                        textRuns.push(new TextRun({ text: ' ', ...detailStyle }));
                        textRuns.push(
                            new TextRun({
                                text: `(${formatDeficiencyForWord(deficiency.deficiencyId)})`,
                                ...detailStyle,
                                italics: true
                            })
                        );
                    } else {
                        textRuns.push(
                            new TextRun({
                                text: '   ',
                                ...detailStyle
                            })
                        );
                        textRuns.push(...parse_markdown_to_text_runs(lines[lineIndex]));
                    }

                    if (lines.length === 1) {
                        textRuns.push(new TextRun({ text: ' ', ...detailStyle }));
                        textRuns.push(
                            new TextRun({
                                text: `(${deficiency.deficiencyId})`,
                                ...detailStyle,
                                italics: true
                            })
                        );
                    }

                    children.push(
                        new Paragraph({
                            children: textRuns
                        })
                    );
                }
            } else {
                const textRuns = [
                    new TextRun({
                        text: numberPrefix + prefix,
                        ...detailStyle,
                        bold: true
                    }),
                    ...parse_markdown_to_text_runs(observationText),
                    new TextRun({ text: ' ', ...detailStyle }),
                    new TextRun({
                        text: `(${deficiency.deficiencyId})`,
                        ...detailStyle,
                        italics: true
                    })
                ];

                children.push(
                    new Paragraph({
                        children: textRuns
                    })
                );
            }
        });
    }

    return children;
}

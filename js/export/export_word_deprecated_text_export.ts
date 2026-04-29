// @ts-nocheck
// Deprekerad stickprovsbaserad Word-textexport (behålls tills vidare).
import { Document, Packer, Paragraph, TextRun, ExternalHyperlink, TabStopType } from 'docx';
import * as Helpers from '../utils/helpers.js';
import { format_local_date_for_filename } from '../utils/filename_utils.ts';
import { get_server_filename_datetime, sanitize_filename_segment } from '../utils/download_filename_utils.ts';
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal, get_export_requirement_result } from './export_bootstrap.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';
import {
    get_deficiencies_for_sample_any_req,
    group_deficiencies_by_requirement,
    natural_sort
} from './export_word_deficiency_queries.js';

export async function _export_to_text_export_deprecated(current_audit) {
    consoleManager.log('[Text Export] Starting export_to_text_export function');
    const t = get_t_internal();
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    try {
        const children = [];


        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Textexport - Granskningsresultat per stickprov"
                    })
                ],
                heading: "Heading1"
            })
        );

        const samples = current_audit.samples || [];

        for (const sample of samples) {
            // Kontrollera om stickprovet har några brister alls
            const deficiencies = get_deficiencies_for_sample_any_req(sample, current_audit, t);
            if (deficiencies.length === 0) continue;

            // H2: Stickprovets namn
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: sample.description || sample.url || get_t_internal()('export_unnamed_sample')
                        })
                    ],
                    heading: "Heading2",
                    pageBreakBefore: true
                })
            );

            // 3. Iterera krav med brister för detta stickprov (H3)
            const requirements_map = group_deficiencies_by_requirement(deficiencies, current_audit);

            // Sortera krav enligt referens
            const sorted_req_ids = Object.keys(requirements_map).sort((a, b) => {
                const reqA = current_audit.ruleFileContent.requirements[a];
                const reqB = current_audit.ruleFileContent.requirements[b];
                const refA = reqA?.standardReference?.text || '';
                const refB = reqB?.standardReference?.text || '';
                return natural_sort(refA, refB);
            });

            for (const reqId of sorted_req_ids) {
                const req = current_audit.ruleFileContent.requirements[reqId];
                const reqDeficiencies = requirements_map[reqId];

                // H3: Kravets titel
                // Extrahera siffra från referens för sortering/titel
                let referenceNumber = "";
                if (req.standardReference?.text) {
                    const refText = req.standardReference.text.trim();
                    const startMatch = refText.match(/^([\d\.]+)/);
                    const endMatch = refText.match(/([\d\.]+)$/);
                    if (startMatch) referenceNumber = startMatch[1];
                    else if (endMatch) referenceNumber = endMatch[1];
                }
                if (referenceNumber.endsWith('.')) referenceNumber = referenceNumber.slice(0, -1);

                const h3_text = (referenceNumber ? referenceNumber + " " : "") + req.title;

                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: h3_text
                            })
                        ],
                        heading: "Heading3"
                    })
                );

                // Metadata (Referens, Principer, Brist)
                const metadata_items = [];

                // Referens
                if (req.standardReference?.text) {
                    const ref_text = req.standardReference.text;
                    const ref_url = req.standardReference.url;

                    if (ref_url) {
                        metadata_items.push(new Paragraph({
                            children: [
                                new TextRun({ text: "Referens: ", bold: true }),
                                new ExternalHyperlink({
                                    children: [new TextRun({ text: ref_text, style: "Hyperlink" })],
                                    // Använd helper för att säkra url om den finns
                                    link: (Helpers && Helpers.add_protocol_if_missing) ? Helpers.add_protocol_if_missing(ref_url) : ref_url
                                })
                            ]
                        }));
                    } else {
                        metadata_items.push(new Paragraph({
                            children: [
                                new TextRun({ text: "Referens: ", bold: true }),
                                new TextRun({ text: ref_text })
                            ]
                        }));
                    }
                }

                // Principer
                {
                    const classifications = Array.isArray(req.classifications) ? req.classifications : [];
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
                        metadata_items.push(new Paragraph({
                            children: [
                                new TextRun({ text: "Principer: ", bold: true }),
                                new TextRun({ text: principle_texts.join(', ') })
                            ]
                        }));
                    }
                }

                // Identifierade brister (specifika för detta stickprov/krav)
                const deficiencyIds = [...new Set(reqDeficiencies.map(d => extractDeficiencyNumber(d.deficiencyId)))].filter(Boolean).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                if (deficiencyIds.length > 0) {
                    metadata_items.push(new Paragraph({
                        children: [
                            new TextRun({ text: "Identifierade brister: ", bold: true }),
                            new TextRun({ text: deficiencyIds.join(', ') })
                        ]
                    }));
                }

                children.push(...metadata_items);

                // Dummy Text (Utan rubrik "Kravets syfte")
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Här kommer en ny text visas. Denna text är ännu inte klar."
                            })
                        ]
                    })
                );

                // H4: "Aktuella observationer"
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Aktuella observationer"
                            })
                        ],
                        heading: "Heading4"
                    })
                );

                // Lista observationer/brister
                for (let i = 0; i < reqDeficiencies.length; i++) {
                    const deficiency = reqDeficiencies[i];

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
                            let textRuns = [];
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
                                    textRuns.push(new TextRun({ text: prefix + runText }));
                                } else {
                                    const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
                                    textRuns.push(new TextRun({ text: prefix + runText }));
                                }
                            } else {
                                textRuns = [new TextRun({ text: runText + (isLastLine ? ' ' : '') })];
                            }

                            children.push(new Paragraph({
                                children: textRuns,
                                spacing: { after: isLastLine ? 240 : 0 },
                                indent: indentConfig,
                                tabStops: tabStopsConfig
                            }));
                        }
                    } else {
                        // Enkelrad
                        const textRuns = [];
                        const isBulletLine = observationText.trim().startsWith('•');
                        const indentConfig = isBulletLine ? { left: 227, hanging: 227 } : {};
                        const tabStopsConfig = isBulletLine ? [{ position: 227, type: TabStopType.LEFT }] : [];

                        let runText = observationText;
                        if (isBulletLine) runText = runText.replace('• ', '•\t');

                        if (defIdString) {
                            textRuns.push(new TextRun({ text: defIdString, bold: true }));
                            const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
                            textRuns.push(new TextRun({ text: prefix + runText + ' ' }));
                        } else {
                            const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
                            textRuns.push(new TextRun({ text: prefix + runText + ' ' }));
                        }

                        children.push(new Paragraph({
                            children: textRuns,
                            spacing: { after: 240 },
                            indent: indentConfig,
                            tabStops: tabStopsConfig
                        }));
                    }
                } // slut loop observationer

                // Kommentar för detta krav på detta stickprov
                const sample_result = get_export_requirement_result(
                    current_audit.ruleFileContent.requirements,
                    sample,
                    req
                );
                if (sample_result && sample_result.commentToActor && sample_result.commentToActor.trim()) {
                    children.push(new Paragraph({
                        children: [new TextRun({ text: "" })],
                        spacing: { before: 120 }
                    }));
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: "Kommentar: ", bold: true, color: "6E3282" }),
                            new TextRun({ text: sample_result.commentToActor.trim() })
                        ]
                    }));
                }

            } // slut loop krav
        } // slut loop stickprov

        const doc = new Document({
            sections: [{
                properties: {},
                children: children
            }],
            styles: {
                default: {
                    document: {
                        run: {
                            font: "Calibri",
                            size: 22 // 11pt
                        },
                        paragraph: {
                            spacing: {
                                after: 60, // 3pt
                                line: 240, // 1.0
                                lineRule: "auto"
                            }
                        }
                    },
                    heading1: {
                        run: {
                            font: "Calibri",
                            size: 36, // 18pt
                            bold: true
                        },
                        paragraph: {
                            spacing: {
                                before: 200, // 10pt
                                after: 60,   // 3pt
                                line: 240,
                                lineRule: "auto"
                            }
                        }
                    },
                    heading2: {
                        run: {
                            font: "Calibri",
                            size: 32, // 16pt
                            bold: true
                        },
                        paragraph: {
                            spacing: {
                                before: 200, // 10pt
                                after: 60,   // 3pt
                                line: 240,
                                lineRule: "auto"
                            }
                        }
                    },
                    heading3: {
                        run: {
                            font: "Calibri",
                            size: 28, // 14pt
                            bold: true
                        },
                        paragraph: {
                            spacing: {
                                before: 200, // 10pt
                                after: 60,   // 3pt
                                line: 240,
                                lineRule: "auto"
                            }
                        }
                    },
                    heading4: {
                        run: {
                            font: "Calibri",
                            size: 24, // 12pt
                            bold: true
                        },
                        paragraph: {
                            spacing: {
                                before: 200, // 10pt
                                after: 60,   // 3pt
                                line: 240,
                                lineRule: "auto"
                            }
                        }
                    }
                }
            }
        });

        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        const report_prefix = t('filename_audit_report_prefix');
        const deficiencies_suffix = "textexport";
        const actor_name = sanitize_filename_segment(current_audit.auditMetadata.actorName || t('filename_fallback_actor'));
        const last_updated_iso = current_audit?.updated_at || null;
        const server_dt = await get_server_filename_datetime(last_updated_iso);
        const fallback_now = server_dt ? null : await get_server_filename_datetime(null);
        const ts = server_dt || fallback_now || format_local_date_for_filename(new Date(), '');
        const filename = `${report_prefix}_${deficiencies_suffix}_${actor_name}_${ts}.docx`;

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');

    } catch (error) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn("Error exporting to Word (Textexport):", error);
        show_global_message_internal(t('error_exporting_word') + ` ${error.message}`, 'error');
    }
}

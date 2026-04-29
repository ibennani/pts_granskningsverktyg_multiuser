// @ts-nocheck
/**
 * @fileoverview Word-export: huvudflöde (krav- respektive stickprovssortering).
 */
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    SectionType,
    PageOrientation,
    ExternalHyperlink
} from 'docx';
import { format_local_date_for_filename } from '../utils/filename_utils.ts';
import { get_server_filename_datetime, sanitize_filename_segment } from '../utils/download_filename_utils.ts';
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';
import {
    get_requirements_with_deficiencies,
    natural_sort,
    get_samples_with_deficiencies_for_requirement,
    get_deficiencies_for_sample,
    get_failing_requirement_ids_for_sample,
    get_all_deficiencies_for_sample_generic
} from './export_word_deficiency_queries.js';
import {
    extract_reference_number,
    create_metadata_paragraphs,
    create_observation_paragraphs,
    create_comment_paragraphs
} from './export_word_requirement_sections.js';

// sortBy kan vara 'requirements' (sorterar på krav) eller 'samples' (sorterar på stickprov)
export async function export_to_word_wrapper(current_audit, sortBy) {
    const t = get_t_internal();
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    const isSortByRequirements = sortBy === 'requirements';
    consoleManager.log(`[Word Export] Starting export_to_word_wrapper with sortBy=${sortBy}`);

    try {
        const children = [];

        // H1 och intro-text (samma för båda)
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Redovisning av granskningsresultatet"
                    })
                ],
                heading: "Heading1"
            }),
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Det här avsnittet redovisar samtliga brister som har identifierats vid granskningen. För varje krav anges i vilka stickprov PTS har observerat brister."
                    })
                ]
            }),
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Bristerna kan även förekomma i andra delar av e-handeln än de stickprov som har granskats. Verksamheten behöver därför gå igenom e-handeln i sin helhet för att identifiera om motsvarande brister finns även utanför stickproven."
                    })
                ]
            }),
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Redovisningen omfattar endast de brister som har iakttagits inom ramen för den genomförda granskningen."
                    })
                ]
            })
        );

        if (isSortByRequirements) {
            // Sortera på krav först
            const requirements_with_deficiencies = get_requirements_with_deficiencies(current_audit);
            consoleManager.log('[Word Export] Found requirements with deficiencies:', requirements_with_deficiencies.length);

            const sorted_requirements = requirements_with_deficiencies.sort((a, b) => {
                const ref_a = a.standardReference?.text || '';
                const ref_b = b.standardReference?.text || '';
                return natural_sort(ref_a, ref_b);
            });

            for (const req of sorted_requirements) {
                const referenceNumber = extract_reference_number(req);
                const h2_text = (referenceNumber ? referenceNumber + " " : "") + req.title;
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: h2_text })],
                        heading: "Heading2",
                        pageBreakBefore: true
                    })
                );

                // Metadata för detta krav (alla brister för alla stickprov)
                const all_deficiency_ids = new Set();
                const samples_for_ids = get_samples_with_deficiencies_for_requirement(req, current_audit);
                for (const sample of samples_for_ids) {
                    const defs = get_deficiencies_for_sample(req, sample, current_audit, t);
                    for (const def of defs) {
                        if (def.deficiencyId) {
                            const id = extractDeficiencyNumber(def.deficiencyId);
                            if (id) all_deficiency_ids.add(id);
                        }
                    }
                }
                const sorted_deficiency_ids = Array.from(all_deficiency_ids).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                children.push(...create_metadata_paragraphs(req, current_audit, sorted_deficiency_ids, t));

                // H3 för varje stickprov när sorterat på krav
                const samples_with_deficiencies = get_samples_with_deficiencies_for_requirement(req, current_audit);
                for (const sample of samples_with_deficiencies) {
                    const deficiencies = get_deficiencies_for_sample(req, sample, current_audit, t);
                    const sampleName = sample.description || sample.url || "";

                    const h3_children = [new TextRun({ text: "Stickprov: ", color: "000000" })];
                    if (sample.url) {
                        h3_children.push(
                            new ExternalHyperlink({
                                children: [new TextRun({ text: sampleName, style: "Hyperlink" })],
                                link: sample.url
                            })
                        );
                    } else {
                        h3_children.push(new TextRun({ text: sampleName, color: "000000" }));
                    }

                    children.push(
                        new Paragraph({
                            children: h3_children,
                            heading: "Heading3",
                            spacing: { before: 200, after: 60 }
                        })
                    );

                    // Observationer
                    for (const deficiency of deficiencies) {
                        children.push(...create_observation_paragraphs(deficiency, t));
                    }

                    // Kommentarer
                    children.push(...create_comment_paragraphs(req, sample, current_audit.ruleFileContent.requirements, t));
                }
            }
        } else {
            // Sortera på stickprov först
            const all_samples = current_audit.samples || [];
            const samples_with_deficiencies = all_samples.filter(sample => {
                const defs = get_all_deficiencies_for_sample_generic(sample, current_audit);
                return defs.length > 0;
            });

            consoleManager.log('[Word Export] Found samples with deficiencies:', samples_with_deficiencies.length);

            for (const sample of samples_with_deficiencies) {
                // H2 Sample Name
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: sample.description || sample.url || t('export_unspecified_sample')
                            })
                        ],
                        heading: "Heading2",
                        pageBreakBefore: true
                    })
                );

                // Get failing requirements for this sample
                const failing_req_ids = get_failing_requirement_ids_for_sample(sample);
                const failing_reqs = [];
                const all_reqs = current_audit.ruleFileContent.requirements || {};

                failing_req_ids.forEach(req_id => {
                    let req = null;
                    if (all_reqs[req_id]) req = all_reqs[req_id];
                    else {
                        req = Object.values(all_reqs).find(r => r.id === req_id || r.key === req_id);
                    }
                    if (req) failing_reqs.push(req);
                });

                const sorted_reqs = failing_reqs.sort((a, b) => {
                    const ref_a = a.standardReference?.text || '';
                    const ref_b = b.standardReference?.text || '';
                    return natural_sort(ref_a, ref_b);
                });

                for (const req of sorted_reqs) {
                    const referenceNumber = extract_reference_number(req);
                    const h3_text = (referenceNumber ? referenceNumber + " " : "") + req.title;

                    children.push(
                        new Paragraph({
                            children: [new TextRun({ text: h3_text })],
                            heading: "Heading3",
                            spacing: { before: 360 }
                        })
                    );

                    // Metadata för detta krav och stickprov
                    const deficiencies = get_deficiencies_for_sample(req, sample, current_audit, t);
                    const deficiencyIds = [...new Set(deficiencies.map(d => extractDeficiencyNumber(d.deficiencyId)))].filter(Boolean).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                    children.push(...create_metadata_paragraphs(req, current_audit, deficiencyIds, t));

                    // H4 "Aktuella observationer"
                    children.push(
                        new Paragraph({
                            children: [new TextRun({ text: "Aktuella observationer" })],
                            heading: "Heading4",
                            spacing: { before: 200 }
                        })
                    );

                    // Observationer
                    for (const deficiency of deficiencies) {
                        children.push(...create_observation_paragraphs(deficiency, t));
                    }

                    // Kommentarer
                    children.push(...create_comment_paragraphs(req, sample, current_audit.ruleFileContent.requirements, t));
                }
            }
        }

        // Skapa dokument med samma styles för båda
        const doc = new Document({
            sections: [{
                properties: isSortByRequirements ? {} : {
                    type: SectionType.NEXT_PAGE,
                    page: {
                        size: {
                            orientation: PageOrientation.PORTRAIT,
                            width: 11906,
                            height: 16838
                        },
                        margin: {
                            top: 1440,
                            right: 1440,
                            bottom: 1440,
                            left: 1440
                        }
                    }
                },
                children: children
            }],
            styles: {
                default: {
                    document: {
                        run: {
                            font: "Calibri",
                            size: 22
                        },
                        paragraph: {
                            alignment: isSortByRequirements ? undefined : AlignmentType.LEFT,
                            spacing: {
                                after: 60,
                                line: 240,
                                lineRule: "auto"
                            }
                        }
                    },
                    heading1: {
                        run: {
                            font: "Calibri",
                            size: 36,
                            bold: true
                        },
                        paragraph: {
                            spacing: {
                                before: 200,
                                after: 60
                            },
                            outlineLevel: isSortByRequirements ? undefined : 0
                        }
                    },
                    heading2: {
                        run: {
                            font: "Calibri",
                            size: 32,
                            bold: true
                        },
                        paragraph: {
                            spacing: {
                                before: 200,
                                after: 60
                            },
                            outlineLevel: isSortByRequirements ? undefined : 1
                        }
                    },
                    heading3: {
                        run: {
                            font: "Calibri",
                            size: 28,
                            bold: true
                        },
                        paragraph: {
                            spacing: {
                                before: 200,
                                after: 60
                            },
                            outlineLevel: isSortByRequirements ? undefined : 2
                        }
                    },
                    heading4: {
                        run: {
                            font: "Calibri",
                            size: 24,
                            bold: true
                        },
                        paragraph: {
                            spacing: {
                                before: 200,
                                after: 60
                            },
                            outlineLevel: isSortByRequirements ? undefined : 3
                        }
                    }
                }
            }
        });

        const buffer = await Packer.toBlob(doc);
        const url = URL.createObjectURL(buffer);
        const link = document.createElement('a');

        const actor_name = sanitize_filename_segment(current_audit.auditMetadata.actorName || t('filename_fallback_actor'));
        const case_number = (current_audit.auditMetadata.caseNumber || '').trim();
        
        // Behåll bindestreck i ärendenummer (t.ex. "25-18359")
        const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
        
        const sort_suffix = isSortByRequirements ? '_sorterat_på_krav' : '_sorterat_på_stickprov';
        const last_updated_iso = current_audit?.updated_at || null;
        const server_dt = await get_server_filename_datetime(last_updated_iso);
        const fallback_now = server_dt ? null : await get_server_filename_datetime(null);
        const date_str = server_dt || fallback_now || format_local_date_for_filename(new Date(), '');
        
        let filename;
        if (sanitized_case_number) {
            filename = `${sanitized_case_number}_${actor_name}_${date_str}${sort_suffix}.docx`;
        } else {
            filename = `${actor_name}_${date_str}${sort_suffix}.docx`;
        }

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');

    } catch (error) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn("Error exporting to Word:", error);
        show_global_message_internal(t('error_exporting_word') + ` ${error.message}`, 'error');
    }
}

export async function export_to_word_criterias(current_audit) {
    return await export_to_word_wrapper(current_audit, 'requirements');
}

export async function export_to_word_samples(current_audit) {
    return await export_to_word_wrapper(current_audit, 'samples');
}
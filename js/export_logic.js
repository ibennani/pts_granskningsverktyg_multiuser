// js/export_logic.js

import ExcelJS from 'exceljs/dist/exceljs.min.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, UnderlineType, ExternalHyperlink, InternalHyperlink, ShadingType, TabStopType, SectionType, PageOrientation } from 'docx';
import { marked } from './utils/markdown.js';

function get_t_internal() {
    if (typeof window.Translation !== 'undefined' && typeof window.Translation.t === 'function') {
        return window.Translation.t;
    }
    return (key, replacements) => `**${key}**`;
}

function show_global_message_internal(message, type, duration) {
    if (typeof window.NotificationComponent !== 'undefined' && typeof window.NotificationComponent.show_global_message === 'function') {
        window.NotificationComponent.show_global_message(message, type, duration);
    }
}

function create_paragraphs_with_line_breaks(text, options = {}) {
    if (!text) {
        return [new Paragraph({
            children: [new TextRun({ text: '', ...options })]
        })];
    }

    const lines = text.split('\n');
    const paragraphs = [];

    for (let i = 0; i < lines.length; i++) {
        paragraphs.push(new Paragraph({
            children: [new TextRun({ text: lines[i], ...options })]
        }));
    }

    return paragraphs;
}

function create_text_runs_with_line_breaks(text, options = {}) {
    // Enkelt fall för TextRuns - vi kan bara använda \n direkt i texten
    // Word kommer att hantera detta som en mjuk radbrytning
    if (!text) {
        return [new TextRun({ text: '', ...options })];
    }

    return [new TextRun({ text: text, ...options })];
}

function escape_for_csv(str) {
    if (str === null || str === undefined) {
        return '';
    }
    let result = String(str);
    result = result.replace(/"/g, '""');
    result = result.replace(/(\r\n|\n|\r)/gm, " ");
    if (/[",;]/.test(result)) {
        result = `"${result}"`;
    }
    return result;
}

function get_pass_criterion_text(req_definition, check_id, pc_id) {
    if (!req_definition?.checks) return pc_id;
    const check = req_definition.checks.find(c => c.id === check_id);
    if (!check?.passCriteria) return pc_id;
    const pc = check.passCriteria.find(p => p.id === pc_id);
    return pc ? pc.requirement : pc_id;
}

function extractDeficiencyNumber(deficiencyId) {
    if (!deficiencyId) return '';
    // Ta bort B-prefix och returnera bara numret
    return deficiencyId.replace(/^B/, '');
}

function formatDeficiencyForWord(deficiencyId) {
    if (!deficiencyId) return '';
    const number = extractDeficiencyNumber(deficiencyId);
    // Använd non-breaking space (\u00A0) för att förhindra radbrytning mellan "Brist" och numret
    return `Brist\u00A0${number}`;
}


function export_to_csv(current_audit) {
    const t = get_t_internal();
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    let csv_content_array = [];

    const headers = [
        t('excel_col_deficiency_id'),
        t('excel_col_req_title'),
        t('excel_col_reference'),
        t('excel_col_sample_name'),
        t('excel_col_sample_url'),
        "Kravets syfte",
        t('excel_col_observation')
    ];
    csv_content_array.push(headers.join(';'));

    (current_audit.samples || []).forEach(sample => {
        const all_reqs = Object.values(current_audit.ruleFileContent.requirements || {});
        all_reqs.forEach(req_definition => {
            const req_key = req_definition.key || req_definition.id;
            const result = (sample.requirementResults || {})[req_key];
            if (!result || !result.checkResults) return;

            Object.keys(result.checkResults).forEach(check_id => {
                const check_res = result.checkResults[check_id];
                if (!check_res || !check_res.passCriteria) return;

                Object.keys(check_res.passCriteria).forEach(pc_id => {
                    const pc_obj = check_res.passCriteria[pc_id];
                    if (pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId) {
                        const controlText = get_pass_criterion_text(req_definition, check_id, pc_id);

                        const pc_def = req_definition.checks?.find(c => c.id === check_id)?.passCriteria?.find(p => p.id === pc_id);
                        const templateObservation = pc_def?.failureStatementTemplate || '';
                        const userObservation = pc_obj.observationDetail || '';
                        const passCriterionText = pc_def?.requirement || '';

                        let finalObservation = userObservation;
                        if (!userObservation.trim() || userObservation.trim() === templateObservation.trim()) {
                            finalObservation = passCriterionText;
                        }

                        const row_values = [
                            escape_for_csv(extractDeficiencyNumber(pc_obj.deficiencyId)),
                            escape_for_csv(req_definition.title),
                            escape_for_csv(req_definition.standardReference?.text || ''),
                            escape_for_csv(sample.description),
                            escape_for_csv(sample.url),
                            escape_for_csv("Här kommer en ny text visas. Denna text är ännu inte klar."),
                            escape_for_csv(finalObservation)
                        ];
                        csv_content_array.push(row_values.join(';'));
                    }
                });
            });
        });
    });

    const csv_string = csv_content_array.join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv_string], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const actor_name = (current_audit.auditMetadata.actorName || t('filename_fallback_actor')).replace(/[^a-z0-9åäöÅÄÖ]/gi, '_');
    const case_number = (current_audit.auditMetadata.caseNumber || '').trim();
    // Behåll bindestreck i ärendenummer (t.ex. "25-18359")
    const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
    const date_str = new Date().toISOString().split('T')[0];
    
    let filename;
    if (sanitized_case_number) {
        filename = `${sanitized_case_number}_${actor_name}_${date_str}_brister_lista.csv`;
    } else {
        filename = `${actor_name}_${date_str}_brister_lista.csv`;
    }

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');
}

async function export_to_excel(current_audit) {
    const t = get_t_internal();
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    if (!ExcelJS) {
        show_global_message_internal(t('excel_library_not_loaded'), 'error');
        console.error("ExcelJS library is not loaded.");
        return;
    }

    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'PTS Granskningsverktyg';
        workbook.created = new Date();

        const generalSheet = workbook.addWorksheet(t('excel_sheet_general_info'));

        const lang_code = window.Translation.get_current_language_code();

        const general_info_data = [
            [t('case_number'), current_audit.auditMetadata.caseNumber || ''],
            [t('actor_name'), current_audit.auditMetadata.actorName || ''],
            [t('actor_link'), current_audit.auditMetadata.actorLink || ''],
            [t('auditor_name'), current_audit.auditMetadata.auditorName || ''],
            [t('case_handler'), current_audit.auditMetadata.caseHandler || ''],
            [t('rule_file_title'), current_audit.ruleFileContent.metadata.title || ''],
            [t('version_rulefile'), current_audit.ruleFileContent.metadata.version || ''],
            [t('status'), t(`audit_status_${current_audit.auditStatus}`)],
            [t('start_time'), current_audit.startTime ? window.Helpers.format_iso_to_local_datetime(current_audit.startTime, lang_code) : ''],
            [t('end_time'), current_audit.endTime ? window.Helpers.format_iso_to_local_datetime(current_audit.endTime, lang_code) : '']
        ];

        // --- START OF CHANGE ---
        const score_analysis = window.ScoreCalculator.calculateQualityScore(current_audit);
        const deficiency_index_value = score_analysis ? score_analysis.totalScore : null;
        const display_deficiency_index = (deficiency_index_value !== null && deficiency_index_value !== undefined)
            ? window.Helpers.format_number_locally(deficiency_index_value, lang_code)
            : '---';

        general_info_data.push([t('deficiency_index_title', { defaultValue: "Deficiency Index" }), `${display_deficiency_index} / 100`]);
        // --- END OF CHANGE ---

        generalSheet.addRows(general_info_data);
        generalSheet.getColumn(1).width = 30;
        generalSheet.getColumn(2).width = 70;

        const deficienciesSheet = workbook.addWorksheet(t('excel_sheet_deficiencies'));
        deficienciesSheet.columns = [
            { header: t('excel_col_deficiency_id'), key: 'id', width: 20 },
            { header: t('excel_col_req_title'), key: 'reqTitle', width: 45 },
            { header: t('excel_col_reference'), key: 'reference', width: 40 },
            { header: t('excel_col_sample_name'), key: 'sampleName', width: 30 },
            { header: t('excel_col_sample_url'), key: 'sampleUrl', width: 40 },
            { header: "Kravets syfte", key: 'control', width: 60 },
            { header: t('excel_col_observation'), key: 'observation', width: 70 },
            { header: t('excel_col_pts_qc_comments'), key: 'ptsQcComments', width: 70 }
        ];

        const deficiencies_data = [];
        (current_audit.samples || []).forEach(sample => {
            const all_reqs = Object.values(current_audit.ruleFileContent.requirements || {});
            all_reqs.forEach(req_definition => {
                const req_key = req_definition.key || req_definition.id;
                const result = (sample.requirementResults || {})[req_key];
                if (!result || !result.checkResults) return;
                Object.keys(result.checkResults).forEach(check_id => {
                    const check_res = result.checkResults[check_id];
                    if (!check_res || !check_res.passCriteria) return;
                    Object.keys(check_res.passCriteria).forEach(pc_id => {
                        const pc_obj = check_res.passCriteria[pc_id];
                        if (pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId) {
                            const pc_def = req_definition.checks?.find(c => c.id === check_id)?.passCriteria?.find(p => p.id === pc_id);
                            const templateObservation = pc_def?.failureStatementTemplate || '';
                            const userObservation = pc_obj.observationDetail || '';
                            const passCriterionText = pc_def?.requirement || '';

                            let finalObservation = userObservation;
                            if (!userObservation.trim() || userObservation.trim() === templateObservation.trim()) {
                                finalObservation = passCriterionText;
                            }

                            const reference_obj = { text: req_definition.standardReference?.text || '' };
                            if (req_definition.standardReference?.url) {
                                reference_obj.hyperlink = window.Helpers.add_protocol_if_missing(req_definition.standardReference.url);
                            }

                            const url_obj = sample.url ? {
                                text: sample.url,
                                hyperlink: window.Helpers.add_protocol_if_missing(sample.url)
                            } : null;

                            deficiencies_data.push({
                                id: extractDeficiencyNumber(pc_obj.deficiencyId),
                                reqTitle: req_definition.title,
                                reference: reference_obj,
                                sampleName: sample.description,
                                sampleUrl: url_obj,
                                control: "Här kommer en ny text visas. Denna text är ännu inte klar.",
                                observation: finalObservation,
                                ptsQcComments: ''
                            });
                        }
                    });
                });
            });
        });

        deficiencies_data.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
        deficienciesSheet.addRows(deficiencies_data);

        const headerRow = deficienciesSheet.getRow(1);
        headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6E3282' } };
        headerRow.alignment = { vertical: 'top', wrapText: true };

        deficienciesSheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
            if (rowNumber > 1) {
                const isEvenRow = rowNumber % 2 === 0;
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEvenRow ? 'FFF4F1EE' : 'FFFFFFFF' } };
                row.font = { color: { argb: 'FF000000' } };
                row.alignment = { vertical: 'top', wrapText: true };

                const referenceCell = row.getCell('reference');
                if (referenceCell.hyperlink) {
                    referenceCell.font = { color: { argb: 'FF0000FF' }, underline: true };
                }
                const sampleUrlCell = row.getCell('sampleUrl');
                if (sampleUrlCell.hyperlink) {
                    sampleUrlCell.font = { color: { argb: 'FF0000FF' }, underline: true };
                }
            }
        });

        deficienciesSheet.autoFilter = { from: 'A1', to: { row: 1, column: deficienciesSheet.columns.length } };
        deficienciesSheet.views = [{ state: 'frozen', ySplit: 1 }];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const actor_name = (current_audit.auditMetadata.actorName || t('filename_fallback_actor')).replace(/[^a-z0-9åäöÅÄÖ]/gi, '_');
        const case_number = (current_audit.auditMetadata.caseNumber || '').trim();
        // Behåll bindestreck i ärendenummer (t.ex. "25-18359")
        const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
        const date_str = new Date().toISOString().split('T')[0];
        
        let filename;
        if (sanitized_case_number) {
            filename = `${sanitized_case_number}_${actor_name}_${date_str}_brister_lista.xlsx`;
        } else {
            filename = `${actor_name}_${date_str}_brister_lista.xlsx`;
        }

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');

    } catch (error) {
        console.error("Error exporting to Excel with ExcelJS:", error);
        show_global_message_internal(t('error_exporting_excel') + ` ${error.message}`, 'error');
    }
}

// Gemensam hjälpfunktion för att extrahera referensnummer från en krav-referens
function extract_reference_number(requirement) {
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
function create_metadata_paragraphs(requirement, current_audit, deficiencyIds, t) {
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

    // Brist
    if (deficiencyIds.length > 0) {
        metadata_items.push(
            new Paragraph({
                children: [
                    new TextRun({ text: "Brist: ", bold: true }),
                    new TextRun({ text: deficiencyIds.join(', ') })
                ]
            })
        );
    }

    return metadata_items;
}

// Gemensam hjälpfunktion för att formatera observationer som paragraf
function create_observation_paragraphs(deficiency, t) {
    const paragraphs = [];
    let observationText = (deficiency.observationDetail || '').trim();
    observationText = observationText.replace(/^[\s]*[-*]\s/gm, '• ');

    const isStandardText = deficiency.isStandardText || false;
    const defId = extractDeficiencyNumber(deficiency.deficiencyId);
    const defIdString = defId ? `Brist ${defId}: ` : '';

    if (observationText.includes('\n')) {
        const lines = observationText.split('\n');
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const isFirstLine = lineIndex === 0;
            const isLastLine = lineIndex === lines.length - 1;
            let textRuns = [];
            let lineText = lines[lineIndex];
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
            } else if (isLastLine) {
                textRuns = [new TextRun({ text: runText + ' ' })];
            } else {
                textRuns = [new TextRun({ text: runText })];
            }

            paragraphs.push(
                new Paragraph({
                    children: textRuns,
                    spacing: { after: isLastLine ? 120 : 0 },
                    indent: indentConfig,
                    tabStops: tabStopsConfig
                })
            );
        }
    } else {
        let textRuns = [];
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

        paragraphs.push(
            new Paragraph({
                children: textRuns,
                spacing: { after: 120 },
                indent: indentConfig,
                tabStops: tabStopsConfig
            })
        );
    }

    return paragraphs;
}

// Gemensam hjälpfunktion för att skapa kommentar-paragraf
function create_comment_paragraphs(requirement, sample, t) {
    const paragraphs = [];
    const req_key = requirement.key || requirement.id;
    const sample_result = (sample.requirementResults || {})[req_key];
    if (sample_result && sample_result.commentToActor && sample_result.commentToActor.trim()) {
        paragraphs.push(
            new Paragraph({
                children: [new TextRun({ text: "" })],
                spacing: { before: 120 }
            })
        );
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Kommentar: ",
                        bold: true,
                        color: "6E3282"
                    }),
                    new TextRun({
                        text: sample_result.commentToActor.trim()
                    })
                ],
                spacing: { after: 60 }
            })
        );
    }
    return paragraphs;
}

// Gemensam funktion för Word-export med parameter för sorteringsordning
// sortBy kan vara 'requirements' (sorterar på krav) eller 'samples' (sorterar på stickprov)
async function export_to_word_internal(current_audit, sortBy) {
    const t = get_t_internal();
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    const isSortByRequirements = sortBy === 'requirements';
    console.log(`[Word Export] Starting export_to_word_internal with sortBy=${sortBy}`);

    try {
        const children = [];

        // H1 och intro-text (samma för båda)
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Underkända krav"
                    })
                ],
                heading: "Heading1"
            }),
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Detta avsnitt redovisar en sammanställning av de krav som har underkänts vid granskningen. Sammanställningen baseras på stickprov, vilket innebär att motsvarande brister även kan förekomma på andra delar av den granskade sidan eller på andra delar av webbplatsen. Det är därför nödvändigt att genomföra en genomgång av hela webbplatsen för att säkerställa om samma typ av brister förekommer även på andra ställen. I detta avsnitt redovisas endast de brister som har identifierats vid granskningen."
                    })
                ]
            })
        );

        if (isSortByRequirements) {
            // Sortera på krav först
            const requirements_with_deficiencies = get_requirements_with_deficiencies(current_audit);
            console.log('[Word Export] Found requirements with deficiencies:', requirements_with_deficiencies.length);

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

                // H3 för varje stickprov (höjd från H4)
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
                    children.push(...create_comment_paragraphs(req, sample, t));
                }
            }
        } else {
            // Sortera på stickprov först
            const all_samples = current_audit.samples || [];
            const samples_with_deficiencies = all_samples.filter(sample => {
                const defs = get_all_deficiencies_for_sample_generic(sample, current_audit);
                return defs.length > 0;
            });

            console.log('[Word Export] Found samples with deficiencies:', samples_with_deficiencies.length);

            for (const sample of samples_with_deficiencies) {
                // H2 Sample Name
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: sample.description || sample.url || "Ospecificerat stickprov"
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
                    children.push(...create_comment_paragraphs(req, sample, t));
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

        const actor_name = (current_audit.auditMetadata.actorName || t('filename_fallback_actor')).replace(/[^a-z0-9åäöÅÄÖ]/gi, '_');
        const case_number = (current_audit.auditMetadata.caseNumber || '').trim();
        
        // Behåll bindestreck i ärendenummer (t.ex. "25-18359")
        const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
        
        const sort_suffix = isSortByRequirements ? '_sorterat_på_krav' : '_sorterat_på_stickprov';
        const date_str = new Date().toISOString().split('T')[0];
        
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
        console.error("Error exporting to Word:", error);
        show_global_message_internal(t('error_exporting_word') + ` ${error.message}`, 'error');
    }
}

// Wrapper-funktioner för bakåtkompatibilitet
async function export_to_word(current_audit) {
    return await export_to_word_internal(current_audit, 'requirements');
}

function create_overview_page(current_audit, t) {
    const lang_code = window.Translation.get_current_language_code();
    const score_analysis = window.ScoreCalculator.calculateQualityScore(current_audit);

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
                                children: create_body_text(current_audit.startTime ? window.Helpers.format_iso_to_local_datetime(current_audit.startTime, lang_code) : '', 22)
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
                                children: create_body_text(score_analysis ? window.Helpers.format_number_locally(score_analysis.totalScore, lang_code) : '---', 22)
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

function create_requirement_page(requirement, current_audit, t) {
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
                    link: window.Helpers.add_protocol_if_missing(referenceUrl)
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

function create_sample_section(sample, requirement, current_audit, t) {
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

// Hjälpfunktioner
function get_requirements_with_deficiencies(current_audit) {
    const requirements = Object.values(current_audit.ruleFileContent.requirements || {});
    return requirements.filter(req => {
        const req_key = req.key || req.id;
        return (current_audit.samples || []).some(sample => {
            const result = (sample.requirementResults || {})[req_key];
            if (!result || !result.checkResults) return false;

            return Object.values(result.checkResults).some(check_res => {
                if (!check_res || !check_res.passCriteria) return false;
                return Object.values(check_res.passCriteria).some(pc_obj =>
                    pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId
                );
            });
        });
    });
}

function get_total_requirements_count(current_audit) {
    return Object.keys(current_audit.ruleFileContent.requirements || {}).length;
}

function get_requirements_percentage(current_audit) {
    const total = get_total_requirements_count(current_audit);
    const reviewed = (current_audit.samples || []).reduce((count, sample) => {
        return count + Object.keys(sample.requirementResults || {}).length;
    }, 0);
    return total > 0 ? Math.round((reviewed / total) * 100) : 0;
}

function get_samples_for_requirement(requirement, current_audit) {
    const req_key = requirement.key || requirement.id;
    return (current_audit.samples || []).filter(sample => {
        const result = (sample.requirementResults || {})[req_key];
        if (!result || !result.checkResults) return false;

        return Object.values(result.checkResults).some(check_res => {
            if (!check_res || !check_res.passCriteria) return false;
            return Object.values(check_res.passCriteria).some(pc_obj =>
                pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId
            );
        });
    });
}

function get_expected_observation(requirement, sample) {
    // Denna funktion skulle behöva implementeras baserat på regelfilens struktur
    return null;
}

function get_actor_comment(requirement, sample) {
    // Denna funktion skulle behöva implementeras baserat på regelfilens struktur
    return null;
}

// Hjälpfunktioner för formatering
function create_heading_text(text, level = 2) {
    const sizes = { 1: 24, 2: 22, 3: 20 };
    return new TextRun({
        text,
        bold: true,
        size: sizes[level] || 22,
        font: "Calibri Light"
    });
}

function create_body_text(text, size = 22) {
    return create_text_runs_with_line_breaks(text, {
        size,
        font: "Calibri"
    });
}

// Konverterar markdown-text till Word-paragraf-format
function convert_markdown_to_word_paragraphs(markdown_text) {
    if (!markdown_text || typeof markdown_text !== 'string') {
        return [new Paragraph({
            children: [new TextRun({ text: "" })]
        })];
    }

    const paragraphs = [];
    const lines = markdown_text.split('\n');
    let current_paragraph_text = '';
    let in_list = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed_line = line.trim();

        // Hantera listor
        if (trimmed_line.match(/^[-*+]\s/) || trimmed_line.match(/^\d+\.\s/)) {
            if (!in_list) {
                // Avsluta föregående stycke om det finns
                if (current_paragraph_text.trim()) {
                    paragraphs.push(create_paragraph_from_text(current_paragraph_text));
                    current_paragraph_text = '';
                }
                in_list = true;
            }
            // Lägg till listpunkt med indrag
            const list_text = trimmed_line.replace(/^[-*+]\s/, '').replace(/^\d+\.\s/, '');
            paragraphs.push(new Paragraph({
                children: [new TextRun({ text: `• ${list_text}` })],
                indent: {
                    left: 283, // 0.5 cm = 283 twips
                    hanging: 142  // 0.25 cm = 142 twips
                }
            }));
        }
        // Hantera rubriker
        else if (trimmed_line.startsWith('#')) {
            if (current_paragraph_text.trim()) {
                paragraphs.push(create_paragraph_from_text(current_paragraph_text));
                current_paragraph_text = '';
            }
            const heading_level = trimmed_line.match(/^#+/)[0].length;
            const heading_text = trimmed_line.replace(/^#+\s*/, '');
            paragraphs.push(new Paragraph({
                children: [new TextRun({ text: heading_text, bold: true })],
                heading: `Heading${Math.min(heading_level, 4)}`
            }));
        }
        // Tom rad - avsluta stycke
        else if (trimmed_line === '') {
            if (current_paragraph_text.trim()) {
                paragraphs.push(create_paragraph_from_text(current_paragraph_text));
                current_paragraph_text = '';
            }
            in_list = false;
        }
        // Vanlig text
        else {
            if (in_list) {
                in_list = false;
            }
            if (current_paragraph_text) {
                current_paragraph_text += ' ' + trimmed_line;
            } else {
                current_paragraph_text = trimmed_line;
            }
        }
    }

    // Lägg till sista stycket
    if (current_paragraph_text.trim()) {
        paragraphs.push(create_paragraph_from_text(current_paragraph_text));
    }

    return paragraphs.length > 0 ? paragraphs : [new Paragraph({
        children: [new TextRun({ text: "" })]
    })];
}

// Skapar en paragraf från text med grundläggande markdown-formatering
function create_paragraph_from_text(text) {
    const text_runs = [];
    let current_text = text;

    // Hantera fetstil (**text** eller __text__)
    current_text = current_text.replace(/\*\*(.*?)\*\*/g, (match, content) => {
        return `__BOLD_START__${content}__BOLD_END__`;
    });

    // Hantera kursiv (*text* eller _text_)
    current_text = current_text.replace(/\*(.*?)\*/g, (match, content) => {
        return `__ITALIC_START__${content}__ITALIC_END__`;
    });

    // Dela upp texten i delar
    const parts = current_text.split(/(__BOLD_START__.*?__BOLD_END__|__ITALIC_START__.*?__ITALIC_END__)/);

    for (const part of parts) {
        if (part.includes('__BOLD_START__')) {
            const content = part.replace(/__BOLD_START__|__BOLD_END__/g, '');
            text_runs.push(new TextRun({ text: content, bold: true }));
        } else if (part.includes('__ITALIC_START__')) {
            const content = part.replace(/__ITALIC_START__|__ITALIC_END__/g, '');
            text_runs.push(new TextRun({ text: content, italics: true }));
        } else if (part.trim()) {
            text_runs.push(new TextRun({ text: part }));
        }
    }

    return new Paragraph({
        children: text_runs.length > 0 ? text_runs : [new TextRun({ text: text })]
    });
}

// Naturlig sortering för att hantera nummer korrekt (9.9 → 9.10 → 9.11)
function natural_sort(a, b) {
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;

    // Dela upp strängarna i delar (nummer och text)
    const parts_a = a.toString().split(/(\d+)/);
    const parts_b = b.toString().split(/(\d+)/);

    const max_length = Math.max(parts_a.length, parts_b.length);

    for (let i = 0; i < max_length; i++) {
        const part_a = parts_a[i] || '';
        const part_b = parts_b[i] || '';

        // Om båda delarna är nummer, jämför numeriskt
        if (/^\d+$/.test(part_a) && /^\d+$/.test(part_b)) {
            const num_a = parseInt(part_a, 10);
            const num_b = parseInt(part_b, 10);
            if (num_a !== num_b) {
                return num_a - num_b;
            }
        }
        // Annars jämför alfabetiskt
        else {
            const comparison = part_a.localeCompare(part_b);
            if (comparison !== 0) {
                return comparison;
            }
        }
    }

    return 0;
}

// Hämtar stickprov som har underkännanden för ett specifikt krav
function get_samples_with_deficiencies_for_requirement(requirement, current_audit) {
    const req_key = requirement.key || requirement.id;
    const samples_with_deficiencies = [];

    (current_audit.samples || []).forEach(sample => {
        const result = (sample.requirementResults || {})[req_key];
        if (!result || !result.checkResults) return;

        // Kontrollera om det finns underkännanden
        const has_deficiencies = Object.values(result.checkResults).some(check_res => {
            if (!check_res || !check_res.passCriteria) return false;
            return Object.values(check_res.passCriteria).some(pc_obj =>
                pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId
            );
        });

        if (has_deficiencies) {
            samples_with_deficiencies.push(sample);
        }
    });

    return samples_with_deficiencies;
}

function get_deficiencies_for_sample(requirement, sample, current_audit, t) {
    const deficiencies = [];
    const req_key = requirement.key || requirement.id;
    const result = (sample.requirementResults || {})[req_key];

    if (!result || !result.checkResults) return deficiencies;

    Object.keys(result.checkResults).forEach(check_id => {
        const check_res = result.checkResults[check_id];
        if (!check_res || !check_res.passCriteria) return;

        Object.keys(check_res.passCriteria).forEach(pc_id => {
            const pc_obj = check_res.passCriteria[pc_id];
            if (pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId) {
                const pc_def = requirement.checks?.find(c => c.id === check_id)?.passCriteria?.find(p => p.id === pc_id);
                const templateObservation = pc_def?.failureStatementTemplate || '';
                const userObservation = pc_obj.observationDetail || '';
                const passCriterionText = pc_def?.requirement || '';

                let finalObservation = userObservation;
                let isStandardText = false;
                if (!userObservation.trim() || userObservation.trim() === templateObservation.trim()) {
                    finalObservation = passCriterionText;
                    isStandardText = true;
                }

                deficiencies.push({
                    observationDetail: finalObservation,
                    deficiencyId: pc_obj.deficiencyId,
                    isStandardText: isStandardText
                });
            }
        });
    });

    return deficiencies;
}


// --- STICKPROVSBASERAD TEXTEXPORT (NY) ---
async function export_to_text_export_deprecated(current_audit) {
    console.log('[Text Export] Starting export_to_text_export function');
    const t = get_t_internal();
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    try {
        const children = [];


        // 1. H1 Titel
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

        // 2. Iterera stickprov (H2)
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
                            text: sample.description || sample.url || "Namnlöst stickprov"
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
                                    link: (window.Helpers && window.Helpers.add_protocol_if_missing) ? window.Helpers.add_protocol_if_missing(ref_url) : ref_url
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

                // Brist IDn (specifika för detta stickprov/krav)
                const deficiencyIds = [...new Set(reqDeficiencies.map(d => extractDeficiencyNumber(d.deficiencyId)))].filter(Boolean).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                if (deficiencyIds.length > 0) {
                    metadata_items.push(new Paragraph({
                        children: [
                            new TextRun({ text: "Brist: ", bold: true }),
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
                    const defIdString = defId ? `Brist ${defId}: ` : '';

                    if (observationText.includes('\n')) {
                        const lines = observationText.split('\n');
                        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                            const isFirstLine = lineIndex === 0;
                            const isLastLine = lineIndex === lines.length - 1;
                            let textRuns = [];
                            let lineText = lines[lineIndex];
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
                                spacing: { after: isLastLine ? 120 : 0 },
                                indent: indentConfig,
                                tabStops: tabStopsConfig
                            }));
                        }
                    } else {
                        // Enkelrad
                        let textRuns = [];
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
                            spacing: { after: 120 },
                            indent: indentConfig,
                            tabStops: tabStopsConfig
                        }));
                    }
                } // slut loop observationer

                // Kommentar för detta krav på detta stickprov
                const req_key = req.key || req.id;
                const sample_result = (sample.requirementResults || {})[req_key];
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

        // Generera Word-fil
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
        const actor_name = (current_audit.auditMetadata.actorName || t('filename_fallback_actor')).replace(/[^a-z0-9åäöÅÄÖ]/gi, '_');
        const filename = `${report_prefix}_${deficiencies_suffix}_${actor_name}_${new Date().toISOString().split('T')[0]}.docx`;

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');

    } catch (error) {
        console.error("Error exporting to Word (Textexport):", error);
        show_global_message_internal(t('error_exporting_word') + ` ${error.message}`, 'error');
    }
}




async function export_to_word_samples(current_audit) {
    return await export_to_word_internal(current_audit, 'samples');
}

// Helper to get failing requirement IDs for a specific sample
function get_failing_requirement_ids_for_sample(sample) {
    const failing_ids = [];
    const results = sample.requirementResults || {};
    Object.keys(results).forEach(req_key => {
        const result = results[req_key];
        if (result.checkResults) {
            let hasFailure = false;
            Object.values(result.checkResults).forEach(check => {
                if (check.passCriteria) {
                    Object.values(check.passCriteria).forEach(pc => {
                        if (pc.status === 'failed') hasFailure = true;
                    });
                }
            });
            if (hasFailure) failing_ids.push(req_key);
        }
    });
    return failing_ids;
}

// Helper to get deficiencies for a specific sample and requirement
// (Refactored/Reused existing logic but ensure it's scoped correctly)
// The existing get_deficiencies_for_sample takes (req, sample, current_audit, t)
// We can just use that.

// helper function to get all deficiencies for a sample to check if it has any
function get_all_deficiencies_for_sample_generic(sample, current_audit) {
    const deficiencies = [];
    const all_reqs = current_audit.ruleFileContent.requirements || {};
    Object.values(all_reqs).forEach(req => {
        const defs = get_deficiencies_for_sample(req, sample, current_audit, () => { });
        deficiencies.push(...defs);
    });
    return deficiencies;
}
// --- END OF CHANGE ---

// Hjälpfunktion för att escape HTML
function escape_html_internal(str) {
    if (typeof window.Helpers !== 'undefined' && typeof window.Helpers.escape_html === 'function') {
        return window.Helpers.escape_html(str);
    }
    if (str === null || str === undefined) {
        return '';
    }
    const safe_string = String(str);
    return safe_string
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Hjälpfunktion för att generera anchor-ID från text
function generate_anchor_id(text) {
    if (!text) return '';
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/[åäö]/g, (match) => {
            const map = { 'å': 'a', 'ä': 'a', 'ö': 'o' };
            return map[match] || match;
        })
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Hjälpfunktion för att skapa HTML-metadata (Referens, Principer, Brist)
function create_html_metadata(requirement, current_audit, deficiencyIds, t) {
    let html = '';

    // Referens
    if (requirement.standardReference?.text) {
        const ref_text = escape_html_internal(requirement.standardReference.text);
        const ref_url = requirement.standardReference.url;
        if (ref_url) {
            const safe_url = escape_html_internal(window.Helpers?.add_protocol_if_missing ? window.Helpers.add_protocol_if_missing(ref_url) : ref_url);
            html += `<p class="metadata-compact"><strong>Referens: </strong><a href="${safe_url}" target="_blank" rel="noopener noreferrer">${ref_text}</a></p>`;
        } else {
            html += `<p class="metadata-compact"><strong>Referens: </strong>${ref_text}</p>`;
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
            html += `<p class="metadata-compact"><strong>Principer: </strong>${escape_html_internal(principle_texts.join(', '))}</p>`;
        }
    }

    // Brist - länka varje nummer
    if (deficiencyIds.length > 0) {
        const deficiencyLinks = deficiencyIds.map(id => {
            const anchorId = `deficiency-${id}`;
            return `<a href="#${anchorId}" class="deficiency-link">${escape_html_internal(id)}</a>`;
        }).join(', ');
        html += `<p class="metadata-compact"><strong>Brist: </strong>${deficiencyLinks}</p>`;
    }

    return html;
}

// Hjälpfunktion för att rendera markdown till HTML (säkert)
function render_markdown_to_html(markdown_text) {
    if (!markdown_text || typeof markdown_text !== 'string') {
        return '';
    }

    // Om marked inte är tillgängligt, fallback till escape
    if (typeof marked === 'undefined') {
        return escape_html_internal(markdown_text);
    }

    try {
        const renderer = new marked.Renderer();
        renderer.link = (href, title, text) => {
            const safe_href = escape_html_internal(href);
            const safe_text = escape_html_internal(text);
            return `<a href="${safe_href}" target="_blank" rel="noopener noreferrer">${safe_text}</a>`;
        };
        renderer.html = (html_token) => {
            const text_to_escape = (typeof html_token === 'object' && html_token !== null && typeof html_token.text === 'string')
                ? html_token.text
                : String(html_token || '');
            return escape_html_internal(text_to_escape);
        };

        const parsed_markdown = marked.parse(String(markdown_text), { renderer, breaks: true, gfm: true });
        
        // Sanitize om tillgängligt
        if (typeof window.Helpers !== 'undefined' && typeof window.Helpers.sanitize_html === 'function') {
            return window.Helpers.sanitize_html(parsed_markdown);
        }
        
        return parsed_markdown;
    } catch (error) {
        console.warn('Error rendering markdown:', error);
        return escape_html_internal(markdown_text);
    }
}

// Hjälpfunktion för att skapa HTML-observationer
function create_html_observations(deficiency, t) {
    let html = '';
    let observationText = (deficiency.observationDetail || '').trim();
    observationText = observationText.replace(/^[\s]*[-*]\s/gm, '• ');

    const isStandardText = deficiency.isStandardText || false;
    const defId = extractDeficiencyNumber(deficiency.deficiencyId);
    const anchorId = defId ? `deficiency-${defId}` : '';
    const defIdString = defId ? `Brist ${defId}: ` : '';

    // Rendera markdown för observationstexten
    const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
    const fullText = prefix + observationText;
    let renderedMarkdown = render_markdown_to_html(fullText);
    
    // Ta bort första <p>-taggen om den finns för att undvika radbrytning efter brist-ID
    // Och gör om till inline om det bara är en paragraf
    if (renderedMarkdown.trim().startsWith('<p>') && renderedMarkdown.trim().endsWith('</p>')) {
        renderedMarkdown = renderedMarkdown.trim().replace(/^<p>/, '').replace(/<\/p>$/, '');
    }

    if (defIdString && anchorId) {
        html += `<div class="observation-content" id="${anchorId}"><strong class="deficiency-id">${escape_html_internal(defIdString)}</strong><span class="observation-text">${renderedMarkdown}</span></div>`;
    } else {
        html += `<div class="observation-content">${renderedMarkdown}</div>`;
    }

    return html;
}

// Hjälpfunktion för att skapa HTML-kommentarer
function create_html_comments(requirement, sample, t) {
    let html = '';
    const req_key = requirement.key || requirement.id;
    const sample_result = (sample.requirementResults || {})[req_key];
    if (sample_result && sample_result.commentToActor && sample_result.commentToActor.trim()) {
        html += '<p style="margin-top: 0.5em;"></p>';
        const renderedMarkdown = render_markdown_to_html(sample_result.commentToActor.trim());
        html += `<div class="comment-content"><strong style="color: #6E3282;">Kommentar: </strong>${renderedMarkdown}</div>`;
    }
    return html;
}

// HTML-exportfunktion (sorterar på krav)
async function export_to_html(current_audit) {
    const t = get_t_internal();
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    try {
        // Hämta krav med brister (sorterade på krav)
        const requirements_with_deficiencies = get_requirements_with_deficiencies(current_audit);
        const sorted_requirements = requirements_with_deficiencies.sort((a, b) => {
            const ref_a = a.standardReference?.text || '';
            const ref_b = b.standardReference?.text || '';
            return natural_sort(ref_a, ref_b);
        });

        // Bygg sidebar med länkar (nested structure)
        let sidebar_html = '<nav class="html-export-sidebar" aria-label="Innehållsförteckning" role="navigation"><h2>Innehållsförteckning</h2><ul role="list">';
        sidebar_html += '<li role="listitem" class="sidebar-h1"><a href="#h1-underkanda-krav" aria-label="Huvudrubrik: Underkända krav">Underkända krav</a>';

        // Bygg huvudinnehåll
        let content_html = '<main class="html-export-content">';
        
        // H1: Underkända krav
        content_html += '<h1 id="h1-underkanda-krav">Underkända krav</h1>';
        content_html += '<p>Detta avsnitt redovisar en sammanställning av de krav som har underkänts vid granskningen. Sammanställningen baseras på stickprov, vilket innebär att motsvarande brister även kan förekomma på andra delar av den granskade sidan eller på andra delar av webbplatsen. Det är därför nödvändigt att genomföra en genomgång av hela webbplatsen för att säkerställa om samma typ av brister förekommer även på andra ställen. I detta avsnitt redovisas endast de brister som har identifierats vid granskningen.</p>';

        // För varje krav
        sidebar_html += '<ul role="list">';
        for (const req of sorted_requirements) {
            const referenceNumber = extract_reference_number(req);
            const h2_text = (referenceNumber ? referenceNumber + " " : "") + req.title;
            const h2_anchor_id = 'h2-' + generate_anchor_id(h2_text);

            // Lägg till H2 i sidebar (nested under H1)
            sidebar_html += `<li role="listitem" class="sidebar-h2"><a href="#${h2_anchor_id}" aria-label="Krav: ${escape_html_internal(h2_text)}">${escape_html_internal(h2_text)}</a>`;

            // H2: Kravets titel
            content_html += `<h2 id="${h2_anchor_id}">${escape_html_internal(h2_text)}</h2>`;

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
            content_html += create_html_metadata(req, current_audit, sorted_deficiency_ids, t);

            // H3 för varje stickprov (höjd från H4)
            const samples_with_deficiencies = get_samples_with_deficiencies_for_requirement(req, current_audit);
            for (const sample of samples_with_deficiencies) {
                const deficiencies = get_deficiencies_for_sample(req, sample, current_audit, t);
                const sampleName = sample.description || sample.url || "";
                const h3_anchor_id = 'h3-' + generate_anchor_id(h2_text + ' ' + sampleName);

                if (sample.url) {
                    const safe_url = escape_html_internal(window.Helpers?.add_protocol_if_missing ? window.Helpers.add_protocol_if_missing(sample.url) : sample.url);
                    content_html += `<h3 id="${h3_anchor_id}">Stickprov: <a href="${safe_url}" target="_blank" rel="noopener noreferrer">${escape_html_internal(sampleName)}</a></h3>`;
                } else {
                    content_html += `<h3 id="${h3_anchor_id}">Stickprov: ${escape_html_internal(sampleName)}</h3>`;
                }

                // Lägg till H3 i sidebar (nested under H2)
                sidebar_html += `<ul role="list"><li role="listitem" class="sidebar-h3"><a href="#${h3_anchor_id}" aria-label="Stickprov: ${escape_html_internal(sampleName)} för krav: ${escape_html_internal(h2_text)}">${escape_html_internal(sampleName)}</a></li></ul>`;

                // Observationer
                for (const deficiency of deficiencies) {
                    content_html += create_html_observations(deficiency, t);
                }

                // Kommentarer
                content_html += create_html_comments(req, sample, t);
            }
            // Stäng H2-li
            sidebar_html += '</li>';
        }
        // Stäng H1-ul och H1-li
        sidebar_html += '</ul></li></ul></nav>';
        content_html += '</main>';

        // CSS med variabler från appens style.css
        const css = `
            :root {
                --primary-color: #6E3282;
                --primary-color-dark: #4A2159;
                --link-color: #6E3282;
                --link-hover-color: #8A3F9E;
                --heading-color: #6E3282;
                --text-color: #1e2a2b;
                --text-color-muted: #4a5a5c;
                --background-color: #F0EAE3;
                --border-color: #B07CBF;
                --border-radius: 12px;
            }
            html {
                scroll-behavior: smooth;
            }
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 16px;
                line-height: 1.6;
                color: var(--text-color);
                background-color: var(--background-color);
            }
            .html-export-container {
                display: flex;
                min-height: 100vh;
                max-width: 1080px;
                margin: 0 auto;
                position: relative;
            }
            .html-export-sidebar {
                position: fixed;
                left: calc(50% - 540px);
                top: 0;
                width: 250px;
                height: 100vh;
                background-color: #ffffff;
                padding: 2rem 1rem;
                overflow-y: auto;
                z-index: 1;
            }
            .html-export-sidebar h2 {
                font-size: 1.25rem;
                color: var(--heading-color);
                margin-bottom: 1rem;
                font-weight: bold;
            }
            .html-export-sidebar ul {
                list-style: none;
            }
            .html-export-sidebar ul ul {
                margin-top: 0.125rem;
            }
            .html-export-sidebar li {
                margin-bottom: 0.25rem;
            }
            /* H1 styling - Ingen indrag, tydlig */
            .html-export-sidebar .sidebar-h1 > a {
                font-size: 1.1rem;
                font-weight: 600;
                padding-left: 0;
                color: var(--heading-color);
            }
            /* H2 styling - Måttlig indrag */
            .html-export-sidebar .sidebar-h2 > a {
                font-size: 1rem;
                font-weight: 500;
                color: var(--link-color);
                border-left: 2px solid var(--border-color);
                padding-left: 1.5rem;
            }
            /* H3 styling - Mer indrag, subtilare */
            .html-export-sidebar .sidebar-h3 > a {
                font-size: 0.95rem;
                font-weight: 400;
                color: var(--text-color-muted);
                border-left: 1px solid var(--border-color);
                padding-left: 2.5rem;
            }
            /* Gemensam styling för alla länkar */
            .html-export-sidebar a {
                text-decoration: underline;
                display: block;
                padding-top: 0.125rem;
                padding-bottom: 0.125rem;
                transition: all 0.2s;
                border-radius: 4px;
            }
            .html-export-sidebar a:hover {
                color: var(--link-hover-color);
                text-decoration: underline;
                background-color: rgba(110, 50, 130, 0.05);
            }
            /* Fokusindikator för tillgänglighet */
            .html-export-sidebar a:focus {
                outline: 3px solid var(--primary-color);
                outline-offset: 2px;
                background-color: rgba(110, 50, 130, 0.1);
            }
            .html-export-sidebar a:focus:not(:focus-visible) {
                outline: none;
            }
            .html-export-content {
                margin-left: 250px;
                flex: 1;
                padding: 2rem;
                background-color: #ffffff;
                min-height: 100vh;
                border-left: 2px solid var(--border-color);
                z-index: 1;
                position: relative;
                width: calc(100% - 250px);
                box-sizing: border-box;
            }
            .html-export-content h1 {
                font-size: 2rem;
                color: var(--heading-color);
                margin-top: 0;
                margin-bottom: 0.5rem;
                font-weight: bold;
            }
            .html-export-content h2 {
                font-size: 1.75rem;
                color: var(--heading-color);
                margin-top: 2rem;
                margin-bottom: 0.5rem;
                font-weight: bold;
                scroll-margin-top: 1rem;
            }
            .html-export-content h3 {
                font-size: 1.35rem;
                color: var(--heading-color);
                margin-top: 1.5rem;
                margin-bottom: 0.5rem;
                font-weight: bold;
                scroll-margin-top: 1rem;
            }
            /* Kompakt metadata */
            .metadata-compact {
                margin-bottom: 0.25rem !important;
            }
            /* Deficiency länkar */
            .deficiency-link {
                color: var(--link-color);
                text-decoration: underline;
            }
            .deficiency-link:hover {
                color: var(--link-hover-color);
            }
            .deficiency-id {
                font-weight: normal;
                display: inline;
            }
            .observation-text {
                display: inline;
            }
            .observation-content {
                display: block;
            }
            .html-export-content h4 {
                font-size: 1.25rem;
                color: var(--heading-color);
                margin-top: 1.25rem;
                margin-bottom: 0.5rem;
                font-weight: bold;
            }
            .html-export-content p {
                margin-bottom: 0.75rem;
            }
            .html-export-content a {
                color: var(--link-color);
                text-decoration: underline;
            }
            .html-export-content a:hover {
                color: var(--link-hover-color);
            }
            .html-export-content strong {
                font-weight: bold;
            }
            /* Markdown-innehåll styling */
            .observation-content,
            .comment-content {
                margin-bottom: 0.75rem;
            }
            .observation-content p,
            .comment-content p {
                margin-bottom: 0.5rem;
            }
            .observation-content p:last-child,
            .comment-content p:last-child {
                margin-bottom: 0;
            }
            .observation-content ul,
            .comment-content ul,
            .observation-content ol,
            .comment-content ol {
                margin-left: 1.5em;
                margin-bottom: 0.5rem;
            }
            .observation-content li,
            .comment-content li {
                margin-bottom: 0.25rem;
            }
            .observation-content code,
            .comment-content code {
                background-color: rgba(110, 50, 130, 0.1);
                padding: 0.125em 0.25em;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
                font-size: 0.9em;
            }
            .observation-content pre,
            .comment-content pre {
                background-color: rgba(110, 50, 130, 0.1);
                padding: 1em;
                border-radius: 4px;
                overflow-x: auto;
                margin-bottom: 0.5rem;
            }
            .observation-content pre code,
            .comment-content pre code {
                background-color: transparent;
                padding: 0;
            }
            .observation-content blockquote,
            .comment-content blockquote {
                border-left: 3px solid var(--border-color);
                padding-left: 1em;
                margin-left: 0;
                margin-bottom: 0.5rem;
                color: var(--text-color-muted);
            }
        `;

        // Bygg komplett HTML-dokument
        const html_document = `<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Granskningsrapport - ${escape_html_internal(current_audit.auditMetadata.actorName || t('filename_fallback_actor'))}${current_audit.auditMetadata.caseNumber ? ' - ' + escape_html_internal(current_audit.auditMetadata.caseNumber) : ''}</title>
    <style>${css}</style>
</head>
<body>
    <div class="html-export-container">
        ${sidebar_html}
        ${content_html}
    </div>
</body>
</html>`;

        // Skapa blob och ladda ner
        const blob = new Blob([html_document], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const actor_name = (current_audit.auditMetadata.actorName || t('filename_fallback_actor')).replace(/[^a-z0-9åäöÅÄÖ]/gi, '_');
        const case_number = (current_audit.auditMetadata.caseNumber || '').trim();
        const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
        const date_str = new Date().toISOString().split('T')[0];
        
        let filename;
        if (sanitized_case_number) {
            filename = `${sanitized_case_number}_${actor_name}_${date_str}_brister_lista.html`;
        } else {
            filename = `${actor_name}_${date_str}_brister_lista.html`;
        }

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');

    } catch (error) {
        console.error("Error exporting to HTML:", error);
        show_global_message_internal(t('error_exporting_html') + ` ${error.message}`, 'error');
    }
}

const public_api = {
    export_to_csv,
    export_to_excel,
    export_to_word,
    export_to_word_samples,
    export_to_html
};

window.ExportLogic = public_api;

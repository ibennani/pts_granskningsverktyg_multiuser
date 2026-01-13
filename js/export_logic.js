// js/export_logic.js

import ExcelJS from 'exceljs/dist/exceljs.min.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, UnderlineType, ExternalHyperlink, InternalHyperlink, ShadingType, TabStopType, SectionType, PageOrientation } from 'docx';

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

    const report_prefix = t('filename_audit_report_prefix');
    const deficiencies_suffix = t('filename_deficiencies_suffix');
    const actor_name = (current_audit.auditMetadata.actorName || t('filename_fallback_actor')).replace(/[^a-z0-9åäöÅÄÖ]/gi, '_');
    const case_number = (current_audit.auditMetadata.caseNumber || '').replace(/[^a-z0-9åäöÅÄÖ]/gi, '_');
    const case_number_prefix = case_number ? `${case_number}_` : '';
    const filename = `${case_number_prefix}${report_prefix}_${deficiencies_suffix}_${actor_name}_${new Date().toISOString().split('T')[0]}.csv`;

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
            { header: t('excel_col_observation'), key: 'observation', width: 70 }
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
                                observation: finalObservation
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

        const report_prefix = t('filename_audit_report_prefix');
        const deficiencies_suffix = t('filename_deficiencies_suffix');
        const actor_name = (current_audit.auditMetadata.actorName || t('filename_fallback_actor')).replace(/[^a-z0-9åäöÅÄÖ]/gi, '_');
        const case_number = (current_audit.auditMetadata.caseNumber || '').replace(/[^a-z0-9åäöÅÄÖ]/gi, '_');
        const case_number_prefix = case_number ? `${case_number}_` : '';
        const filename = `${case_number_prefix}${report_prefix}_${deficiencies_suffix}_${actor_name}_${new Date().toISOString().split('T')[0]}.xlsx`;

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

async function export_to_word(current_audit) {
    console.log('[Word Export] Starting export_to_word function');
    const t = get_t_internal();
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    console.log('[Word Export] current_audit found, proceeding...');
    try {
        const children = [];

        // Enkel sida med h1 och brödtext
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

        // Gå igenom alla krav med underkännanden - sortera enligt ref.text
        const requirements_with_deficiencies = get_requirements_with_deficiencies(current_audit);
        console.log('[Word Export] Found requirements with deficiencies:', requirements_with_deficiencies.length);

        // Sortera krav enligt ref.text med naturlig sortering
        const sorted_requirements = requirements_with_deficiencies.sort((a, b) => {
            const ref_a = a.standardReference?.text || '';
            const ref_b = b.standardReference?.text || '';
            return natural_sort(ref_a, ref_b);
        });

        for (let i = 0; i < sorted_requirements.length; i++) {
            const req = sorted_requirements[i];

            // H2 med bara kravets titel
            // H2 med nummer och titel
            // Extract number from reference text (start or end)
            let referenceNumber = "";
            if (req.standardReference?.text) {
                const refText = req.standardReference.text.trim();
                // Match patterns like "9.1.4.11" or "1.2.3". digits followed by dots at start or end.
                // Regex: Look for a sequence of digits and dots at the start or end of the string.
                // We want to capture the sequence.
                const startMatch = refText.match(/^([\d\.]+)/);
                const endMatch = refText.match(/([\d\.]+)$/);

                if (startMatch) {
                    referenceNumber = startMatch[1];
                } else if (endMatch) {
                    referenceNumber = endMatch[1];
                } else {
                    // Fallback: use full text if no number pattern found, or maybe nothing if user strictly wants numbers?
                    // "Använd enbart dessa nummer". If no number found, unlikely for WCAG but let's keep it safe or empty.
                    // User example implies mixed text. If no digits/dots, maybe keep full text as a fallback to not lose info,
                    // or assume there is always a number. Let's use full text if no match to be safe, or just the extracted part if match.
                    if (refText.match(/\d/)) {
                        // mixed content but didn't match start/end clean?
                        referenceNumber = refText;
                    }
                }
            }

            // Allow for trailing dot cleanup if necessary, e.g. "9.1." -> "9.1" ? usually standard refs don't have trailing dot unless end of sentence.
            if (referenceNumber.endsWith('.')) {
                referenceNumber = referenceNumber.slice(0, -1);
            }

            const h2_text = (referenceNumber ? referenceNumber + " " : "") + req.title;
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: h2_text
                        })
                    ],
                    heading: "Heading2",
                    pageBreakBefore: true // Sidbrytning före varje h2
                })
            );

            // Metadata rader (Referens, Principer, Brist)
            // Ingen punktlista, texten före kolon i fetstil
            const metadata_items = [];

            // Samla in alla unika brist-IDn för detta krav
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

            // Sortera IDn numeriskt
            const sorted_deficiency_ids = Array.from(all_deficiency_ids).sort((a, b) => {
                return parseInt(a, 10) - parseInt(b, 10);
            });

            // Referens
            if (req.standardReference?.text) {
                const ref_text = req.standardReference.text;
                const ref_url = req.standardReference.url;

                if (ref_url) {
                    // Länkad referens
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
                    // Bara text
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
                const classifications = Array.isArray(req.classifications) ? req.classifications : [];
                const taxonomy = current_audit?.ruleFileContent?.metadata?.taxonomies
                    ?.find(t => t.id === 'wcag22-pour');

                const norm = v => String(v ?? '').trim().toLowerCase();

                const principle_texts = taxonomy
                    ? classifications
                        .filter(c => norm(c.taxonomyId) === 'wcag22-pour')
                        .map(c => {
                            const concept = taxonomy.concepts?.find?.(x => norm(x?.id) === norm(c.conceptId));
                            return (typeof concept?.label === 'string' && concept.label.trim())
                                ? concept.label
                                : c.conceptId; // fallback om något ändå glappar
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
            if (sorted_deficiency_ids.length > 0) {
                metadata_items.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Brist: ", bold: true }),
                            new TextRun({ text: sorted_deficiency_ids.join(', ') })
                        ]
                    })
                );
            }

            // Lägg till metadata-raderna
            children.push(...metadata_items);

            // Lägg till h3 "Kravets syfte"
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Kravets syfte"
                        })
                    ],
                    heading: "Heading3"
                })
            );

            // Lägg till placeholder text för "Kravets syfte"
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Här kommer en ny text visas. Denna text är ännu inte klar."
                        })
                    ]
                })
            );

            // Lägg till h3 "Observation per stickprov"
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Observation per stickprov"
                        })
                    ],
                    heading: "Heading3"
                })
            );

            // Lägg till h4 för varje stickprov med underkännanden - wrappade i tabell med ram och bakgrund
            const samples_with_deficiencies = get_samples_with_deficiencies_for_requirement(req, current_audit);
            for (const sample of samples_with_deficiencies) {
                // Skapa innehåll för stickprovet
                const sampleContent = [];

                // Hämta brister för detta stickprov för att kunna lägga till ID i rubriken
                const deficiencies = get_deficiencies_for_sample(req, sample, current_audit, t);
                const useNumberedList = deficiencies.length > 1;

                // Extrahera unika brist-IDn för detta stickprov
                const deficiencyIds = [...new Set(deficiencies.map(d => extractDeficiencyNumber(d.deficiencyId)))].filter(Boolean).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

                // Bygg upp barn-noder för paragrafen
                const h4_children = [
                    new TextRun({
                        text: "Stickprov: ",
                        color: "000000"
                    })
                ];

                const sampleName = sample.description || sample.url || "";

                if (sample.url) {
                    // Om URL finns, gör namnet till en länk
                    h4_children.push(
                        new ExternalHyperlink({
                            children: [
                                new TextRun({
                                    text: sampleName,
                                    style: "Hyperlink"
                                })
                            ],
                            link: sample.url
                        })
                    );
                } else {
                    // Annars bara text
                    h4_children.push(
                        new TextRun({
                            text: sampleName,
                            color: "000000"
                        })
                    );
                }

                // Lägg till h4-rubrik för stickprovet
                sampleContent.push(
                    new Paragraph({
                        children: h4_children,
                        heading: "Heading4",
                        spacing: {
                            before: 200, // 10pt = 200 twips (1/20 pt)
                            after: 60    // 3pt = 60 twips
                        }
                    })
                );

                // (Tidigare kod för separat URL-rad är borttagen här)

                // Lägg till bristtext för detta stickprov

                for (let i = 0; i < deficiencies.length; i++) {
                    const deficiency = deficiencies[i];
                    // Removed numbered list prefix
                    // const numberPrefix = useNumberedList ? `${i + 1}. ` : '';
                    const numberPrefix = '';

                    // Trim trailing whitespace explicitly from the detail text
                    let observationText = (deficiency.observationDetail || '').trim();

                    // Convert dashes and asterisks at start of lines to bullets
                    // Regex: start of line, optional whitespace, dash or asterisk, whitespace
                    observationText = observationText.replace(/^[\s]*[-*]\s/gm, '• ');

                    const isStandardText = deficiency.isStandardText || false;
                    const defId = extractDeficiencyNumber(deficiency.deficiencyId);
                    const defIdString = defId ? `Brist ${defId}: ` : '';

                    // Om observationText innehåller \n, hantera radbrytningar
                    if (observationText.includes('\n')) {
                        const lines = observationText.split('\n');
                        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                            const isFirstLine = lineIndex === 0;
                            const isLastLine = lineIndex === lines.length - 1;

                            let textRuns = [];

                            // Clean up the line text (replace bullets if needed again per line if split didn't catch it?)
                            // The global replace above handles it, but splitting might separate the context.
                            // However, we process the whole block first.

                            let lineText = lines[lineIndex];

                            // Handle if splitting caused issue with regex? No, string split keeps content.

                            // Check if line starts with a bullet (indicating a list item)
                            // We converted dashes/stars to bullets earlier: '• '
                            const isBulletLine = lineText.trim().startsWith('•');

                            // Detect if we should use hanging indent and tab stop
                            const indentConfig = isBulletLine ? {
                                left: 227,    // Overall indent 0.4cm
                                hanging: 227  // First line outdent 0.4cm
                            } : {};

                            // Add tab stop for bullet alignment
                            const tabStopsConfig = isBulletLine ? [
                                {
                                    position: 227, // 0.4cm
                                    type: TabStopType.LEFT
                                }
                            ] : [];

                            // Prepare text: if bullet line, replace first space with tab
                            let runText = lineText;
                            if (isBulletLine) {
                                runText = runText.replace('• ', '•\t');
                            }

                            if (isFirstLine) {
                                // Första raden: nummer + eventuell prefix + text
                                // Lägg till Brist ID med fetstil om det finns
                                if (defIdString) {
                                    textRuns.push(new TextRun({ text: numberPrefix + defIdString, bold: true }));
                                    const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
                                    textRuns.push(new TextRun({ text: prefix + runText }));
                                } else {
                                    const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
                                    textRuns.push(new TextRun({ text: numberPrefix + prefix + runText }));
                                }
                            } else if (isLastLine) {
                                // Sista raden: text (utan bristindex)
                                textRuns = [
                                    new TextRun({ text: runText + ' ' })
                                ];
                            } else {
                                // Mellanrader: bara text
                                textRuns = [
                                    new TextRun({ text: runText })
                                ];
                            }

                            sampleContent.push(
                                new Paragraph({
                                    children: textRuns,
                                    // Spacing: 0 internal, 6pt (120 twips) after last line
                                    spacing: {
                                        after: isLastLine ? 120 : 0
                                    },
                                    indent: indentConfig,
                                    tabStops: tabStopsConfig
                                })
                            );
                        }
                    } else {
                        // Enkel text utan radbrytningar
                        let textRuns = [];
                        // Check if line starts with a bullet (indicating a list item)
                        const isBulletLine = observationText.trim().startsWith('•');

                        // Detect if we should use hanging indent
                        const indentConfig = isBulletLine ? {
                            left: 227,    // Overall indent 0.4cm
                            hanging: 227  // First line outdent 0.4cm
                        } : {};

                        // Add tab stop for bullet alignment
                        const tabStopsConfig = isBulletLine ? [
                            {
                                position: 227, // 0.4cm
                                type: TabStopType.LEFT
                            }
                        ] : [];

                        // Prepare text: if bullet line, replace first space with tab
                        let runText = observationText;
                        if (isBulletLine) {
                            runText = runText.replace('• ', '•\t');
                        }

                        if (defIdString) {
                            textRuns.push(new TextRun({ text: numberPrefix + defIdString, bold: true }));
                            const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
                            textRuns.push(new TextRun({ text: prefix + runText + ' ' }));
                        } else {
                            const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
                            textRuns.push(new TextRun({ text: numberPrefix + prefix + runText + ' ' }));
                        }

                        sampleContent.push(
                            new Paragraph({
                                children: textRuns,
                                // Spacing: 6pt (120 twips) after single line block
                                spacing: {
                                    after: 120
                                },
                                indent: indentConfig,
                                tabStops: tabStopsConfig
                            })
                        );
                    }
                }

                // Lägg till kommentar för detta krav och stickprov (om det finns någon)
                const comments = [];
                const req_key = req.key || req.id;
                const sample_result = (sample.requirementResults || {})[req_key];
                if (sample_result && sample_result.commentToActor && sample_result.commentToActor.trim()) {
                    comments.push(sample_result.commentToActor.trim());
                }

                if (comments.length > 0) {
                    // Lägg till mellanrum före kommentarerna
                    sampleContent.push(
                        new Paragraph({
                            children: [new TextRun({ text: "" })],
                            spacing: { before: 120 } // 6pt mellanrum
                        })
                    );

                    // Lägg till varje kommentar
                    comments.forEach(comment => {
                        sampleContent.push(
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: "Kommentar: ",
                                        bold: true,
                                        color: "6E3282"  // Samma lila färg som ramen
                                    }),
                                    new TextRun({
                                        text: comment
                                    })
                                ]
                            })
                        );
                    });
                }

                // Wrappa stickprovet i en tabell med ram och bakgrund - NEJ, kunden vill ha texten direkt på sidan
                // men behålla brist-ID vid texten (inte i punktlistan).
                // Vi tar bort tabellen men behåller innehållet.

                // Lägg till innehållet direkt
                children.push(...sampleContent);

                // Removed empty paragraph after sample content as per user request
                // children.push(new Paragraph({
                //     children: [new TextRun({ text: "" })],
                //     spacing: { after: 240 } // 12pt avstånd efter
                // }));
            }
        }

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
                            size: 22 // 11pt = 22 half-points
                        },
                        paragraph: {
                            spacing: {
                                after: 60, // 3pt = 60 half-points
                                line: 240, // enkelt radavstånd = 1.0 line height
                                lineRule: "auto"
                            }
                        }
                    },
                    heading1: {
                        run: {
                            font: "Calibri",
                            size: 36, // 18pt = 36 half-points
                            bold: true
                        },
                        paragraph: {
                            spacing: {
                                before: 200, // 10pt = 200 half-points
                                after: 60,   // 3pt = 60 half-points
                                line: 240,
                                lineRule: "auto"
                            }
                        }
                    },
                    heading2: {
                        run: {
                            font: "Calibri",
                            size: 32, // 16pt = 32 half-points
                            bold: true
                        },
                        paragraph: {
                            spacing: {
                                before: 200, // 10pt = 200 half-points
                                after: 60,   // 3pt = 60 half-points
                                line: 240,
                                lineRule: "auto"
                            }
                        }
                    },
                    heading3: {
                        run: {
                            font: "Calibri",
                            size: 28, // 14pt = 28 half-points
                            bold: true
                        },
                        paragraph: {
                            spacing: {
                                before: 200, // 10pt = 200 half-points
                                after: 60,   // 3pt = 60 half-points
                                line: 240,
                                lineRule: "auto"
                            }
                        }
                    },
                    heading4: {
                        run: {
                            font: "Calibri",
                            size: 24, // 12pt = 24 half-points
                            bold: true
                        },
                        paragraph: {
                            spacing: {
                                before: 200, // 10pt = 200 half-points
                                after: 60,   // 3pt = 60 half-points
                                line: 240,
                                lineRule: "auto"
                            }
                        }
                    }
                }
            }
        });

        const buffer = await Packer.toBlob(doc);
        const url = URL.createObjectURL(buffer);
        const link = document.createElement('a');

        const report_prefix = t('filename_audit_report_prefix');
        const actor_name = (current_audit.auditMetadata.actorName || t('filename_fallback_actor')).replace(/[^a-z0-9åäöÅÄÖ]/gi, '_');
        const case_number = (current_audit.auditMetadata.caseNumber || '').replace(/[^a-z0-9åäöÅÄÖ]/gi, '_');
        const case_number_prefix = case_number ? `${case_number}_` : '';
        const filename = `${case_number_prefix}${report_prefix}_${actor_name}_${new Date().toISOString().split('T')[0]}.docx`;

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




// --- START OF CHANGE: NEW EXPORT FUNCTION ---
async function export_to_word_samples(current_audit) {
    console.log('[Word Export] Starting export_to_word_samples function');
    const t = get_t_internal();
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    try {
        const children = [];

        // 1. Heading 1: Underkända krav
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Underkända krav",
                    })
                ],
                heading: "Heading1"
            })
        );

        // 2. Intro text
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Detta avsnitt redovisar en sammanställning av de krav som har underkänts vid granskningen. Sammanställningen baseras på stickprov, vilket innebär att motsvarande brister även kan förekomma på andra delar av den granskade sidan eller på andra delar av webbplatsen. Det är därför nödvändigt att genomföra en genomgång av hela webbplatsen för att säkerställa om samma typ av brister förekommer även på andra ställen. I detta avsnitt redovisas endast de brister som har identifierats vid granskningen."
                    })
                ]
            })
        );

        // 3. Filter samples with deficiencies and sort them (using original order or name?)
        // Let's use the order in the audit object which usually reflects user order.
        const all_samples = current_audit.samples || [];
        const samples_with_deficiencies = all_samples.filter(sample => {
            const defs = get_all_deficiencies_for_sample_generic(sample, current_audit);
            return defs.length > 0;
        });

        console.log('[Word Export TextExport] Found samples with deficiencies:', samples_with_deficiencies.length);

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

            // Get requirement definitions and sort them by reference
            const failing_reqs = [];
            const all_reqs = current_audit.ruleFileContent.requirements || {};

            failing_req_ids.forEach(req_id => {
                // Find requirement object regardless of structure (key vs id)
                let req = null;
                // Try direct lookup
                if (all_reqs[req_id]) req = all_reqs[req_id];
                else {
                    // Try finding by id or key property
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
                // H3 Requirement Title
                // Extract number/reference similar to existing export
                let referenceNumber = "";
                if (req.standardReference?.text) {
                    const refText = req.standardReference.text.trim();
                    const startMatch = refText.match(/^([\d\.]+)/);
                    const endMatch = refText.match(/([\d\.]+)$/);
                    if (startMatch) referenceNumber = startMatch[1];
                    else if (endMatch) referenceNumber = endMatch[1];
                    else if (refText.match(/\d/)) referenceNumber = refText;
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
                        heading: "Heading3",
                        spacing: { before: 360 } // 18pt (approx 18px depending on user intent, typically points in Word)
                    })
                );

                // Requirement Metadata (Reference, Principles, Deficiency IDs) customized for THIS sample
                const metadata_items = [];

                // Deficiency IDs for THIS sample + requirement
                const deficiencies = get_deficiencies_for_sample(req, sample, current_audit, t);
                const deficiencyIds = [...new Set(deficiencies.map(d => extractDeficiencyNumber(d.deficiencyId)))].filter(Boolean).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

                // Reference (Standard)
                if (req.standardReference?.text) {
                    const ref_text = req.standardReference.text;
                    const ref_url = req.standardReference.url;
                    if (ref_url) {
                        metadata_items.push(new Paragraph({
                            children: [
                                new TextRun({ text: "Referens: ", bold: true }),
                                new ExternalHyperlink({
                                    children: [new TextRun({ text: ref_text, style: "Hyperlink" })],
                                    link: ref_url
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

                // Principles
                {
                    const classifications = Array.isArray(req.classifications) ? req.classifications : [];
                    const taxonomy = current_audit?.ruleFileContent?.metadata?.taxonomies?.find(t => t.id === 'wcag22-pour');
                    const norm = v => String(v ?? '').trim().toLowerCase();
                    const principle_texts = taxonomy
                        ? classifications
                            .filter(c => norm(c.taxonomyId) === 'wcag22-pour')
                            .map(c => {
                                const concept = taxonomy.concepts?.find?.(x => norm(x?.id) === norm(c.conceptId));
                                return (typeof concept?.label === 'string' && concept.label.trim()) ? concept.label : c.conceptId;
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

                // Brist IDs associated with THIS sample
                if (deficiencyIds.length > 0) {
                    metadata_items.push(new Paragraph({
                        children: [
                            new TextRun({ text: "Brist: ", bold: true }),
                            new TextRun({ text: deficiencyIds.join(', ') })
                        ]
                    }));
                }

                children.push(...metadata_items);

                // Disclaimer / Placeholder text (No "Kravets syfte" header)
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Om detta krav: ",
                                bold: true
                            }),
                            new TextRun({
                                text: "Här kommer en ny text visas. Denna text är ännu inte klar."
                            })
                        ]
                    })
                );


                // H4 "Aktuella observationer"
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Aktuella observationer"
                            })
                        ],
                        heading: "Heading4",
                        spacing: { before: 200 } // Ensure 10pt before
                    })
                );

                // Add deficiency texts for this sample
                for (let i = 0; i < deficiencies.length; i++) {
                    const deficiency = deficiencies[i];
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
                            // 227 twips ~ 0.4cm. Hanging indent for bullet
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

                            children.push(new Paragraph({
                                children: textRuns,
                                spacing: { after: isLastLine ? 120 : 0 }, // 6pt after (requested 6px, using 120 twips which is ~6pt)
                                indent: indentConfig,
                                tabStops: tabStopsConfig
                            }));
                        }
                    } else {
                        // Single line
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
                            spacing: { after: 120 }, // 6pt after
                            indent: indentConfig,
                            tabStops: tabStopsConfig
                        }));
                    }
                }

                // Comment to actor (reused logic)
                const req_key = req.key || req.id;
                const sample_result = (sample.requirementResults || {})[req_key];
                if (sample_result && sample_result.commentToActor && sample_result.commentToActor.trim()) {
                    children.push(new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 60 } }));
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: "Kommentar: ", bold: true, color: "6E3282" }),
                            new TextRun({ text: sample_result.commentToActor.trim() })
                        ],
                        spacing: { after: 60 }
                    }));
                }
            }
        }

        const doc = new Document({
            sections: [{
                properties: {
                    type: SectionType.NEXT_PAGE,
                    page: {
                        size: {
                            orientation: PageOrientation.PORTRAIT,
                            width: 11906, // A4 width in twips (210mm)
                            height: 16838 // A4 height in twips (297mm)
                        },
                        margin: {
                            top: 1440, // 2.54 cm
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
                            size: 22 // 11pt
                        },
                        paragraph: {
                            alignment: AlignmentType.LEFT,
                            spacing: {
                                after: 60, // 3pt
                                line: 240, // Standard line spacing usually implies 240 (1.0) or 276 (1.15) depending on Word version. User said "Standard".
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
                                after: 60,   // Standard 3pt or overridden? User said: "Efteravstånd följer i standardlogik om inget annat sätts" -> 3pt (60 twips)
                            },
                            outlineLevel: 0
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
                                after: 60
                            },
                            outlineLevel: 1
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
                                after: 60
                            },
                            outlineLevel: 2
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
                                after: 60
                            },
                            outlineLevel: 3
                        }
                    }
                }
            }
        });

        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const report_prefix = t('filename_audit_report_prefix');
        const deficiencies_suffix = t('filename_deficiencies_suffix');
        const actor_name = (current_audit.auditMetadata.actorName || t('filename_fallback_actor')).replace(/[^a-z0-9åäöÅÄÖ]/gi, '_');
        const filename = `${report_prefix}_${deficiencies_suffix}_${actor_name}_textexport_${new Date().toISOString().split('T')[0]}.docx`;

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');

    } catch (error) {
        console.error("Error exporting to Word (Text Export):", error);
        show_global_message_internal(t('error_exporting_word') + ` ${error.message}`, 'error');
    }
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

const public_api = {
    export_to_csv,
    export_to_excel,
    export_to_word,
    export_to_word_samples // Add the new export function to the export object
};

window.ExportLogic = public_api;

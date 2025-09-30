// js/export_logic.js

import ExcelJS from 'exceljs/dist/exceljs.min.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, UnderlineType, ExternalHyperlink, InternalHyperlink, ShadingType } from 'docx';

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
        t('excel_col_control'),
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
                        
                        const pc_def = req_definition.checks?.find(c=>c.id===check_id)?.passCriteria?.find(p=>p.id===pc_id);
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
                            escape_for_csv(controlText),
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
    const actor_name = (current_audit.auditMetadata.actorName || t('filename_fallback_actor')).replace(/[^a-z0-9]/gi, '_');
    const filename = `${report_prefix}_${deficiencies_suffix}_${actor_name}_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    show_global_message_internal(t('audit_saved_as_file', {filename: filename}), 'success');
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

        general_info_data.push([t('deficiency_index_title', {defaultValue: "Deficiency Index"}), `${display_deficiency_index} / 100`]);
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
            { header: t('excel_col_control'), key: 'control', width: 60 },
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
                            const pc_def = req_definition.checks?.find(c=>c.id===check_id)?.passCriteria?.find(p=>p.id===pc_id);
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
                                control: get_pass_criterion_text(req_definition, check_id, pc_id),
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
        headerRow.fill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FF6E3282'} };
        headerRow.alignment = { vertical: 'top', wrapText: true };

        deficienciesSheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
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
        deficienciesSheet.views = [ { state: 'frozen', ySplit: 1 } ];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const report_prefix = t('filename_audit_report_prefix');
        const deficiencies_suffix = t('filename_deficiencies_suffix');
        const actor_name = (current_audit.auditMetadata.actorName || t('filename_fallback_actor')).replace(/[^a-z0-9]/gi, '_');
        const filename = `${report_prefix}_${deficiencies_suffix}_${actor_name}_${new Date().toISOString().split('T')[0]}.xlsx`;

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        show_global_message_internal(t('audit_saved_as_file', {filename: filename}), 'success');

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
                        text: "Det här avsnittet visar en sammanställning av de krav som har underkänts vid granskningen."
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
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: req.title
                        })
                    ],
                    heading: "Heading2",
                    pageBreakBefore: i > 0 // Sidbrytning före varje h2 från och med den andra
                })
            );

            // Punkslista med referens och principer
            const bullet_items = [];
            
            // Referens
            if (req.standardReference?.text) {
                const ref_text = req.standardReference.text;
                const ref_url = req.standardReference.url;
                
                if (ref_url) {
                    // Länkad referens
                    bullet_items.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: "• " }),
                                new TextRun({ text: "Referens: ", bold: true }),
                                new ExternalHyperlink({
                                    children: [new TextRun({ text: ref_text, style: "Hyperlink" })],
                                    link: ref_url
                                })
                            ],
                            indent: {
                                left: 283, // 0.5 cm = 283 twips
                                hanging: 142  // 0.25 cm = 142 twips
                            }
                        })
                    );
                } else {
                    // Bara text
                    bullet_items.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: "• " }),
                                new TextRun({ text: "Referens: ", bold: true }),
                                new TextRun({ text: ref_text })
                            ],
                            indent: {
                                left: 283, // 0.5 cm = 283 twips
                                hanging: 142  // 0.25 cm = 142 twips
                            }
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
                    bullet_items.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: "• " }),
                                new TextRun({ text: "Principer: ", bold: true }),
                                new TextRun({ text: principle_texts.join(', ') })
                            ],
                            indent: {
                                left: 283,
                                hanging: 142
                            }
                        })
                    );
                }
            }

            
            // Lägg till punkslistan
            children.push(...bullet_items);

            // Lägg till h3 "Förväntad observation"
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Förväntad observation"
                        })
                    ],
                    heading: "Heading3"
                })
            );

            // Lägg till kravets text med markdown-konvertering
            if (req.expectedObservation) {
                const markdown_paragraphs = convert_markdown_to_word_paragraphs(req.expectedObservation);
                children.push(...markdown_paragraphs);
            }

            // Lägg till h3 "Faktisk observation"
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Faktisk observation"
                        })
                    ],
                    heading: "Heading3"
                })
            );

            // Lägg till introduktionstext
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Vi har sett brister kopplade till det här kravet i följande stickprov. Här redovisar vi endast de brister vi har observerat. Gå därför igenom alla stickprov och kontrollera om samma typ av brister finns på fler ställen."
                        })
                    ]
                })
            );

            // Lägg till h4 för varje stickprov med underkännanden - wrappade i tabell med ram och bakgrund
            const samples_with_deficiencies = get_samples_with_deficiencies_for_requirement(req, current_audit);
            for (const sample of samples_with_deficiencies) {
                // Skapa innehåll för stickprovet
                const sampleContent = [];
                
                // Lägg till h4-rubrik för stickprovet
                sampleContent.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: sample.description || sample.url || "Stickprov",
                                color: "6E3282"  // Samma lila färg som ramen
                            })
                        ],
                        heading: "Heading4",
                        spacing: {
                            before: 0,  // 0px padding ovanför h4-rubriken för stickprov
                            after: 120  // 6pt mellanrum efter rubriken
                        }
                    })
                );

                // Lägg till bristtext för detta stickprov
                const deficiencies = get_deficiencies_for_sample(req, sample, current_audit, t);
                const useNumberedList = deficiencies.length > 1;
                
                for (let i = 0; i < deficiencies.length; i++) {
                    const deficiency = deficiencies[i];
                    const numberPrefix = useNumberedList ? `${i + 1}. ` : '';
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
                                    new TextRun({ text: numberPrefix + prefix + lines[lineIndex] })
                                ];
                            } else if (isLastLine) {
                                // Sista raden: text + bristindex i kursiv
                                textRuns = [
                                    new TextRun({ text: '   ' + lines[lineIndex] + ' ' }),
                                    new TextRun({ text: `(${formatDeficiencyForWord(deficiency.deficiencyId)})`, italics: true })
                                ];
                            } else {
                                // Mellanrader: bara text
                                textRuns = [
                                    new TextRun({ text: '   ' + lines[lineIndex] })
                                ];
                            }
                            
                            // Om det bara finns en rad, lägg till bristindex på samma rad
                            if (lines.length === 1) {
                                textRuns.push(new TextRun({ text: ' ' }));
                                textRuns.push(new TextRun({ text: `(${formatDeficiencyForWord(deficiency.deficiencyId)})`, italics: true }));
                            }
                            
                            sampleContent.push(
                                new Paragraph({
                                    children: textRuns,
                                    indent: useNumberedList ? {
                                        left: 283, // 0.5 cm = 283 twips
                                        hanging: isFirstLine ? 142 : 0  // Hanging indent bara för första raden
                                    } : {}
                                })
                            );
                        }
                    } else {
                        // Enkel text utan radbrytningar
                        const prefix = isStandardText ? "Kravet är inte uppfyllt: " : "";
                        sampleContent.push(
                            new Paragraph({
                                children: [
                                    new TextRun({ text: numberPrefix + prefix + observationText + ' ' }),
                                    new TextRun({ text: `(${formatDeficiencyForWord(deficiency.deficiencyId)})`, italics: true })
                                ],
                                indent: useNumberedList ? {
                                    left: 283, // 0.5 cm = 283 twips
                                    hanging: 142  // 0.25 cm = 142 twips
                                } : {}
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
                
                // Wrappa stickprovet i en tabell med ram och bakgrund
                const sampleTable = new Table({
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: sampleContent,
                                    width: { size: 100, type: WidthType.PERCENTAGE },
                                    shading: {
                                        type: ShadingType.SOLID,
                                        color: "F4F1EE", // Varm beige bakgrund
                                        fill: "F4F1EE"
                                    },
                                    margins: {
                                        top: 240,    // 12pt
                                        bottom: 240, // 12pt  
                                        left: 240,   // 12pt
                                        right: 240   // 12pt
                                    }
                                })
                            ],
                            // Förhindra att raden bryts över sidor
                            cantSplit: true
                        })
                    ],
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 12, color: "6E3282" },    // Lila ram
                        bottom: { style: BorderStyle.SINGLE, size: 12, color: "6E3282" }, // Lila ram
                        left: { style: BorderStyle.SINGLE, size: 12, color: "6E3282" },   // Lila ram
                        right: { style: BorderStyle.SINGLE, size: 12, color: "6E3282" },  // Lila ram
                        insideHorizontal: { style: BorderStyle.NONE },
                        insideVertical: { style: BorderStyle.NONE }
                    },
                    // Förhindra att tabellen bryts över sidor
                    cantSplit: true
                });
                
                children.push(sampleTable);
                
                // Lägg till lite utrymme efter tabellen
                children.push(new Paragraph({
                    children: [new TextRun({ text: "" })],
                    spacing: { after: 240 } // 12pt avstånd efter
                }));
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
        const actor_name = (current_audit.auditMetadata.actorName || t('filename_fallback_actor')).replace(/[^a-z0-9]/gi, '_');
        const filename = `${report_prefix}_${actor_name}_${new Date().toISOString().split('T')[0]}.docx`;

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        show_global_message_internal(t('audit_saved_as_file', {filename: filename}), 'success');

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


const public_api = {
    export_to_csv,
    export_to_excel,
    export_to_word
};

window.ExportLogic = public_api;

/**
 * @fileoverview Bygger docx-paragrafer för Word-huvudexport (intro + krav- respektive stickprovssortering).
 */
import { Paragraph, TextRun, ExternalHyperlink } from 'docx';
import { consoleManager } from '../utils/console_manager.js';
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

export type ExportWordMainFlowT = (key: string, opts?: Record<string, unknown>) => string;

/** H1 och intro (gemensamt för båda sorteringslägena). */
export function append_word_export_intro_paragraphs (
    children: unknown[],
    _t: ExportWordMainFlowT
): void {
    const c = children as Array<InstanceType<typeof Paragraph>>;
    c.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Redovisning av granskningsresultatet'
                })
            ],
            heading: 'Heading1'
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Det här avsnittet redovisar samtliga brister som har identifierats vid granskningen. För varje krav anges i vilka stickprov PTS har observerat brister.'
                })
            ]
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Bristerna kan även förekomma i andra delar av e-handeln än de stickprov som har granskats. Verksamheten behöver därför gå igenom e-handeln i sin helhet för att identifiera om motsvarande brister finns även utanför stickproven.'
                })
            ]
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Redovisningen omfattar endast de brister som har iakttagits inom ramen för den genomförda granskningen.'
                })
            ]
        })
    );
}

/** Innehåll när exporten sorteras på krav först. */
export function append_word_export_body_sorted_by_requirements (
    children: unknown[],
    current_audit: any,
    t: ExportWordMainFlowT
): void {
    const c = children as Array<InstanceType<typeof Paragraph>>;
    const requirements_with_deficiencies = get_requirements_with_deficiencies(current_audit);
    consoleManager.log('[Word Export] Found requirements with deficiencies:', requirements_with_deficiencies.length);

    const sorted_requirements = requirements_with_deficiencies.sort((a, b) => {
        const ref_a = a.standardReference?.text || '';
        const ref_b = b.standardReference?.text || '';
        return natural_sort(ref_a, ref_b);
    });

    for (const req of sorted_requirements) {
        const referenceNumber = extract_reference_number(req);
        const h2_text = (referenceNumber ? referenceNumber + ' ' : '') + req.title;
        c.push(
            new Paragraph({
                children: [new TextRun({ text: h2_text })],
                heading: 'Heading2',
                pageBreakBefore: true
            })
        );

        const all_deficiency_ids = new Set<string>();
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
        const sorted_deficiency_ids = Array.from(all_deficiency_ids).sort(
            (a, b) => parseInt(String(a), 10) - parseInt(String(b), 10)
        );
        c.push(...create_metadata_paragraphs(req, current_audit, sorted_deficiency_ids, t));

        const samples_with_deficiencies = get_samples_with_deficiencies_for_requirement(req, current_audit);
        for (const sample of samples_with_deficiencies) {
            const deficiencies = get_deficiencies_for_sample(req, sample, current_audit, t);
            const sampleName = sample.description || sample.url || '';

            const h3_children: Array<TextRun | InstanceType<typeof ExternalHyperlink>> = [
                new TextRun({ text: 'Stickprov: ', color: '000000' })
            ];
            if (sample.url) {
                h3_children.push(
                    new ExternalHyperlink({
                        children: [new TextRun({ text: sampleName, style: 'Hyperlink' })],
                        link: sample.url
                    })
                );
            } else {
                h3_children.push(new TextRun({ text: sampleName, color: '000000' }));
            }

            c.push(
                new Paragraph({
                    children: h3_children,
                    heading: 'Heading3',
                    spacing: { before: 200, after: 60 }
                })
            );

            for (const deficiency of deficiencies) {
                c.push(...create_observation_paragraphs(deficiency, t));
            }

            c.push(...create_comment_paragraphs(req, sample, current_audit.ruleFileContent.requirements, t));
        }
    }
}

/** Innehåll när exporten sorteras på stickprov först. */
export function append_word_export_body_sorted_by_samples (
    children: unknown[],
    current_audit: any,
    t: ExportWordMainFlowT
): void {
    const c = children as Array<InstanceType<typeof Paragraph>>;
    const all_samples = current_audit.samples || [];
    const samples_with_deficiencies = all_samples.filter((sample: any) => {
        const defs = get_all_deficiencies_for_sample_generic(sample, current_audit);
        return defs.length > 0;
    });

    consoleManager.log('[Word Export] Found samples with deficiencies:', samples_with_deficiencies.length);

    for (const sample of samples_with_deficiencies) {
        c.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: sample.description || sample.url || t('export_unspecified_sample')
                    })
                ],
                heading: 'Heading2',
                pageBreakBefore: true
            })
        );

        const failing_req_ids = get_failing_requirement_ids_for_sample(sample);
        const failing_reqs: any[] = [];
        const all_reqs = current_audit.ruleFileContent.requirements || {};

        failing_req_ids.forEach((req_id) => {
            let req = null;
            if (all_reqs[req_id]) req = all_reqs[req_id];
            else {
                req = Object.values(all_reqs).find((r: any) => r.id === req_id || r.key === req_id);
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
            const h3_text = (referenceNumber ? referenceNumber + ' ' : '') + req.title;

            c.push(
                new Paragraph({
                    children: [new TextRun({ text: h3_text })],
                    heading: 'Heading3',
                    spacing: { before: 360 }
                })
            );

            const deficiencies = get_deficiencies_for_sample(req, sample, current_audit, t);
            const deficiencyIds = [...new Set(deficiencies.map((d) => extractDeficiencyNumber(d.deficiencyId)))]
                .filter(Boolean)
                .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
            c.push(...create_metadata_paragraphs(req, current_audit, deficiencyIds, t));

            c.push(
                new Paragraph({
                    children: [new TextRun({ text: 'Aktuella observationer' })],
                    heading: 'Heading4',
                    spacing: { before: 200 }
                })
            );

            for (const deficiency of deficiencies) {
                c.push(...create_observation_paragraphs(deficiency, t));
            }

            c.push(...create_comment_paragraphs(req, sample, current_audit.ruleFileContent.requirements, t));
        }
    }
}

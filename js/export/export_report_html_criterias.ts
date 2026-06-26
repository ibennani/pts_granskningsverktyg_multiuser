/**
 * @fileoverview Bygger semantisk HTML för PDF-export sorterad på krav (samma urval som Word).
 */
import { consoleManager } from '../utils/console_manager.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';
import {
    get_requirements_with_deficiencies,
    natural_sort,
    get_samples_with_deficiencies_for_requirement,
    get_deficiencies_for_sample,
    get_all_deficiencies_for_sample_generic,
    get_failing_requirement_ids_for_sample,
} from './export_word_deficiency_queries.js';
import { extract_reference_number } from './export_word_requirement_sections.js';
import { get_export_requirement_result } from './export_bootstrap.js';
import {
    escape_html_internal,
    render_markdown_to_html,
} from './export_html_build_primitives.js';
import { build_report_pdf_print_css } from './export_report_typography.js';
import * as Helpers from '../utils/helpers.js';

export type ExportReportHtmlT = (key: string, opts?: Record<string, unknown>) => string;

function build_principle_texts(requirement: Record<string, unknown>, current_audit: Record<string, unknown>): string[] {
    const classifications = Array.isArray(requirement.classifications) ? requirement.classifications : [];
    const meta = current_audit?.ruleFileContent as Record<string, unknown> | undefined;
    const metadata = meta?.metadata as Record<string, unknown> | undefined;
    const taxonomies = metadata?.taxonomies as Array<{
        id?: string;
        concepts?: Array<{ id?: string; label?: string }>;
    }> | undefined;
    const taxonomy = taxonomies?.find((x) => x.id === 'wcag22-pour');
    const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
    if (!taxonomy) return [];
    return (classifications as Array<{ taxonomyId?: string; conceptId?: string }>)
        .filter((c) => norm(c.taxonomyId) === 'wcag22-pour')
        .map((c) => {
            const concept = taxonomy.concepts?.find?.((x) => norm(x?.id) === norm(c.conceptId));
            return typeof concept?.label === 'string' && concept.label.trim() ? concept.label : c.conceptId;
        })
        .filter(Boolean) as string[];
}

function build_metadata_html(
    requirement: Record<string, unknown>,
    current_audit: Record<string, unknown>,
    deficiency_ids: string[]
): string {
    let html = '';
    const std_ref = requirement.standardReference as { text?: string; url?: string } | undefined;
    if (std_ref?.text) {
        const ref_text = escape_html_internal(std_ref.text);
        const ref_url = std_ref.url;
        if (ref_url) {
            const safe_url = escape_html_internal(
                Helpers?.add_protocol_if_missing ? Helpers.add_protocol_if_missing(ref_url) : ref_url
            );
            html += `<p><strong>Referens: </strong><a href="${safe_url}">${ref_text}</a></p>`;
        } else {
            html += `<p><strong>Referens: </strong>${ref_text}</p>`;
        }
    }
    const principles = build_principle_texts(requirement, current_audit);
    if (principles.length > 0) {
        html += `<p><strong>Principer: </strong>${escape_html_internal(principles.join(', '))}</p>`;
    }
    if (deficiency_ids.length > 0) {
        html += `<p><strong>Identifierade brister: </strong>${escape_html_internal(deficiency_ids.join(', '))}</p>`;
    }
    return html;
}

function build_observation_html(deficiency: Record<string, unknown>): string {
    let observation_text = String(deficiency.observationDetail || '').trim();
    observation_text = observation_text.replace(/^[\s]*[-*]\s/gm, '• ');
    const is_standard = Boolean(deficiency.isStandardText);
    const def_id = extractDeficiencyNumber(deficiency.deficiencyId as string);
    const def_prefix = def_id ? `<strong>Brist-id: ${escape_html_internal(def_id)} </strong>` : '';
    const text_prefix = is_standard ? 'Kravet är inte uppfyllt: ' : '';
    const lines = observation_text.includes('\n') ? observation_text.split('\n') : [observation_text];
    return lines
        .map((line, index) => {
            const prefix = index === 0 ? def_prefix : '';
            const standard_prefix = index === 0 && text_prefix ? escape_html_internal(text_prefix) : '';
            const body = render_markdown_to_html(line);
            return `<p>${prefix}${standard_prefix}${body}</p>`;
        })
        .join('');
}

function build_sample_heading_html(
    sample: Record<string, unknown>,
    t: ExportReportHtmlT,
    heading_level: 2 | 3 = 3
): string {
    const tag = heading_level === 2 ? 'h2' : 'h3';
    const raw_name = String(sample.description || sample.url || '').trim();
    const sample_name = escape_html_internal(raw_name || t('export_unspecified_sample'));
    if (sample.url) {
        const safe_url = escape_html_internal(
            Helpers?.add_protocol_if_missing ? Helpers.add_protocol_if_missing(String(sample.url)) : String(sample.url)
        );
        return `<${tag}>Granskningsdel: <a href="${safe_url}">${sample_name}</a></${tag}>`;
    }
    return `<${tag}>Granskningsdel: ${sample_name}</${tag}>`;
}

function build_comment_html(
    requirement: Record<string, unknown>,
    sample: Record<string, unknown>,
    requirements_map: Record<string, unknown>,
    _t: ExportReportHtmlT
): string {
    const sample_result = get_export_requirement_result(requirements_map, sample, requirement);
    const comment = sample_result?.commentToActor?.trim();
    if (!comment) return '';
    return `<p class="comment-block"><span class="comment-label">Kommentar: </span>${render_markdown_to_html(comment)}</p>`;
}

export function build_report_body_sorted_by_requirements(
    current_audit: Record<string, unknown>,
    t: ExportReportHtmlT
): string {
    const requirements_map = (current_audit.ruleFileContent as Record<string, unknown>)?.requirements as
        | Record<string, unknown>
        | undefined ?? {};
    const requirements_with_deficiencies = get_requirements_with_deficiencies(current_audit);
    consoleManager.log('[PDF Export] Found requirements with deficiencies:', requirements_with_deficiencies.length);

    const sorted = requirements_with_deficiencies.sort((a, b) => {
        const ref_a = (a.standardReference as { text?: string } | undefined)?.text || '';
        const ref_b = (b.standardReference as { text?: string } | undefined)?.text || '';
        return natural_sort(ref_a, ref_b);
    });

    let html = '';
    for (const req of sorted) {
        const reference_number = extract_reference_number(req);
        const h2_text = escape_html_internal((reference_number ? `${reference_number} ` : '') + req.title);
        html += `<h2>${h2_text}</h2>`;

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
        const sorted_def_ids = Array.from(all_deficiency_ids).sort(
            (a, b) => parseInt(String(a), 10) - parseInt(String(b), 10)
        );
        html += build_metadata_html(req, current_audit, sorted_def_ids);

        const samples_with_deficiencies = get_samples_with_deficiencies_for_requirement(req, current_audit);
        for (const sample of samples_with_deficiencies) {
            const deficiencies = get_deficiencies_for_sample(req, sample, current_audit, t);
            html += build_sample_heading_html(sample, t);

            for (const deficiency of deficiencies) {
                html += build_observation_html(deficiency);
            }
            html += build_comment_html(req, sample, requirements_map, t);
        }
    }
    return html;
}

export function build_report_body_sorted_by_samples(
    current_audit: Record<string, unknown>,
    t: ExportReportHtmlT
): string {
    const requirements_map = (current_audit.ruleFileContent as Record<string, unknown>)?.requirements as
        | Record<string, unknown>
        | undefined ?? {};
    const all_samples = (current_audit.samples as unknown[]) || [];
    const samples_with_deficiencies = all_samples.filter((sample) => {
        const defs = get_all_deficiencies_for_sample_generic(sample, current_audit);
        return defs.length > 0;
    });

    consoleManager.log('[PDF Export] Found samples with deficiencies:', samples_with_deficiencies.length);

    let html = '';
    for (const sample of samples_with_deficiencies) {
        const s = sample as Record<string, unknown>;
        html += build_sample_heading_html(s, t, 2);

        const failing_req_ids = get_failing_requirement_ids_for_sample(s);
        const failing_reqs: Record<string, unknown>[] = [];
        failing_req_ids.forEach((req_id) => {
            let req: Record<string, unknown> | null = null;
            if (requirements_map[req_id]) {
                req = requirements_map[req_id] as Record<string, unknown>;
            } else {
                req = (Object.values(requirements_map).find(
                    (r) => (r as Record<string, unknown>).id === req_id || (r as Record<string, unknown>).key === req_id
                ) as Record<string, unknown> | undefined) ?? null;
            }
            if (req) failing_reqs.push(req);
        });

        const sorted_reqs = failing_reqs.sort((a, b) => {
            const ref_a = (a.standardReference as { text?: string } | undefined)?.text || '';
            const ref_b = (b.standardReference as { text?: string } | undefined)?.text || '';
            return natural_sort(ref_a, ref_b);
        });

        for (const req of sorted_reqs) {
            const reference_number = extract_reference_number(req);
            const h3_text = escape_html_internal((reference_number ? `${reference_number} ` : '') + req.title);
            html += `<h3>${h3_text}</h3>`;

            const deficiencies = get_deficiencies_for_sample(req, s, current_audit, t);
            const deficiency_ids = [
                ...new Set(
                    deficiencies
                        .map((def) => extractDeficiencyNumber(def.deficiencyId as string))
                        .filter(Boolean)
                ),
            ].sort((a, b) => parseInt(String(a), 10) - parseInt(String(b), 10));
            html += build_metadata_html(req, current_audit, deficiency_ids);

            for (const deficiency of deficiencies) {
                html += build_observation_html(deficiency);
            }
            html += build_comment_html(req, s, requirements_map, t);
        }
    }
    return html;
}

export function build_report_pdf_intro_html(): string {
    return (
        '<h1>Redovisning av granskningsresultatet</h1>' +
        '<p>Det här avsnittet redovisar samtliga brister som har identifierats vid granskningen. För varje krav anges i vilka granskningsdel PTS har observerat brister.</p>' +
        '<p>Bristerna kan även förekomma i andra delar av e-handeln än de granskningsdel som har granskats. Verksamheten behöver därför gå igenom e-handeln i sin helhet för att identifiera om motsvarande brister finns även utanför granskningsdelarna.</p>' +
        '<p>Redovisningen omfattar endast de brister som har iakttagits inom ramen för den genomförda granskningen.</p>'
    );
}

export function build_report_pdf_html_document(options: {
    title: string;
    lang?: string;
    body_html: string;
}): string {
    const lang = escape_html_internal(options.lang || 'sv');
    const title = escape_html_internal(options.title);
    return (
        `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">` +
        `<title>${title}</title><style>${build_report_pdf_print_css()}</style></head>` +
        `<body><main>${options.body_html}</main></body></html>`
    );
}

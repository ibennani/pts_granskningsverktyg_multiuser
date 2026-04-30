/**
 * @fileoverview HTML-export: sidebar/innehåll och textextraktion.
 */

import * as Helpers from '../utils/helpers.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';
import {
    escape_html_internal,
    generate_anchor_id,
    create_html_metadata,
    create_html_observations,
    create_html_comments
} from './export_html_build_primitives.js';
import {
    natural_sort,
    get_requirements_with_deficiencies,
    get_samples_with_deficiencies_for_requirement,
    get_deficiencies_for_sample,
    get_all_deficiencies_for_sample_generic
} from './export_word_deficiency_queries.js';
import { extract_reference_number } from './export_word_requirement_sections.js';

export function get_samples_with_deficiencies(current_audit: Record<string, unknown>): unknown[] {
    const samples = (current_audit.samples as unknown[]) || [];
    return samples.filter((sample) => get_all_deficiencies_for_sample_generic(sample, current_audit).length > 0);
}

export function get_requirements_with_deficiencies_for_sample(
    sample: Record<string, unknown>,
    current_audit: Record<string, unknown>
): unknown[] {
    const requirements_obj = (current_audit.ruleFileContent as Record<string, unknown> | undefined)?.requirements as
        | Record<string, unknown>
        | undefined;
    const requirements = Object.values(requirements_obj || {});
    return requirements.filter(
        (req) => get_deficiencies_for_sample(req, sample, current_audit, () => undefined).length > 0
    );
}

export function build_content_sorted_by_requirement(
    current_audit: Record<string, unknown>,
    t: (key: string, opts?: Record<string, unknown>) => string
): { sidebar_html: string; content_html: string } {
    const requirements_with_deficiencies = get_requirements_with_deficiencies(current_audit);
    const sorted_requirements = requirements_with_deficiencies.sort((a: unknown, b: unknown) => {
        const ra = a as Record<string, unknown>;
        const rb = b as Record<string, unknown>;
        const ref_a = (ra.standardReference as { text?: string } | undefined)?.text || '';
        const ref_b = (rb.standardReference as { text?: string } | undefined)?.text || '';
        return natural_sort(ref_a, ref_b);
    });

    // En yttre <ul> får bara innehålla <li>. Kravlistan ligger inuti h1-<li> så DOM blir giltig.
    let sidebar_html =
        '<ul role="list">' +
        '<li role="listitem" class="sidebar-h1">' +
        '<a href="#h1-redovisning-granskningsresultatet" aria-label="Huvudrubrik: Redovisning av granskningsresultatet">Redovisning av granskningsresultatet</a>' +
        '<ul role="list">';

    let content_html = '';
    content_html += '<h1 id="h1-redovisning-granskningsresultatet">Redovisning av granskningsresultatet</h1>';
    content_html +=
        '<p>Det här avsnittet redovisar samtliga brister som har identifierats vid granskningen. För varje krav anges i vilka stickprov PTS har observerat brister.</p>';
    content_html +=
        '<p>Bristerna kan även förekomma i andra delar av e-handeln än de stickprov som har granskats. Verksamheten behöver därför gå igenom e-handeln i sin helhet för att identifiera om motsvarande brister finns även utanför stickproven.</p>';
    content_html +=
        '<p>Redovisningen omfattar endast de brister som har iakttagits inom ramen för den genomförda granskningen.</p>';

    const rule_reqs = (current_audit.ruleFileContent as Record<string, unknown> | undefined)?.requirements as
        | Record<string, unknown>
        | undefined;

    for (const req of sorted_requirements) {
        const r = req as Record<string, unknown>;
        const referenceNumber = extract_reference_number(r);
        const h2_text = (referenceNumber ? referenceNumber + ' ' : '') + String(r.title || '');
        const h2_anchor_id = 'h2-req-' + generate_anchor_id(h2_text);

        sidebar_html += `<li role="listitem" class="sidebar-h2"><a href="#${h2_anchor_id}" aria-label="Krav: ${escape_html_internal(h2_text)}">${escape_html_internal(h2_text)}</a>`;

        content_html += `<h2 id="${h2_anchor_id}">${escape_html_internal(h2_text)}</h2>`;

        const all_deficiency_ids = new Set<string>();
        const samples_for_ids = get_samples_with_deficiencies_for_requirement(r, current_audit);
        for (const sample of samples_for_ids) {
            const defs = get_deficiencies_for_sample(r, sample, current_audit, t);
            for (const def of defs) {
                if (def.deficiencyId) {
                    const id = extractDeficiencyNumber(def.deficiencyId);
                    if (id) all_deficiency_ids.add(id);
                }
            }
        }
        const sorted_deficiency_ids = Array.from(all_deficiency_ids).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        content_html += create_html_metadata(r, current_audit, sorted_deficiency_ids, t);

        const samples_with_deficiencies = get_samples_with_deficiencies_for_requirement(r, current_audit);
        for (const sample of samples_with_deficiencies) {
            const deficiencies = get_deficiencies_for_sample(r, sample, current_audit, t);
            const s = sample as Record<string, unknown>;
            const sampleName = String(s.description || s.url || '');
            const h3_sample_anchor_id = 'h3-sample-' + generate_anchor_id(h2_text + ' ' + sampleName);

            if (s.url) {
                const safe_url = escape_html_internal(
                    Helpers?.add_protocol_if_missing ? Helpers.add_protocol_if_missing(String(s.url)) : String(s.url)
                );
                const icon_html =
                    typeof Helpers?.get_external_link_icon_html === 'function' ? Helpers.get_external_link_icon_html(t) : '';
                content_html += `<h3 id="${h3_sample_anchor_id}">Stickprov: <a href="${safe_url}" target="_blank" rel="noopener noreferrer">${escape_html_internal(sampleName)}${icon_html}</a></h3>`;
            } else {
                content_html += `<h3 id="${h3_sample_anchor_id}">Stickprov: ${escape_html_internal(sampleName)}</h3>`;
            }

            sidebar_html += `<ul role="list"><li role="listitem" class="sidebar-h3"><a href="#${h3_sample_anchor_id}" aria-label="Stickprov: ${escape_html_internal(sampleName)} för krav: ${escape_html_internal(h2_text)}">${escape_html_internal(sampleName)}</a></li></ul>`;

            for (const deficiency of deficiencies) {
                content_html += create_html_observations(deficiency as Record<string, unknown>, t);
            }

            content_html += create_html_comments(r, s, rule_reqs, t);
        }
        sidebar_html += '</li>';
    }
    sidebar_html += '</ul></li></ul>';

    return { sidebar_html, content_html };
}

export function build_content_sorted_by_sample(
    current_audit: Record<string, unknown>,
    t: (key: string, opts?: Record<string, unknown>) => string
): { sidebar_html: string; content_html: string } {
    const samples_with_deficiencies = get_samples_with_deficiencies(current_audit);
    const sorted_samples = samples_with_deficiencies.sort((a: unknown, b: unknown) => {
        const sa = a as Record<string, unknown>;
        const sb = b as Record<string, unknown>;
        const name_a = String(sa.description || sa.url || '').toLowerCase();
        const name_b = String(sb.description || sb.url || '').toLowerCase();
        return natural_sort(name_a, name_b);
    });

    let sidebar_html =
        '<ul role="list">' +
        '<li role="listitem" class="sidebar-h1">' +
        '<a href="#h1-redovisning-granskningsresultatet" aria-label="Huvudrubrik: Redovisning av granskningsresultatet">Redovisning av granskningsresultatet</a>' +
        '<ul role="list">';

    let content_html = '';
    content_html += '<h1 id="h1-redovisning-granskningsresultatet">Redovisning av granskningsresultatet</h1>';
    content_html +=
        '<p>Det här avsnittet redovisar samtliga brister som har identifierats vid granskningen. För varje krav anges i vilka stickprov PTS har observerat brister.</p>';
    content_html +=
        '<p>Bristerna kan även förekomma i andra delar av e-handeln än de stickprov som har granskats. Verksamheten behöver därför gå igenom e-handeln i sin helhet för att identifiera om motsvarande brister finns även utanför stickproven.</p>';
    content_html +=
        '<p>Redovisningen omfattar endast de brister som har iakttagits inom ramen för den genomförda granskningen.</p>';

    const rule_reqs = (current_audit.ruleFileContent as Record<string, unknown> | undefined)?.requirements as
        | Record<string, unknown>
        | undefined;

    for (const sample of sorted_samples) {
        const s = sample as Record<string, unknown>;
        const sampleName = String(s.description || s.url || '');
        const h2_anchor_id = 'h2-sample-' + generate_anchor_id(sampleName);

        sidebar_html += `<li role="listitem" class="sidebar-h2"><a href="#${h2_anchor_id}" aria-label="Stickprov: ${escape_html_internal(sampleName)}">${escape_html_internal(sampleName)}</a>`;

        if (s.url) {
            const safe_url = escape_html_internal(
                Helpers?.add_protocol_if_missing ? Helpers.add_protocol_if_missing(String(s.url)) : String(s.url)
            );
            const icon_html =
                typeof Helpers?.get_external_link_icon_html === 'function' ? Helpers.get_external_link_icon_html(t) : '';
            content_html += `<h2 id="${h2_anchor_id}">Stickprov: <a href="${safe_url}" target="_blank" rel="noopener noreferrer">${escape_html_internal(sampleName)}${icon_html}</a></h2>`;
        } else {
            content_html += `<h2 id="${h2_anchor_id}">Stickprov: ${escape_html_internal(sampleName)}</h2>`;
        }

        const requirements_with_deficiencies = get_requirements_with_deficiencies_for_sample(s, current_audit);
        const sorted_requirements = requirements_with_deficiencies.sort((a: unknown, b: unknown) => {
            const ra = a as Record<string, unknown>;
            const rb = b as Record<string, unknown>;
            const ref_a = (ra.standardReference as { text?: string } | undefined)?.text || '';
            const ref_b = (rb.standardReference as { text?: string } | undefined)?.text || '';
            return natural_sort(ref_a, ref_b);
        });

        sidebar_html += '<ul role="list">';
        for (const req of sorted_requirements) {
            const r = req as Record<string, unknown>;
            const referenceNumber = extract_reference_number(r);
            const h3_text = (referenceNumber ? referenceNumber + ' ' : '') + String(r.title || '');
            const h3_anchor_id = 'h3-' + generate_anchor_id(sampleName + ' ' + h3_text);

            sidebar_html += `<li role="listitem" class="sidebar-h3"><a href="#${h3_anchor_id}" aria-label="Krav: ${escape_html_internal(h3_text)} för stickprov: ${escape_html_internal(sampleName)}">${escape_html_internal(h3_text)}</a></li>`;

            content_html += `<h3 id="${h3_anchor_id}">${escape_html_internal(h3_text)}</h3>`;

            const deficiencies = get_deficiencies_for_sample(r, s, current_audit, t);
            const all_deficiency_ids = new Set<string>();
            for (const def of deficiencies) {
                if (def.deficiencyId) {
                    const id = extractDeficiencyNumber(def.deficiencyId);
                    if (id) all_deficiency_ids.add(id);
                }
            }
            const sorted_deficiency_ids = Array.from(all_deficiency_ids).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
            content_html += create_html_metadata(r, current_audit, sorted_deficiency_ids, t);

            for (const deficiency of deficiencies) {
                content_html += create_html_observations(deficiency as Record<string, unknown>, t);
            }

            content_html += create_html_comments(r, s, rule_reqs, t);
        }
        sidebar_html += '</ul></li>';
    }
    sidebar_html += '</ul></li></ul>';

    return { sidebar_html, content_html };
}

export function extract_text_content(html_string: unknown): string {
    if (!html_string) return '';

    const temp_div = document.createElement('div');
    temp_div.innerHTML = String(html_string);

    let text = temp_div.textContent || (temp_div as unknown as { innerText?: string }).innerText || '';

    text = text.replace(/\s+/g, ' ');

    return text.trim();
}

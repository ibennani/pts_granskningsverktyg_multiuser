// @ts-nocheck
/**
 * @fileoverview HTML-export: escape, metadata, observationer och sidebar/innehåll.
 */
import { marked } from '../utils/markdown.js';
import * as Helpers from '../utils/helpers.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';
import { get_export_requirement_result } from './export_bootstrap.js';
import {
    natural_sort,
    get_requirements_with_deficiencies,
    get_samples_with_deficiencies_for_requirement,
    get_deficiencies_for_sample
} from './export_word_deficiency_queries.js';
import { extract_reference_number } from './export_word_requirement_sections.js';

// Hjälpfunktion för att escape HTML
export function escape_html_internal(str) {
    if (typeof Helpers !== 'undefined' && typeof Helpers.escape_html === 'function') {
        return Helpers.escape_html(str);
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
export function generate_anchor_id(text) {
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
export function create_html_metadata(requirement, current_audit, deficiencyIds, t) {
    let html = '';

    // Referens
    if (requirement.standardReference?.text) {
        const ref_text = escape_html_internal(requirement.standardReference.text);
        const ref_url = requirement.standardReference.url;
        if (ref_url) {
            const safe_url = escape_html_internal(Helpers?.add_protocol_if_missing ? Helpers.add_protocol_if_missing(ref_url) : ref_url);
            const icon_html = (typeof Helpers?.get_external_link_icon_html === 'function') ? Helpers.get_external_link_icon_html(t) : '';
            html += `<p class="metadata-compact"><strong>Referens: </strong><a href="${safe_url}" target="_blank" rel="noopener noreferrer">${ref_text}${icon_html}</a></p>`;
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

    // Identifierade brister - länka varje nummer
    if (deficiencyIds.length > 0) {
        const deficiencyLinks = deficiencyIds.map(id => {
            const anchorId = `deficiency-${id}`;
            return `<a href="#${anchorId}" class="deficiency-link">${escape_html_internal(id)}</a>`;
        }).join(', ');
        html += `<p class="metadata-compact"><strong>Identifierade brister: </strong>${deficiencyLinks}</p>`;
    }

    return html;
}

// Hjälpfunktion för att rendera markdown till HTML (säkert)
export function render_markdown_to_html(markdown_text) {
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
        if (typeof Helpers !== 'undefined' && typeof Helpers.sanitize_html === 'function') {
            return Helpers.sanitize_html(parsed_markdown);
        }
        
        return parsed_markdown;
    } catch (error) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('Error rendering markdown:', error);
        return escape_html_internal(markdown_text);
    }
}

// Hjälpfunktion för att skapa HTML-observationer
export function create_html_observations(deficiency, _t) {
    let html = '';
    let observationText = (deficiency.observationDetail || '').trim();
    observationText = observationText.replace(/^[\s]*[-*]\s/gm, '• ');

    const isStandardText = deficiency.isStandardText || false;
    const defId = extractDeficiencyNumber(deficiency.deficiencyId);
    const anchorId = defId ? `deficiency-${defId}` : '';
    const defIdString = defId ? `Brist-id: ${defId} ` : '';

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
export function create_html_comments(requirement, sample, requirements, _t) {
    let html = '';
    const sample_result = get_export_requirement_result(requirements, sample, requirement);
    if (sample_result && sample_result.commentToActor && sample_result.commentToActor.trim()) {
        html += '<p style="margin-top: 0.5em;"></p>';
        const renderedMarkdown = render_markdown_to_html(sample_result.commentToActor.trim());
        html += `<div class="comment-content"><strong style="color: #6E3282;">Kommentar: </strong>${renderedMarkdown}</div>`;
    }
    return html;
}

// Hjälpfunktion för att hämta alla stickprov med brister
export function get_samples_with_deficiencies(current_audit) {
    const samples_with_deficiencies = [];
    const requirements_obj = current_audit.ruleFileContent?.requirements || {};
    const requirements = Object.values(requirements_obj);
    
    (current_audit.samples || []).forEach(sample => {
        let has_deficiencies = false;
        
        requirements.forEach(req => {
            const result = get_export_requirement_result(requirements_obj, sample, req);
            if (!result || !result.checkResults) return;
            
            const has_deficiencies_for_req = Object.values(result.checkResults).some(check_res => {
                if (!check_res || !check_res.passCriteria) return false;
                return Object.values(check_res.passCriteria).some(pc_obj =>
                    pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId
                );
            });
            
            if (has_deficiencies_for_req) {
                has_deficiencies = true;
            }
        });
        
        if (has_deficiencies) {
            samples_with_deficiencies.push(sample);
        }
    });
    
    return samples_with_deficiencies;
}

// Hjälpfunktion för att hämta krav med brister för ett specifikt stickprov
export function get_requirements_with_deficiencies_for_sample(sample, current_audit) {
    const requirements_obj = current_audit.ruleFileContent?.requirements || {};
    const requirements = Object.values(requirements_obj);
    return requirements.filter(req => {
        const result = get_export_requirement_result(requirements_obj, sample, req);
        if (!result || !result.checkResults) return false;
        
        return Object.values(result.checkResults).some(check_res => {
            if (!check_res || !check_res.passCriteria) return false;
            return Object.values(check_res.passCriteria).some(pc_obj =>
                pc_obj && pc_obj.status === 'failed' && pc_obj.deficiencyId
            );
        });
    });
}

// Hjälpfunktion för att bygga sidebar och content sorterat på krav
export function build_content_sorted_by_requirement(current_audit, t) {
    const requirements_with_deficiencies = get_requirements_with_deficiencies(current_audit);
    const sorted_requirements = requirements_with_deficiencies.sort((a, b) => {
        const ref_a = a.standardReference?.text || '';
        const ref_b = b.standardReference?.text || '';
        return natural_sort(ref_a, ref_b);
    });

    let sidebar_html = '<ul role="list">';
    sidebar_html += '<li role="listitem" class="sidebar-h1"><a href="#h1-redovisning-granskningsresultatet" aria-label="Huvudrubrik: Redovisning av granskningsresultatet">Redovisning av granskningsresultatet</a>';

    let content_html = '';
    content_html += '<h1 id="h1-redovisning-granskningsresultatet">Redovisning av granskningsresultatet</h1>';
    content_html += '<p>Det här avsnittet redovisar samtliga brister som har identifierats vid granskningen. För varje krav anges i vilka stickprov PTS har observerat brister.</p>';
    content_html += '<p>Bristerna kan även förekomma i andra delar av e-handeln än de stickprov som har granskats. Verksamheten behöver därför gå igenom e-handeln i sin helhet för att identifiera om motsvarande brister finns även utanför stickproven.</p>';
    content_html += '<p>Redovisningen omfattar endast de brister som har iakttagits inom ramen för den genomförda granskningen.</p>';

    sidebar_html += '<ul role="list">';
    for (const req of sorted_requirements) {
        const referenceNumber = extract_reference_number(req);
        const h2_text = (referenceNumber ? referenceNumber + " " : "") + req.title;
        const h2_anchor_id = 'h2-req-' + generate_anchor_id(h2_text);

        sidebar_html += `<li role="listitem" class="sidebar-h2"><a href="#${h2_anchor_id}" aria-label="Krav: ${escape_html_internal(h2_text)}">${escape_html_internal(h2_text)}</a>`;

        content_html += `<h2 id="${h2_anchor_id}">${escape_html_internal(h2_text)}</h2>`;

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

        const samples_with_deficiencies = get_samples_with_deficiencies_for_requirement(req, current_audit);
        for (const sample of samples_with_deficiencies) {
            const deficiencies = get_deficiencies_for_sample(req, sample, current_audit, t);
            const sampleName = sample.description || sample.url || "";
            const h3_sample_anchor_id = 'h3-sample-' + generate_anchor_id(h2_text + ' ' + sampleName);

            if (sample.url) {
                const safe_url = escape_html_internal(Helpers?.add_protocol_if_missing ? Helpers.add_protocol_if_missing(sample.url) : sample.url);
                const icon_html = (typeof Helpers?.get_external_link_icon_html === 'function') ? Helpers.get_external_link_icon_html(t) : '';
                content_html += `<h3 id="${h3_sample_anchor_id}">Stickprov: <a href="${safe_url}" target="_blank" rel="noopener noreferrer">${escape_html_internal(sampleName)}${icon_html}</a></h3>`;
            } else {
                content_html += `<h3 id="${h3_sample_anchor_id}">Stickprov: ${escape_html_internal(sampleName)}</h3>`;
            }

            sidebar_html += `<ul role="list"><li role="listitem" class="sidebar-h3"><a href="#${h3_sample_anchor_id}" aria-label="Stickprov: ${escape_html_internal(sampleName)} för krav: ${escape_html_internal(h2_text)}">${escape_html_internal(sampleName)}</a></li></ul>`;

            for (const deficiency of deficiencies) {
                content_html += create_html_observations(deficiency, t);
            }

            content_html += create_html_comments(req, sample, current_audit.ruleFileContent.requirements, t);
        }
        sidebar_html += '</li>';
    }
    sidebar_html += '</ul></li></ul>';

    return { sidebar_html, content_html };
}

// Hjälpfunktion för att bygga sidebar och content sorterat på stickprov
export function build_content_sorted_by_sample(current_audit, t) {
    const samples_with_deficiencies = get_samples_with_deficiencies(current_audit);
    const sorted_samples = samples_with_deficiencies.sort((a, b) => {
        const name_a = (a.description || a.url || "").toLowerCase();
        const name_b = (b.description || b.url || "").toLowerCase();
        return natural_sort(name_a, name_b);
    });

    let sidebar_html = '<ul role="list">';
    sidebar_html += '<li role="listitem" class="sidebar-h1"><a href="#h1-redovisning-granskningsresultatet" aria-label="Huvudrubrik: Redovisning av granskningsresultatet">Redovisning av granskningsresultatet</a>';

    let content_html = '';
    content_html += '<h1 id="h1-redovisning-granskningsresultatet">Redovisning av granskningsresultatet</h1>';
    content_html += '<p>Det här avsnittet redovisar samtliga brister som har identifierats vid granskningen. För varje krav anges i vilka stickprov PTS har observerat brister.</p>';
    content_html += '<p>Bristerna kan även förekomma i andra delar av e-handeln än de stickprov som har granskats. Verksamheten behöver därför gå igenom e-handeln i sin helhet för att identifiera om motsvarande brister finns även utanför stickproven.</p>';
    content_html += '<p>Redovisningen omfattar endast de brister som har iakttagits inom ramen för den genomförda granskningen.</p>';

    sidebar_html += '<ul role="list">';
    for (const sample of sorted_samples) {
        const sampleName = sample.description || sample.url || "";
        const h2_anchor_id = 'h2-sample-' + generate_anchor_id(sampleName);

        sidebar_html += `<li role="listitem" class="sidebar-h2"><a href="#${h2_anchor_id}" aria-label="Stickprov: ${escape_html_internal(sampleName)}">${escape_html_internal(sampleName)}</a>`;

        if (sample.url) {
            const safe_url = escape_html_internal(Helpers?.add_protocol_if_missing ? Helpers.add_protocol_if_missing(sample.url) : sample.url);
            const icon_html = (typeof Helpers?.get_external_link_icon_html === 'function') ? Helpers.get_external_link_icon_html(t) : '';
            content_html += `<h2 id="${h2_anchor_id}">Stickprov: <a href="${safe_url}" target="_blank" rel="noopener noreferrer">${escape_html_internal(sampleName)}${icon_html}</a></h2>`;
        } else {
            content_html += `<h2 id="${h2_anchor_id}">Stickprov: ${escape_html_internal(sampleName)}</h2>`;
        }

        const requirements_with_deficiencies = get_requirements_with_deficiencies_for_sample(sample, current_audit);
        const sorted_requirements = requirements_with_deficiencies.sort((a, b) => {
            const ref_a = a.standardReference?.text || '';
            const ref_b = b.standardReference?.text || '';
            return natural_sort(ref_a, ref_b);
        });

        sidebar_html += '<ul role="list">';
        for (const req of sorted_requirements) {
            const referenceNumber = extract_reference_number(req);
            const h3_text = (referenceNumber ? referenceNumber + " " : "") + req.title;
            const h3_anchor_id = 'h3-' + generate_anchor_id(sampleName + ' ' + h3_text);

            sidebar_html += `<li role="listitem" class="sidebar-h3"><a href="#${h3_anchor_id}" aria-label="Krav: ${escape_html_internal(h3_text)} för stickprov: ${escape_html_internal(sampleName)}">${escape_html_internal(h3_text)}</a></li>`;

            content_html += `<h3 id="${h3_anchor_id}">${escape_html_internal(h3_text)}</h3>`;

            const deficiencies = get_deficiencies_for_sample(req, sample, current_audit, t);
            const all_deficiency_ids = new Set();
            for (const def of deficiencies) {
                if (def.deficiencyId) {
                    const id = extractDeficiencyNumber(def.deficiencyId);
                    if (id) all_deficiency_ids.add(id);
                }
            }
            const sorted_deficiency_ids = Array.from(all_deficiency_ids).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
            content_html += create_html_metadata(req, current_audit, sorted_deficiency_ids, t);

            for (const deficiency of deficiencies) {
                content_html += create_html_observations(deficiency, t);
            }

            content_html += create_html_comments(req, sample, current_audit.ruleFileContent.requirements, t);
        }
        sidebar_html += '</ul></li>';
    }
    sidebar_html += '</ul></li></ul>';

    return { sidebar_html, content_html };
}

// Hjälpfunktion för att extrahera endast textinnehåll från HTML
// Detta är mer robust än att jämföra HTML-struktur eftersom webbläsarens parsing inte påverkar texten
export function extract_text_content(html_string) {
    if (!html_string) return '';
    
    // Skapa en temporär DOM-element för att extrahera text
    const temp_div = document.createElement('div');
    temp_div.innerHTML = html_string;
    
    // Extrahera textinnehåll (använd textContent för att få all text, även dold)
    let text = temp_div.textContent || temp_div.innerText || '';
    
    // Normalisera whitespace
    // Ersätt alla whitespace-sekvenser (inklusive newlines, tabs) med ett mellanslag
    text = text.replace(/\s+/g, ' ');
    
    // Trim start och slut
    text = text.trim();
    
    return text;
}

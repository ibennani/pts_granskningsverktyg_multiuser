/**
 * @fileoverview HTML-export: escape, markdown och små HTML-block (utan layout/sidebar).
 */

import { marked } from '../utils/markdown.js';
import * as Helpers from '../utils/helpers.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';
import { get_export_requirement_result } from './export_bootstrap.js';

export function escape_html_internal(str: unknown): string {
    if (typeof Helpers !== 'undefined' && typeof Helpers.escape_html === 'function') {
        return Helpers.escape_html(str as string);
    }
    if (str === null || str === undefined) {
        return '';
    }
    const safe_string = String(str);
    return safe_string
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function generate_anchor_id(text: unknown): string {
    if (!text) return '';
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/[åäö]/g, (match) => {
            const map: Record<string, string> = { å: 'a', ä: 'a', ö: 'o' };
            return map[match] || match;
        })
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function create_html_metadata(
    requirement: Record<string, unknown>,
    current_audit: Record<string, unknown>,
    deficiencyIds: string[],
    t: (key: string, opts?: Record<string, unknown>) => string
): string {
    let html = '';

    const stdRef = requirement.standardReference as { text?: string; url?: string } | undefined;
    if (stdRef?.text) {
        const ref_text = escape_html_internal(stdRef.text);
        const ref_url = stdRef.url;
        if (ref_url) {
            const safe_url = escape_html_internal(
                Helpers?.add_protocol_if_missing ? Helpers.add_protocol_if_missing(ref_url) : ref_url
            );
            const icon_html =
                typeof Helpers?.get_external_link_icon_html === 'function' ? Helpers.get_external_link_icon_html(t) : '';
            html += `<p class="metadata-compact"><strong>Referens: </strong><a href="${safe_url}" target="_blank" rel="noopener noreferrer">${ref_text}${icon_html}</a></p>`;
        } else {
            html += `<p class="metadata-compact"><strong>Referens: </strong>${ref_text}</p>`;
        }
    }

    {
        const classifications = Array.isArray(requirement.classifications) ? requirement.classifications : [];
        const meta = current_audit?.ruleFileContent as Record<string, unknown> | undefined;
        const metadata = meta?.metadata as Record<string, unknown> | undefined;
        const taxonomies = metadata?.taxonomies as Array<{ id?: string; concepts?: Array<{ id?: string; label?: string }> }> | undefined;
        const taxonomy = taxonomies?.find((x) => x.id === 'wcag22-pour');
        const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
        const principle_texts = taxonomy
            ? (classifications as Array<{ taxonomyId?: string; conceptId?: string }>)
                .filter((c) => norm(c.taxonomyId) === 'wcag22-pour')
                .map((c) => {
                    const concept = taxonomy.concepts?.find?.((x) => norm(x?.id) === norm(c.conceptId));
                    return typeof concept?.label === 'string' && concept.label.trim() ? concept.label : c.conceptId;
                })
                .filter(Boolean)
            : [];

        if (principle_texts.length > 0) {
            html += `<p class="metadata-compact"><strong>Principer: </strong>${escape_html_internal(principle_texts.join(', '))}</p>`;
        }
    }

    if (deficiencyIds.length > 0) {
        const deficiencyLinks = deficiencyIds
            .map((id) => {
                const anchorId = `deficiency-${id}`;
                return `<a href="#${anchorId}" class="deficiency-link">${escape_html_internal(id)}</a>`;
            })
            .join(', ');
        html += `<p class="metadata-compact"><strong>Identifierade brister: </strong>${deficiencyLinks}</p>`;
    }

    return html;
}

export function render_markdown_to_html(markdown_text: unknown): string {
    if (!markdown_text || typeof markdown_text !== 'string') {
        return '';
    }

    if (typeof marked === 'undefined') {
        return escape_html_internal(markdown_text);
    }

    try {
        const renderer = new marked.Renderer();
        const r = renderer as {
            link: (href: unknown, title: unknown, text: unknown) => string;
            html: (html_token: unknown) => string;
        };
        r.link = (href, _title, text) => {
            const safe_href = escape_html_internal(href);
            const safe_text = escape_html_internal(text);
            return `<a href="${safe_href}" target="_blank" rel="noopener noreferrer">${safe_text}</a>`;
        };
        r.html = (html_token) => {
            const text_to_escape =
                typeof html_token === 'object' && html_token !== null && typeof (html_token as { text?: string }).text === 'string'
                    ? (html_token as { text: string }).text
                    : String(html_token || '');
            return escape_html_internal(text_to_escape);
        };

        const parsed_markdown = marked.parse(String(markdown_text), { renderer, breaks: true, gfm: true }) as string;

        if (typeof Helpers !== 'undefined' && typeof Helpers.sanitize_html === 'function') {
            return Helpers.sanitize_html(parsed_markdown);
        }

        return parsed_markdown;
    } catch (error) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('Error rendering markdown:', error);
        return escape_html_internal(markdown_text);
    }
}

export function create_html_observations(deficiency: Record<string, unknown>, _t: (k: string, opts?: Record<string, unknown>) => string): string {
    let html = '';
    let observationText = String(deficiency.observationDetail || '').trim();
    observationText = observationText.replace(/^[\s]*[-*]\s/gm, '• ');

    const isStandardText = Boolean(deficiency.isStandardText);
    const defId = extractDeficiencyNumber((deficiency.deficiencyId as string | undefined) || '');
    const anchorId = defId ? `deficiency-${defId}` : '';
    const defIdString = defId ? `Brist-id: ${defId} ` : '';

    const prefix = isStandardText ? 'Kravet är inte uppfyllt: ' : '';
    const fullText = prefix + observationText;
    let renderedMarkdown = render_markdown_to_html(fullText);

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

export function create_html_comments(
    requirement: Record<string, unknown>,
    sample: Record<string, unknown>,
    requirements: unknown,
    _t: (k: string, opts?: Record<string, unknown>) => string
): string {
    let html = '';
    const sample_result = get_export_requirement_result(requirements, sample, requirement) as
        | { commentToActor?: string }
        | undefined;
    if (sample_result && sample_result.commentToActor && sample_result.commentToActor.trim()) {
        html += '<p style="margin-top: 0.5em;"></p>';
        const renderedMarkdown = render_markdown_to_html(sample_result.commentToActor.trim());
        html += `<div class="comment-content"><strong style="color: #6E3282;">Kommentar: </strong>${renderedMarkdown}</div>`;
    }
    return html;
}

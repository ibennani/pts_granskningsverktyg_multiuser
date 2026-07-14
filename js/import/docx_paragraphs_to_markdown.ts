/**
 * @fileoverview Konverterar docx-stycken (OOXML) till markdown för bristbeskrivningar.
 */

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function children_by_local_name(parent: Element, local_name: string): Element[] {
    return Array.from(parent.children).filter((el) => el.localName === local_name);
}

function first_child_by_local_name(parent: Element, local_name: string): Element | null {
    return children_by_local_name(parent, local_name)[0] ?? null;
}

function get_w_attr(element: Element, name: string): string {
    return element.getAttribute(`w:${name}`) || element.getAttributeNS(W_NS, name) || '';
}

function escape_markdown_text(text: string): string {
    return text.replace(/([\\`*_[\]()#+\-.!|>{}])/g, '\\$1');
}

function run_is_bold(run: Element): boolean {
    const r_pr = first_child_by_local_name(run, 'rPr');
    if (!r_pr) return false;
    return Boolean(first_child_by_local_name(r_pr, 'b'));
}

function run_is_italic(run: Element): boolean {
    const r_pr = first_child_by_local_name(run, 'rPr');
    if (!r_pr) return false;
    return Boolean(first_child_by_local_name(r_pr, 'i'));
}

function normalize_docx_text_fragment(text: string): string {
    return text.replace(/\u00A0/g, ' ').replace(/\u200B/g, '');
}

function collect_text_from_run(run: Element): string {
    const parts: string[] = [];
    for (const child of Array.from(run.children)) {
        if (child.localName === 't') {
            parts.push(normalize_docx_text_fragment(child.textContent || ''));
        }
        if (child.localName === 'tab') {
            parts.push(' ');
        }
        if (child.localName === 'br') {
            parts.push('\n');
        }
    }
    return parts.join('');
}

function find_hyperlink_target(hyperlink: Element, rel_map: Map<string, string>): string | null {
    const rel_id = hyperlink.getAttribute('r:id') || hyperlink.getAttributeNS(R_NS, 'id');
    if (!rel_id) return null;
    return rel_map.get(rel_id) ?? null;
}

function runs_to_markdown(runs_parent: Element, rel_map: Map<string, string>): string {
    const parts: string[] = [];
    for (const child of Array.from(runs_parent.children)) {
        if (child.localName === 'hyperlink') {
            const url = find_hyperlink_target(child, rel_map);
            const inner = runs_to_markdown(child, rel_map);
            if (url && inner) {
                parts.push(`[${inner}](${url})`);
            } else {
                parts.push(inner);
            }
            continue;
        }
        if (child.localName !== 'r') continue;
        let text = collect_text_from_run(child);
        if (!text) continue;
        if (run_is_bold(child)) text = `**${text}**`;
        if (run_is_italic(child)) text = `*${text}*`;
        parts.push(text);
    }
    return parts.join('');
}

function paragraph_is_bullet(paragraph: Element): boolean {
    const p_pr = first_child_by_local_name(paragraph, 'pPr');
    if (!p_pr) return false;
    const num_pr = first_child_by_local_name(p_pr, 'numPr');
    return Boolean(num_pr);
}

/**
 * Konverterar ett docx-stycke till markdown-rad.
 */
export function docx_paragraph_to_markdown_line(
    paragraph: Element,
    rel_map: Map<string, string>
): string {
    const text = runs_to_markdown(paragraph, rel_map).replace(/[ \t]+/g, ' ').trim();
    if (!text) return '';
    if (paragraph_is_bullet(paragraph) || text.startsWith('•')) {
        const bullet_text = text.replace(/^•\s*/, '').trim();
        return `- ${bullet_text}`;
    }
    return text;
}

/**
 * Konverterar flera docx-stycken till markdown-text.
 */
export function docx_paragraphs_to_markdown(
    paragraphs: Element[],
    rel_map: Map<string, string>
): string {
    const lines = paragraphs
        .map((paragraph) => docx_paragraph_to_markdown_line(paragraph, rel_map))
        .filter((line) => line.length > 0);
    return lines.join('\n').trim();
}

export { children_by_local_name, first_child_by_local_name, get_w_attr, W_NS };

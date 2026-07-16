/**
 * @fileoverview Konverterar saniterad HTML (från marked) till docx Paragraph.
 */
import { Paragraph, TextRun, ExternalHyperlink, HeadingLevel } from 'docx';

type HtmlToWordOptions = {
    /** Om false hoppar vi över h1 (t.ex. när dokumenttitel redan satts). */
    include_h1?: boolean;
};

const HEADING_MAP: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    H1: HeadingLevel.HEADING_1,
    H2: HeadingLevel.HEADING_2,
    H3: HeadingLevel.HEADING_3,
    H4: HeadingLevel.HEADING_4,
    H5: HeadingLevel.HEADING_5,
    H6: HeadingLevel.HEADING_6,
};

function parse_html_to_dom(html: string): HTMLElement {
    if (typeof document === 'undefined') {
        throw new Error('export_html_to_word_paragraphs requires DOM');
    }
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    const wrapper = document.createElement('div');
    wrapper.appendChild(template.content.cloneNode(true));
    return wrapper;
}

type WordInlineChild = TextRun | ExternalHyperlink;

function inline_nodes_to_runs(node: Node, inherited: { bold?: boolean; italics?: boolean } = {}): WordInlineChild[] {
    const runs: WordInlineChild[] = [];
    node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent ?? '';
            if (text) {
                runs.push(
                    new TextRun({
                        text,
                        bold: inherited.bold,
                        italics: inherited.italics,
                    })
                );
            }
            return;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        const el = child as HTMLElement;
        const tag = el.tagName.toUpperCase();
        if (tag === 'STRONG' || tag === 'B') {
            runs.push(...inline_nodes_to_runs(el, { ...inherited, bold: true }));
            return;
        }
        if (tag === 'EM' || tag === 'I') {
            runs.push(...inline_nodes_to_runs(el, { ...inherited, italics: true }));
            return;
        }
        if (tag === 'A') {
            const href = el.getAttribute('href') || '';
            const link_runs = inline_nodes_to_runs(el, inherited);
            if (href) {
                runs.push(
                    new ExternalHyperlink({
                        children: link_runs.length
                            ? link_runs
                            : [new TextRun({ text: href, style: 'Hyperlink' })],
                        link: href,
                    })
                );
            } else {
                runs.push(...link_runs);
            }
            return;
        }
        if (tag === 'BR') {
            runs.push(new TextRun({ text: '', break: 1 }));
            return;
        }
        runs.push(...inline_nodes_to_runs(el, inherited));
    });
    return runs;
}

function block_element_to_paragraphs(el: HTMLElement, options: HtmlToWordOptions): Paragraph[] {
    const tag = el.tagName.toUpperCase();
    if (tag === 'H1' && options.include_h1 === false) {
        return [];
    }
    if (HEADING_MAP[tag]) {
        const runs = inline_nodes_to_runs(el);
        return [
            new Paragraph({
                heading: HEADING_MAP[tag],
                children: runs.length ? runs : [new TextRun({ text: el.textContent ?? '' })],
            }),
        ];
    }
    if (tag === 'P') {
        const runs = inline_nodes_to_runs(el);
        if (!runs.length) return [];
        return [new Paragraph({ children: runs })];
    }
    if (tag === 'UL' || tag === 'OL') {
        const paragraphs: Paragraph[] = [];
        el.querySelectorAll(':scope > li').forEach((li) => {
            const runs = inline_nodes_to_runs(li);
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: '• ' }),
                        ...(runs.length ? runs : [new TextRun({ text: li.textContent ?? '' })]),
                    ],
                    indent: { left: 283, hanging: 142 },
                })
            );
        });
        return paragraphs;
    }
    if (tag === 'DIV') {
        const out: Paragraph[] = [];
        el.childNodes.forEach((child) => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                out.push(...block_element_to_paragraphs(child as HTMLElement, options));
            } else if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim()) {
                out.push(new Paragraph({ children: [new TextRun({ text: child.textContent ?? '' })] }));
            }
        });
        return out;
    }
    const runs = inline_nodes_to_runs(el);
    if (!runs.length) return [];
    return [new Paragraph({ children: runs })];
}

/** Konverterar HTML-sträng till docx-stycken. */
export function html_to_word_paragraphs(
    html: string,
    options: HtmlToWordOptions = {}
): Paragraph[] {
    if (!html || !html.trim()) return [];
    const root = parse_html_to_dom(html);
    const paragraphs: Paragraph[] = [];
    root.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
            paragraphs.push(...block_element_to_paragraphs(child as HTMLElement, options));
        } else if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim()) {
            paragraphs.push(new Paragraph({ children: [new TextRun({ text: child.textContent ?? '' })] }));
        }
    });
    return paragraphs;
}

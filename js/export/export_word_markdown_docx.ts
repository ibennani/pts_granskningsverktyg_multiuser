/**
 * @fileoverview Markdown till docx Paragraph/TextRun för Word-export.
 */
import { Paragraph, TextRun, ExternalHyperlink, ShadingType } from 'docx';

type DocxHeading = 'Heading1' | 'Heading2' | 'Heading3' | 'Heading4' | 'Heading5' | 'Heading6';

function markdown_heading_level_to_docx(level: number): DocxHeading {
    const n = Math.min(Math.max(level, 1), 6);
    return (`Heading${n}` as DocxHeading);
}

// Konverterar markdown-text till Word-paragraf-format
export function _convert_markdown_to_word_paragraphs(markdown_text: unknown): Paragraph[] {
    if (!markdown_text || typeof markdown_text !== 'string') {
        return [
            new Paragraph({
                children: [new TextRun({ text: '' })]
            })
        ];
    }

    const paragraphs: Paragraph[] = [];
    const lines = markdown_text.split('\n');
    let current_paragraph_text = '';
    let in_list = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed_line = line.trim();

        if (trimmed_line.match(/^[-*+]\s/) || trimmed_line.match(/^\d+\.\s/)) {
            if (!in_list) {
                if (current_paragraph_text.trim()) {
                    paragraphs.push(create_paragraph_from_text(current_paragraph_text));
                    current_paragraph_text = '';
                }
                in_list = true;
            }
            const list_text = trimmed_line.replace(/^[-*+]\s/, '').replace(/^\d+\.\s/, '');
            paragraphs.push(
                new Paragraph({
                    children: [new TextRun({ text: `• ${list_text}` })],
                    indent: {
                        left: 283,
                        hanging: 142
                    }
                })
            );
        } else if (trimmed_line.startsWith('#')) {
            if (current_paragraph_text.trim()) {
                paragraphs.push(create_paragraph_from_text(current_paragraph_text));
                current_paragraph_text = '';
            }
            const hash_match = trimmed_line.match(/^#+/);
            const heading_level = hash_match ? hash_match[0].length : 1;
            const heading_text = trimmed_line.replace(/^#+\s*/, '');
            paragraphs.push(
                new Paragraph({
                    children: [new TextRun({ text: heading_text, bold: true })],
                    heading: markdown_heading_level_to_docx(heading_level)
                })
            );
        } else if (trimmed_line === '') {
            if (current_paragraph_text.trim()) {
                paragraphs.push(create_paragraph_from_text(current_paragraph_text));
                current_paragraph_text = '';
            }
            in_list = false;
        } else {
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

    if (current_paragraph_text.trim()) {
        paragraphs.push(create_paragraph_from_text(current_paragraph_text));
    }

    return paragraphs.length > 0
        ? paragraphs
        : [
              new Paragraph({
                  children: [new TextRun({ text: '' })]
              })
          ];
}

type ParseMarkdownOptions = { bold?: boolean; italics?: boolean };

export type MarkdownTextRunChild = TextRun | ExternalHyperlink;

type MarkdownPlaceholderKind = 'CODEBLOCK' | 'INLINECODE' | 'LINK' | 'BOLD' | 'ITALIC';

const MARKDOWN_PLACEHOLDER_PREFIX = '\uE000';
const MARKDOWN_PLACEHOLDER_SUFFIX = '\uE001';
const MARKDOWN_PLACEHOLDER_SPLIT_RE = /(\uE000(?:CODEBLOCK|INLINECODE|LINK|BOLD|ITALIC):\d+\uE001)/;
const MARKDOWN_PLACEHOLDER_PARSE_RE = /^\uE000(CODEBLOCK|INLINECODE|LINK|BOLD|ITALIC):(\d+)\uE001$/;

function make_markdown_placeholder(kind: MarkdownPlaceholderKind, index: number): string {
    return `${MARKDOWN_PLACEHOLDER_PREFIX}${kind}:${index}${MARKDOWN_PLACEHOLDER_SUFFIX}`;
}

function parse_markdown_placeholder(part: string): { kind: MarkdownPlaceholderKind; index: number } | null {
    const match = part.match(MARKDOWN_PLACEHOLDER_PARSE_RE);
    if (!match) {
        return null;
    }
    return {
        kind: match[1] as MarkdownPlaceholderKind,
        index: parseInt(match[2], 10)
    };
}

function create_inline_code_text_run(
    code: string,
    options: ParseMarkdownOptions
): TextRun {
    const { bold: forceBold = false, italics: forceItalics = false } = options;
    return new TextRun({
        text: code,
        font: 'Courier New',
        shading: {
            type: ShadingType.SOLID,
            color: 'F5F5F5',
            fill: 'F5F5F5'
        },
        bold: forceBold,
        italics: forceItalics
    });
}

function append_placeholder_text_run(
    text_runs: MarkdownTextRunChild[],
    part: string,
    stores: {
        codeBlocks: string[];
        inlineCodes: string[];
        links: { text: string; url: string }[];
        boldTexts: string[];
        italicTexts: string[];
    },
    options: ParseMarkdownOptions
): void {
    const parsed = parse_markdown_placeholder(part);
    if (!parsed) {
        return;
    }

    const { bold: forceBold = false, italics: forceItalics = false } = options;

    if (parsed.kind === 'CODEBLOCK') {
        text_runs.push(create_inline_code_text_run(stores.codeBlocks[parsed.index] ?? '', options));
        return;
    }

    if (parsed.kind === 'INLINECODE') {
        text_runs.push(create_inline_code_text_run(stores.inlineCodes[parsed.index] ?? '', options));
        return;
    }

    if (parsed.kind === 'LINK') {
        const link = stores.links[parsed.index];
        if (link) {
            text_runs.push(
                new ExternalHyperlink({
                    children: [
                        new TextRun({
                            text: link.text,
                            style: 'Hyperlink',
                            bold: forceBold,
                            italics: forceItalics
                        })
                    ],
                    link: link.url
                })
            );
        }
        return;
    }

    if (parsed.kind === 'BOLD') {
        const content = stores.boldTexts[parsed.index] ?? '';
        text_runs.push(...parse_markdown_to_text_runs(content, { bold: true, italics: forceItalics }));
        return;
    }

    const content = stores.italicTexts[parsed.index] ?? '';
    text_runs.push(...parse_markdown_to_text_runs(content, { bold: forceBold, italics: true }));
}

// Konverterar markdown-text till TextRun-objekt med stöd för länkar, fetstil, kursiv och kod
export function parse_markdown_to_text_runs(
    text: unknown,
    options: ParseMarkdownOptions = {}
): MarkdownTextRunChild[] {
    if (!text || typeof text !== 'string') {
        return [new TextRun({ text: '' })];
    }

    const { bold: forceBold = false, italics: forceItalics = false } = options;
    const text_runs: MarkdownTextRunChild[] = [];
    let current_text = text;

    const codeBlocks: string[] = [];
    current_text = current_text.replace(/```([\s\S]*?)```/g, (match, code: string) => {
        const placeholder = make_markdown_placeholder('CODEBLOCK', codeBlocks.length);
        codeBlocks.push(code.trim());
        return placeholder;
    });

    const inlineCodes: string[] = [];
    current_text = current_text.replace(/`([^`\n]+)`/g, (match, code: string) => {
        const placeholder = make_markdown_placeholder('INLINECODE', inlineCodes.length);
        inlineCodes.push(code);
        return placeholder;
    });

    const links: { text: string; url: string }[] = [];
    current_text = current_text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText: string, url: string) => {
        const placeholder = make_markdown_placeholder('LINK', links.length);
        links.push({ text: linkText, url });
        return placeholder;
    });

    const boldTexts: string[] = [];
    current_text = current_text.replace(/\*\*(.*?)\*\*/g, (match, content: string) => {
        const placeholder = make_markdown_placeholder('BOLD', boldTexts.length);
        boldTexts.push(content);
        return placeholder;
    });
    current_text = current_text.replace(/__(.*?)__/g, (match, content: string) => {
        const placeholder = make_markdown_placeholder('BOLD', boldTexts.length);
        boldTexts.push(content);
        return placeholder;
    });

    const italicTexts: string[] = [];
    current_text = current_text.replace(/\*([^*]+)\*/g, (match, content: string) => {
        const placeholder = make_markdown_placeholder('ITALIC', italicTexts.length);
        italicTexts.push(content);
        return placeholder;
    });
    current_text = current_text.replace(/_([^_]+)_/g, (match, content: string) => {
        if (content.match(/^\d+$/)) {
            return match;
        }
        const placeholder = make_markdown_placeholder('ITALIC', italicTexts.length);
        italicTexts.push(content);
        return placeholder;
    });

    const parts = current_text.split(MARKDOWN_PLACEHOLDER_SPLIT_RE);
    const stores = { codeBlocks, inlineCodes, links, boldTexts, italicTexts };

    for (const part of parts) {
        if (parse_markdown_placeholder(part)) {
            append_placeholder_text_run(text_runs, part, stores, options);
        } else if (part.trim()) {
            text_runs.push(
                new TextRun({
                    text: part,
                    bold: forceBold,
                    italics: forceItalics
                })
            );
        }
    }

    return text_runs.length > 0
        ? text_runs
        : [new TextRun({ text, bold: forceBold, italics: forceItalics })];
}

function create_paragraph_from_text(text: string): Paragraph {
    const text_runs = parse_markdown_to_text_runs(text);
    return new Paragraph({
        children: text_runs.length > 0 ? text_runs : [new TextRun({ text })]
    });
}

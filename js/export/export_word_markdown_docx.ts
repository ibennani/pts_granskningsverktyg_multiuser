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
        const placeholder = `__CODEBLOCK_${codeBlocks.length}__`;
        codeBlocks.push(code.trim());
        return placeholder;
    });

    const inlineCodes: string[] = [];
    current_text = current_text.replace(/`([^`\n]+)`/g, (match, code: string) => {
        const placeholder = `__INLINECODE_${inlineCodes.length}__`;
        inlineCodes.push(code);
        return placeholder;
    });

    const links: { text: string; url: string }[] = [];
    current_text = current_text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText: string, url: string) => {
        const placeholder = `__LINK_${links.length}__`;
        links.push({ text: linkText, url });
        return placeholder;
    });

    const boldTexts: string[] = [];
    current_text = current_text.replace(/\*\*(.*?)\*\*/g, (match, content: string) => {
        const placeholder = `__BOLD_${boldTexts.length}__`;
        boldTexts.push(content);
        return placeholder;
    });
    current_text = current_text.replace(/__(.*?)__/g, (match, content: string) => {
        if (content.match(/^(CODEBLOCK|INLINECODE|LINK|BOLD|ITALIC)_\d+$/)) {
            return match;
        }
        const placeholder = `__BOLD_${boldTexts.length}__`;
        boldTexts.push(content);
        return placeholder;
    });

    const italicTexts: string[] = [];
    current_text = current_text.replace(/\*([^*]+)\*/g, (match, content: string) => {
        if (content.includes('__')) {
            return match;
        }
        const placeholder = `__ITALIC_${italicTexts.length}__`;
        italicTexts.push(content);
        return placeholder;
    });
    current_text = current_text.replace(/_([^_]+)_/g, (match, content: string) => {
        if (content.includes('__') || content.match(/^\d+$/)) {
            return match;
        }
        const placeholder = `__ITALIC_${italicTexts.length}__`;
        italicTexts.push(content);
        return placeholder;
    });

    const parts = current_text.split(/(__CODEBLOCK_\d+__|__INLINECODE_\d+__|__LINK_\d+__|__BOLD_\d+__|__ITALIC_\d+__)/);

    for (const part of parts) {
        if (part.startsWith('__CODEBLOCK_')) {
            const digit_match = part.match(/\d+/);
            const index = digit_match ? parseInt(digit_match[0], 10) : 0;
            const code = codeBlocks[index] ?? '';
            text_runs.push(
                new TextRun({
                    text: code,
                    font: 'Courier New',
                    shading: {
                        type: ShadingType.SOLID,
                        color: 'F5F5F5',
                        fill: 'F5F5F5'
                    },
                    bold: forceBold,
                    italics: forceItalics
                })
            );
        } else if (part.startsWith('__INLINECODE_')) {
            const digit_match = part.match(/\d+/);
            const index = digit_match ? parseInt(digit_match[0], 10) : 0;
            const code = inlineCodes[index] ?? '';
            text_runs.push(
                new TextRun({
                    text: code,
                    font: 'Courier New',
                    shading: {
                        type: ShadingType.SOLID,
                        color: 'F5F5F5',
                        fill: 'F5F5F5'
                    },
                    bold: forceBold,
                    italics: forceItalics
                })
            );
        } else if (part.startsWith('__LINK_')) {
            const digit_match = part.match(/\d+/);
            const index = digit_match ? parseInt(digit_match[0], 10) : 0;
            const link = links[index];
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
        } else if (part.startsWith('__BOLD_')) {
            const digit_match = part.match(/\d+/);
            const index = digit_match ? parseInt(digit_match[0], 10) : 0;
            const content = boldTexts[index] ?? '';
            const nestedRuns = parse_markdown_to_text_runs(content, { bold: true, italics: forceItalics });
            text_runs.push(...nestedRuns);
        } else if (part.startsWith('__ITALIC_')) {
            const digit_match = part.match(/\d+/);
            const index = digit_match ? parseInt(digit_match[0], 10) : 0;
            const content = italicTexts[index] ?? '';
            const nestedRuns = parse_markdown_to_text_runs(content, { bold: forceBold, italics: true });
            text_runs.push(...nestedRuns);
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

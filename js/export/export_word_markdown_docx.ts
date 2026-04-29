// @ts-nocheck
/**
 * @fileoverview Markdown till docx Paragraph/TextRun för Word-export.
 */
import { Paragraph, TextRun, ExternalHyperlink, ShadingType } from 'docx';

// Konverterar markdown-text till Word-paragraf-format
export function _convert_markdown_to_word_paragraphs(markdown_text) {
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

// Konverterar markdown-text till TextRun-objekt med stöd för länkar, fetstil, kursiv och kod
export function parse_markdown_to_text_runs(text, options = {}) {
    if (!text || typeof text !== 'string') {
        return [new TextRun({ text: '' })];
    }

    const { bold: forceBold = false, italics: forceItalics = false } = options;
    const text_runs = [];
    let current_text = text;

    // Hantera kodblock först (```code```) - ersätt med placeholder
    const codeBlocks = [];
    current_text = current_text.replace(/```([\s\S]*?)```/g, (match, code) => {
        const placeholder = `__CODEBLOCK_${codeBlocks.length}__`;
        codeBlocks.push(code.trim());
        return placeholder;
    });

    // Hantera inline kod (`code`) - ersätt med placeholder (måste komma efter kodblock)
    const inlineCodes = [];
    current_text = current_text.replace(/`([^`\n]+)`/g, (match, code) => {
        const placeholder = `__INLINECODE_${inlineCodes.length}__`;
        inlineCodes.push(code);
        return placeholder;
    });

    // Hantera länkar [text](url) - ersätt med placeholder
    const links = [];
    current_text = current_text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        const placeholder = `__LINK_${links.length}__`;
        links.push({ text: linkText, url: url });
        return placeholder;
    });

    // Hantera fetstil (**text** eller __text__) - ersätt med placeholder
    const boldTexts = [];
    current_text = current_text.replace(/\*\*(.*?)\*\*/g, (match, content) => {
        const placeholder = `__BOLD_${boldTexts.length}__`;
        boldTexts.push(content);
        return placeholder;
    });
    current_text = current_text.replace(/__(.*?)__/g, (match, content) => {
        // Undvik att matcha placeholders
        if (content.match(/^(CODEBLOCK|INLINECODE|LINK|BOLD|ITALIC)_\d+$/)) {
            return match;
        }
        const placeholder = `__BOLD_${boldTexts.length}__`;
        boldTexts.push(content);
        return placeholder;
    });

    // Hantera kursiv (*text* eller _text_) - ersätt med placeholder
    const italicTexts = [];
    current_text = current_text.replace(/\*([^*]+)\*/g, (match, content) => {
        // Undvik att matcha placeholders
        if (content.includes('__')) {
            return match;
        }
        const placeholder = `__ITALIC_${italicTexts.length}__`;
        italicTexts.push(content);
        return placeholder;
    });
    current_text = current_text.replace(/_([^_]+)_/g, (match, content) => {
        // Undvik att matcha placeholders och fetstil
        if (content.includes('__') || content.match(/^\d+$/)) {
            return match;
        }
        const placeholder = `__ITALIC_${italicTexts.length}__`;
        italicTexts.push(content);
        return placeholder;
    });

    // Dela upp texten i delar baserat på alla placeholders
    const parts = current_text.split(/(__CODEBLOCK_\d+__|__INLINECODE_\d+__|__LINK_\d+__|__BOLD_\d+__|__ITALIC_\d+__)/);

    for (const part of parts) {
        if (part.startsWith('__CODEBLOCK_')) {
            const index = parseInt(part.match(/\d+/)[0]);
            const code = codeBlocks[index];
            // Skapa kodblock med monospace-font och bakgrund
            text_runs.push(new TextRun({
                text: code,
                font: 'Courier New',
                shading: {
                    type: ShadingType.SOLID,
                    color: 'F5F5F5',
                    fill: 'F5F5F5'
                },
                bold: forceBold,
                italics: forceItalics
            }));
        } else if (part.startsWith('__INLINECODE_')) {
            const index = parseInt(part.match(/\d+/)[0]);
            const code = inlineCodes[index];
            // Skapa inline kod med monospace-font och bakgrund
            text_runs.push(new TextRun({
                text: code,
                font: 'Courier New',
                shading: {
                    type: ShadingType.SOLID,
                    color: 'F5F5F5',
                    fill: 'F5F5F5'
                },
                bold: forceBold,
                italics: forceItalics
            }));
        } else if (part.startsWith('__LINK_')) {
            const index = parseInt(part.match(/\d+/)[0]);
            const link = links[index];
            // Skapa hyperlink
            text_runs.push(new ExternalHyperlink({
                children: [new TextRun({ 
                    text: link.text, 
                    style: 'Hyperlink',
                    bold: forceBold,
                    italics: forceItalics
                })],
                link: link.url
            }));
        } else if (part.startsWith('__BOLD_')) {
            const index = parseInt(part.match(/\d+/)[0]);
            const content = boldTexts[index];
            // Rekursivt hantera innehåll med bold flag
            const nestedRuns = parse_markdown_to_text_runs(content, { bold: true, italics: forceItalics });
            text_runs.push(...nestedRuns);
        } else if (part.startsWith('__ITALIC_')) {
            const index = parseInt(part.match(/\d+/)[0]);
            const content = italicTexts[index];
            // Rekursivt hantera innehåll med italics flag
            const nestedRuns = parse_markdown_to_text_runs(content, { bold: forceBold, italics: true });
            text_runs.push(...nestedRuns);
        } else if (part.trim()) {
            text_runs.push(new TextRun({ 
                text: part,
                bold: forceBold,
                italics: forceItalics
            }));
        }
    }

    return text_runs.length > 0 ? text_runs : [new TextRun({ text: text, bold: forceBold, italics: forceItalics })];
}

// Skapar en paragraf från text med grundläggande markdown-formatering
function create_paragraph_from_text(text) {
    const text_runs = parse_markdown_to_text_runs(text);
    return new Paragraph({
        children: text_runs.length > 0 ? text_runs : [new TextRun({ text: text })]
    });
}
